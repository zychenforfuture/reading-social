import { Router, type Request, type Response } from 'express';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';

const router: Router = Router();

// 获取内容块的评论
router.get('/:hash/comments', async (req, res) => {
  try {
    const { hash } = req.params;

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

// 获取相似内容块
router.get('/:hash/similar', async (req, res) => {
  try {
    const { hash } = req.params;

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

    res.json({ similar: result.rows });
  } catch (error) {
    logger.error('Get similar blocks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取内容块详情
router.get('/:hash', async (req, res) => {
  try {
    const { hash } = req.params;

    const result = await pool.query(
      `SELECT block_hash, raw_content, normalized_content, word_count,
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
