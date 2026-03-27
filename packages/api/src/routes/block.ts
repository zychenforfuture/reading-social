import { Router } from 'express';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';
import { qdrantClient, COLLECTION_NAME } from '../config/qdrant.js';

const router: Router = Router();

const SHA256_HASH_REGEX = /^[0-9a-f]{64}$/i;

// 获取内容块的评论
router.get('/:hash/comments', async (req, res) => {
  try {
    const { hash } = req.params;

    if (!SHA256_HASH_REGEX.test(hash)) {
      return res.status(400).json({ error: 'Invalid hash format' });
    }

    // 验证 hash 是否存在
    const blockExists = await pool.query(
      'SELECT block_hash FROM content_blocks WHERE block_hash = $1',
      [hash]
    );

    if (blockExists.rows.length === 0) {
      return res.status(404).json({ error: 'Content block not found' });
    }

    const result = await pool.query(
      `SELECT c.*, u.username, u.avatar_url
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.block_hash = $1 AND c.is_deleted = false AND c.parent_comment_id IS NULL
       ORDER BY c.created_at ASC`,
      [hash]
    );

    // 获取回复
    const comments = result.rows;
    for (const comment of comments) {
      const repliesResult = await pool.query(
        `SELECT c.*, u.username, u.avatar_url
         FROM comments c
         LEFT JOIN users u ON c.user_id = u.id
         WHERE c.parent_comment_id = $1 AND c.is_deleted = false
         ORDER BY c.created_at ASC`,
        [comment.id]
      );
      comment.replies = repliesResult.rows;
    }

    res.json({ comments });
  } catch (error) {
    logger.error('Get block comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取相似内容块（支持向量搜索）
router.get('/:hash/similar', async (req, res) => {
  try {
    const { hash } = req.params;
    const { useVector } = req.query;

    if (!SHA256_HASH_REGEX.test(hash)) {
      return res.status(400).json({ error: 'Invalid hash format' });
    }

    // 验证块是否存在
    const blockExists = await pool.query(
      'SELECT block_hash FROM content_blocks WHERE block_hash = $1',
      [hash]
    );
    if (blockExists.rows.length === 0) {
      return res.status(404).json({ error: 'Content block not found' });
    }

    // 如果使用向量搜索（?useVector=true）
    if (useVector === 'true') {
      // 从 Qdrant 获取该块的 embedding
      const uuidHash = hash.slice(0, 8) + '-' + hash.slice(8, 12) + '-' + hash.slice(12, 16) + '-' + hash.slice(16, 20) + '-' + hash.slice(20, 32);

      try {
        const pointData = await qdrantClient.retrieve(COLLECTION_NAME, {
          ids: [uuidHash],
          with_vector: true,
        });

        if (pointData.length > 0 && pointData[0].vector) {
          // 使用获取的向量进行相似搜索
          const similarResults = await qdrantClient.search(COLLECTION_NAME, {
            vector: pointData[0].vector as number[],
            limit: 20,
            score_threshold: 0.5,
            with_payload: true,
          });

          // 过滤掉自身
          const filteredResults = similarResults
            .filter(r => (r.payload as any).block_hash !== hash)
            .map(r => ({
              block_hash: (r.payload as any).block_hash,
              similarity_score: r.score,
              algorithm: 'embedding',
            }));

          return res.json({ similar: filteredResults, source: 'vector' });
        }
      } catch (vectorError) {
        logger.warn('Vector search failed, falling back to database:', vectorError);
        // 向量搜索失败，回退到数据库查询
      }
    }

    // 默认从数据库查询（SimHash 结果）
    const result = await pool.query(
      `SELECT sb.similar_hash, sb.similarity_score, sb.algorithm,
              cb.raw_content, cb.word_count, cb.occurrence_count
       FROM similar_blocks sb
       JOIN content_blocks cb ON sb.similar_hash = cb.block_hash
       WHERE sb.block_hash = $1
       ORDER BY sb.similarity_score DESC
       LIMIT 20`,
      [hash]
    );

    res.json({ similar: result.rows, source: 'database' });
  } catch (error) {
    logger.error('Get similar blocks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取内容块详情
router.get('/:hash', async (req, res) => {
  try {
    const { hash } = req.params;

    if (!SHA256_HASH_REGEX.test(hash)) {
      return res.status(400).json({ error: 'Invalid hash format' });
    }

    const result = await pool.query(
      `SELECT block_hash, raw_content, word_count,
              occurrence_count, created_at
       FROM content_blocks
       WHERE block_hash = $1`,
      [hash]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Content block not found' });
    }

    // 获取包含此块的文档
    const docsResult = await pool.query(
      `SELECT d.id, d.title, d.user_id
       FROM document_blocks db
       JOIN documents d ON db.document_id = d.id
       WHERE db.block_hash = $1`,
      [hash]
    );

    res.json({
      block: result.rows[0],
      documents: docsResult.rows,
    });
  } catch (error) {
    logger.error('Get block details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as blockRoutes };
