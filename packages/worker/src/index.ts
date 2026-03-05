import { Queue, Worker } from 'bullmq';
import { createHash } from 'crypto';
import { pool } from './db/database.js';
import { logger } from './utils/logger.js';
import { computeSimHash, hammingDistance } from './utils/simhash.js';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const url = new URL(redisUrl);
const password = url.password || undefined;

const connection = {
  url: redisUrl,
  password,
};

// 文档处理队列
const documentQueue = new Queue('document-processing', { connection });

/**
 * 查找与给定 simHash 海明距离 <= threshold 的已有块
 */
async function findSimilarBlocks(simHash: string, threshold = 3): Promise<{ block_hash: string; similarity_hash: string }[]> {
  const result = await pool.query(
    'SELECT block_hash, similarity_hash FROM content_blocks'
  );

  const similar: { block_hash: string; similarity_hash: string; distance: number }[] = [];

  for (const row of result.rows) {
    const distance = hammingDistance(simHash, row.similarity_hash);
    if (distance <= threshold && distance > 0) {
      similar.push({
        block_hash: row.block_hash,
        similarity_hash: row.similarity_hash,
        distance,
      });
    }
  }

  return similar;
}

/**
 * 计算相似度分数（基于海明距离）
 */
function calculateSimilarityScore(distance: number): number {
  return Number((1 - distance / 64).toFixed(4));
}

// 内容指纹 Worker
const fingerprintWorker = new Worker(
  'document-processing',
  async (job) => {
    const { documentId } = job.data;
    logger.info(`Processing document: ${documentId}`);

    // 从数据库读取内容（避免大文本通过 Redis 传输）
    const docRow = await pool.query(
      'SELECT content FROM documents WHERE id = $1',
      [documentId]
    );
    if (docRow.rows.length === 0 || !docRow.rows[0].content) {
      throw new Error(`Document ${documentId} not found or has no content`);
    }
    const content: string = docRow.rows[0].content;

    try {
      // 按自然段（单行换行）切分，去除 \r 和空行
      const blocks = content.split(/\r?\n/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);

      logger.info(`Document ${documentId}: found ${blocks.length} blocks`);

      type BlockItem = { content: string; hash: string; simHash: string; seq: number };

      // 预计算所有 block 数据
      const blockData: BlockItem[] = blocks.map((blockContent: string, i: number) => ({
        content: blockContent,
        hash: createHash('sha256').update(blockContent).digest('hex'),
        simHash: computeSimHash(blockContent),
        seq: i,
      }));

      // content_blocks 去重（同一文档内重复段落只插入一次）
      const uniqueBlocks: BlockItem[] = Array.from(
        new Map(blockData.map((b) => [b.hash, b])).values()
      );

      const BATCH = 500;

      // 批量插入 content_blocks（已去重）
      for (let start = 0; start < uniqueBlocks.length; start += BATCH) {
        const batch = uniqueBlocks.slice(start, start + BATCH);
        const placeholders = batch.map((_: unknown, j: number) => {
          const b = j * 4;
          return `($${b+1},$${b+2},$${b+3},$${b+4})`;
        }).join(',');
        const values = batch.flatMap((b) =>
          [b.hash, b.content, b.content.length, b.simHash]
        );
        await pool.query(
          `INSERT INTO content_blocks (block_hash, raw_content, word_count, similarity_hash)
           VALUES ${placeholders}
           ON CONFLICT (block_hash) DO UPDATE SET occurrence_count = content_blocks.occurrence_count + 1, updated_at = NOW()`,
          values
        );
      }

      // 批量插入 document_blocks
      for (let start = 0; start < blockData.length; start += BATCH) {
        const batch = blockData.slice(start, start + BATCH);
        const placeholders = batch.map((_: unknown, j: number) => {
          const b = j * 5;
          return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5})`;
        }).join(',');
        const values = batch.flatMap((b) =>
          [documentId, b.hash, b.seq, 0, b.content.length]
        );
        await pool.query(
          `INSERT INTO document_blocks (document_id, block_hash, sequence_order, start_offset, end_offset)
           VALUES ${placeholders} ON CONFLICT DO NOTHING`,
          values
        );
      }

      // 为新增的块计算相似块关系
      logger.info(`Calculating similar blocks for document ${documentId}...`);
      const SIMILAR_THRESHOLD = 3; // 海明距离阈值

      for (const block of uniqueBlocks) {
        // 查询已有相似块
        const similar = await findSimilarBlocks(block.simHash, SIMILAR_THRESHOLD);

        if (similar.length > 0) {
          const values: any[] = [];
          const placeholders: string[] = [];
          let paramIndex = 1;

          for (const s of similar) {
            const score = calculateSimilarityScore(s.distance);
            placeholders.push(`($${paramIndex},$${paramIndex + 1},$${paramIndex + 2},$${paramIndex + 3})`);
            values.push(block.hash, s.block_hash, score, 'simhash');
            values.push(s.block_hash, block.hash, score, 'simhash'); // 双向关系
            paramIndex += 4;
          }

          if (placeholders.length > 0) {
            await pool.query(
              `INSERT INTO similar_blocks (block_hash, similar_hash, similarity_score, algorithm)
               VALUES ${placeholders.join(',')}
               ON CONFLICT (block_hash, similar_hash, algorithm) DO UPDATE SET similarity_score = EXCLUDED.similarity_score`,
              values
            );
            logger.info(`Found ${similar.length} similar blocks for ${block.hash.substring(0, 8)}...`);
          }
        }
      }

      // 更新文档状态，清空 content 节省存储
      await pool.query(
        'UPDATE documents SET word_count = $1, block_count = $2, status = $3, content = NULL WHERE id = $4',
        [content.length, blocks.length, 'ready', documentId]
      );

      logger.info(`Document ${documentId} processed successfully`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Error processing document ${documentId}: ${msg}`);
      await pool.query(
        "UPDATE documents SET status = 'error' WHERE id = $1",
        [documentId]
      );
      throw error;
    }
  },
  { connection, concurrency: 1 } // 降低并发，避免相似计算时数据库竞争
);

fingerprintWorker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`);
});

fingerprintWorker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed: ${err?.message ?? String(err)}`);
});

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('Worker shutting down...');
  await fingerprintWorker.close();
  await pool.end();
  process.exit(0);
});

logger.info('Worker started, waiting for jobs...');

// 导出队列供外部使用
export { documentQueue };
