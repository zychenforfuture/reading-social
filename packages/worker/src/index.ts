import { Queue, Worker } from 'bullmq';
import { pool } from './db/database.js';
import { logger } from './utils/logger.js';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const url = new URL(redisUrl);
const password = url.password || undefined;

const connection = {
  url: redisUrl,
  password,
};

// 文档处理队列
const documentQueue = new Queue('document-processing', { connection });

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
      const crypto = await import('crypto');

      // 按自然段（单行换行）切分，去除 \r 和空行
      const blocks = content.split(/\r?\n/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);

      logger.info(`Document ${documentId}: found ${blocks.length} blocks`);

      type BlockItem = { content: string; hash: string; simHash: string; seq: number };

      // 预计算所有 block 数据
      const blockData: BlockItem[] = blocks.map((blockContent: string, i: number) => ({
        content: blockContent,
        hash: crypto.createHash('sha256').update(blockContent).digest('hex'),
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
          const b = j * 5;
          return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5})`;
        }).join(',');
        const values = batch.flatMap((b) =>
          [b.hash, b.content, b.content, b.content.length, b.simHash]
        );
        await pool.query(
          `INSERT INTO content_blocks (block_hash, raw_content, normalized_content, word_count, similarity_hash)
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

      // 更新文档状态
      await pool.query(
        'UPDATE documents SET word_count = $1, block_count = $2, status = $3 WHERE id = $4',
        [content.length, blocks.length, 'ready', documentId]
      );

      logger.info(`Document ${documentId} processed successfully`);
    } catch (error) {
      logger.error(`Error processing document ${documentId}:`, error);
      await pool.query(
        "UPDATE documents SET status = 'error' WHERE id = $1",
        [documentId]
      );
      throw error;
    }
  },
  { connection, concurrency: 2 }
);

fingerprintWorker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`);
});

fingerprintWorker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed:`, err);
});

// 计算 SimHash (简化版本)
function computeSimHash(text: string): string {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(text).digest('hex');
  return hash;
}

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
