import { Queue, Worker } from 'bullmq';
import { createHash } from 'crypto';
import { pool } from './db/database.js';
import { logger } from './utils/logger.js';
import { computeSimHash, hammingDistance } from './utils/simhash.js';
import { generateEmbedding } from './utils/embedding.js';
import { storeEmbedding, findSimilarEmbeddings, checkEmbeddingExists, initializeQdrantCollection } from './db/qdrant-client.js';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const url = new URL(redisUrl);
const password = url.password || undefined;

const connection = {
  url: redisUrl,
  password,
};

// 初始化 Qdrant 集合（384 维，all-MiniLM-L6-v2）
await initializeQdrantCollection();

// 文档处理队列
const documentQueue = new Queue('document-processing', { connection });
const embeddingQueue = new Queue('embedding-generation', { connection });

/**
 * 用 LSH band 查找与给定 simHash 海明距离 <= threshold 的已有块
 * 原理：把 64 位抆分成 4 段，相似指纹必有至少 1 段相同，直接用索引命中候选集
 */
async function findSimilarBlocks(
  simHash: string,
  threshold = 3,
): Promise<{ block_hash: string; similarity_hash: string; distance: number }[]> {
  const b0 = simHash.slice(0, 4);
  const b1 = simHash.slice(4, 8);
  const b2 = simHash.slice(8, 12);
  const b3 = simHash.slice(12, 16);

  // 任意一段相同即为候选（避免全表扫描）
  const result = await pool.query(
    `SELECT DISTINCT block_hash, similarity_hash FROM content_blocks
     WHERE similarity_hash ~ '^[0-9a-f]{16}$'
       AND (sh_b0 = $1 OR sh_b1 = $2 OR sh_b2 = $3 OR sh_b3 = $4)`,
    [b0, b1, b2, b3]
  );

  const similar: { block_hash: string; similarity_hash: string; distance: number }[] = [];
  for (const row of result.rows) {
    if (typeof row.similarity_hash !== 'string' || row.similarity_hash.length !== 16) continue;
    const distance = hammingDistance(simHash, row.similarity_hash);
    if (distance <= threshold && distance > 0) {
      similar.push({ block_hash: row.block_hash, similarity_hash: row.similarity_hash, distance });
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

/**
 * 计算向量相似度分数
 */
function calculateVectorSimilarityScore(score: number): number {
  return Number(score.toFixed(4));
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

      // 批量插入 content_blocks，通过 RETURNING + xmax 识别真正新增的块
      // xmax = 0 表示本次是 INSERT（新块）；xmax != 0 表示是 ON CONFLICT UPDATE（旧块）
      const newBlockHashes = new Set<string>();
      for (let start = 0; start < uniqueBlocks.length; start += BATCH) {
        const batch = uniqueBlocks.slice(start, start + BATCH);
        const placeholders = batch.map((_: unknown, j: number) => {
          const b = j * 8;
          return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8})`;
        }).join(',');
        const values = batch.flatMap((b) =>
          [b.hash, b.content, b.content.length, b.simHash,
           b.simHash.slice(0, 4), b.simHash.slice(4, 8),
           b.simHash.slice(8, 12), b.simHash.slice(12, 16)]
        );
        const result = await pool.query(
          `INSERT INTO content_blocks (block_hash, raw_content, word_count, similarity_hash, sh_b0, sh_b1, sh_b2, sh_b3)
           VALUES ${placeholders}
           ON CONFLICT (block_hash) DO UPDATE SET occurrence_count = content_blocks.occurrence_count + 1, updated_at = NOW()
           RETURNING block_hash, (xmax = 0) AS is_new`,
          values
        );
        for (const row of result.rows) {
          if (row.is_new) newBlockHashes.add(row.block_hash);
        }
      }
      logger.info(`Document ${documentId}: ${newBlockHashes.size}/${uniqueBlocks.length} blocks are new (${uniqueBlocks.length - newBlockHashes.size} skipped SimHash)`);

      // 只对真正新增的块做 SimHash 相似查找（旧块已有 similar_blocks 记录）
      const newBlocks = uniqueBlocks.filter(b => newBlockHashes.has(b.hash));

      // 计算全文 doc_simhash（存入文档元数据，供日后分析用；不做 near-dedup，每个文档保留完整独立内容）
      const docSimHash = computeSimHash(content);

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

      // 仅对新块计算 SimHash 相似关系（LSH band 查询）
      logger.info(`Calculating similar blocks for document ${documentId}... (${newBlocks.length} new blocks)`);
      const SIMILAR_THRESHOLD = 3;
      const BLOCK_PROCESS_BATCH = 500;
      let processedCount = 0;

      for (const block of newBlocks) {
        processedCount++;

        // SimHash 相似块（LSH 索引命中）
        const similar = await findSimilarBlocks(block.simHash, SIMILAR_THRESHOLD);

        if (similar.length > 0) {
          const values: any[] = [];
          const placeholders: string[] = [];
          let paramIndex = 1;

          for (const s of similar) {
            const score = calculateSimilarityScore(s.distance);
            placeholders.push(`($${paramIndex},$${paramIndex + 1},$${paramIndex + 2},$${paramIndex + 3})`);
            placeholders.push(`($${paramIndex + 4},$${paramIndex + 5},$${paramIndex + 6},$${paramIndex + 7})`);
            values.push(block.hash, s.block_hash, score, 'simhash');
            values.push(s.block_hash, block.hash, score, 'simhash'); // 双向关系
            paramIndex += 8;
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

        // 定期记录进度
        if (processedCount % BLOCK_PROCESS_BATCH === 0) {
          logger.info(`SimHash blocks ${processedCount}/${newBlocks.length}...`);
        }
      }

      logger.info(`SimHash processing done for document ${documentId}`);

      // ─── SimHash 完成，立即标记文档为就绪（带 doc_simhash）───
      await pool.query(
        `UPDATE documents
         SET word_count = $1, block_count = $2, status = $3, content = NULL,
             doc_simhash = $4, doc_b0 = $5, doc_b1 = $6, doc_b2 = $7, doc_b3 = $8
         WHERE id = $9 OR canonical_document_id = $9`,
        [content.length, blocks.length, 'ready',
         docSimHash, docSimHash.slice(0, 4), docSimHash.slice(4, 8),
         docSimHash.slice(8, 12), docSimHash.slice(12, 16),
         documentId]
      );
      logger.info(`Document ${documentId} marked as ready (${uniqueBlocks.length} unique blocks)`);

      // ─── Embedding 后台异步，调度到专门的 BullMQ 队列 ───
      const embeddingJobs = newBlocks.map((block) => ({
        name: 'generate_embedding',
        data: { documentId, block },
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 }
        }
      }));
      
      if (embeddingJobs.length > 0) {
        await embeddingQueue.addBulk(embeddingJobs);
        logger.info(`Queued ${embeddingJobs.length} embedding jobs for document ${documentId}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Error processing document ${documentId}: ${msg}`);
      await pool.query(
        "UPDATE documents SET status = 'error' WHERE id = $1 OR canonical_document_id = $1",
        [documentId]
      );
      throw error;
    }
  },
  {
    connection,
    concurrency: 4,         // 并发处理 4 个文档任务
    lockDuration: 600000,   // 10 分钟锁超时
    lockRenewTime: 60000,
  }
);

fingerprintWorker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`);
});

fingerprintWorker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed: ${err?.message ?? String(err)}`);
});

// ─── Embedding Worker ───
const embeddingWorker = new Worker(
  'embedding-generation',
  async (job) => {
    const { documentId, block } = job.data;
    
    // 跳过已存在于 Qdrant 的块（重复文档/重试场景）
    if (await checkEmbeddingExists(block.hash)) {
      return { status: 'skipped, exists' };
    }

    try {
      const embedding = await generateEmbedding(block.content);
      await storeEmbedding(block.hash, embedding);
      logger.debug(`Stored embedding for block ${block.hash.substring(0, 8)}...`);

      // 查找向量相似块（只存 SimHash 未覆盖的语义相似对，避免冗余）
      const vectorSimilar = await findSimilarEmbeddings(embedding);
      if (vectorSimilar.length > 0) {
        // 取出本块 SimHash 已记录的相似 hash 集合，用于去重
        const simhashCoveredResult = await pool.query(
          `SELECT similar_hash FROM similar_blocks WHERE block_hash = $1 AND algorithm = 'simhash'`,
          [block.hash]
        );
        const simhashCovered = new Set(simhashCoveredResult.rows.map((r: { similar_hash: string }) => r.similar_hash));

        const vectorValues: any[] = [];
        const vectorPlaceholders: string[] = [];
        let vp = 1;
        for (const vs of vectorSimilar) {
          if (vs.block_hash === block.hash) continue;
          if (simhashCovered.has(vs.block_hash)) continue; // SimHash 已覆盖，跳过
          const score = calculateVectorSimilarityScore(vs.score);
          vectorPlaceholders.push(`($${vp},$${vp+1},$${vp+2},$${vp+3})`);
          vectorPlaceholders.push(`($${vp+4},$${vp+5},$${vp+6},$${vp+7})`);
          vectorValues.push(block.hash, vs.block_hash, score, 'embedding');
          vectorValues.push(vs.block_hash, block.hash, score, 'embedding');
          vp += 8;
        }
        if (vectorPlaceholders.length > 0) {
          await pool.query(
            `INSERT INTO similar_blocks (block_hash, similar_hash, similarity_score, algorithm)
             VALUES ${vectorPlaceholders.join(',')}
             ON CONFLICT (block_hash, similar_hash, algorithm) DO UPDATE SET similarity_score = EXCLUDED.similarity_score`,
            vectorValues
          );
        }
      }
      return { status: 'success' };
    } catch (embedError) {
      logger.error(`Embedding failed for block ${block.hash.substring(0, 8)}:`, embedError);
      throw embedError;
    }
  },
  {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2', 10), // 控制 API 并发
  }
);

embeddingWorker.on('failed', async (job, err) => {
  logger.error(`Embedding Job ${job?.id} failed: ${err?.message ?? String(err)}`);
  if (job && job.attemptsMade === job.opts.attempts) {
    const { block } = job.data;
    try {
      await pool.query(
        'INSERT INTO failed_embeddings (block_hash, error_message, retry_count) VALUES ($1, $2, $3) ON CONFLICT (block_hash) DO UPDATE SET error_message = EXCLUDED.error_message, retry_count = EXCLUDED.retry_count, updated_at = NOW()',
        [block.hash, err.message, job.attemptsMade]
      );
    } catch { /* ignore */ }
  }
});

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('Worker shutting down...');
  await fingerprintWorker.close();
  await embeddingWorker.close();
  await pool.end();
  process.exit(0);
});

logger.info('Worker started, waiting for jobs...');

// 导出队列供外部使用
export { documentQueue, embeddingQueue };
