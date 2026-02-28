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
    const { documentId, content } = job.data;
    logger.info(`Processing document: ${documentId}`);

    try {
      const crypto = await import('crypto');

      // 按自然段（单行换行）切分，去除 \r 和空行
      const blocks = content.split(/\r?\n/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);

      logger.info(`Document ${documentId}: found ${blocks.length} blocks`);

      // 处理每个块
      for (let i = 0; i < blocks.length; i++) {
        const blockContent = blocks[i]!.trim();
        const blockHash = crypto.createHash('sha256').update(blockContent).digest('hex');

        // 计算 SimHash (简化版本)
        const similarityHash = computeSimHash(blockContent);

        // 插入或更新内容块
        await pool.query(
          `INSERT INTO content_blocks (block_hash, raw_content, normalized_content, word_count, similarity_hash)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (block_hash) DO UPDATE SET
             occurrence_count = content_blocks.occurrence_count + 1,
             updated_at = NOW()`,
          [blockHash, blockContent, blockContent, blockContent.length, similarityHash]
        );

        // 插入文档 - 块映射
        await pool.query(
          'INSERT INTO document_blocks (document_id, block_hash, sequence_order, start_offset, end_offset) VALUES ($1, $2, $3, $4, $5)',
          [documentId, blockHash, i, 0, blockContent.length]
        );

        // 查找相似块并建立关系
        await findAndLinkSimilarBlocks(blockHash, similarityHash);
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

// 查找并链接相似块
async function findAndLinkSimilarBlocks(blockHash: string, similarityHash: string) {
  const result = await pool.query(
    `SELECT block_hash FROM content_blocks
     WHERE similarity_hash = $1 AND block_hash != $2
     LIMIT 10`,
    [similarityHash, blockHash]
  );

  for (const row of result.rows) {
    await pool.query(
      `INSERT INTO similar_blocks (block_hash, similar_hash, similarity_score, algorithm)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [blockHash, row.block_hash, 1.0, 'simhash']
    );
  }
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
