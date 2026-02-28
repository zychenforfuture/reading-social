import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';

const router: Router = Router();

const commentSchema = z.object({
  content: z.string().min(1).max(5000),
  blockHash: z.string().length(64), // SHA-256 hex
  parentCommentId: z.string().uuid().optional(),
  selectedText: z.string().max(500).optional(),
});

// 获取某内容块的所有评论
router.get('/block/:hash', async (req, res) => {
  try {
    const { hash } = req.params;

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

// 创建评论
router.post('/', async (req, res) => {
  try {
    const { content, blockHash, parentCommentId, selectedText } = commentSchema.parse(req.body);

    // TODO: 从 JWT 获取用户 ID，暂时使用 NULL
    const userId = null;

    // 确保 selected_text 列存在（兼容旧数据库）
    await pool.query(`
      ALTER TABLE comments ADD COLUMN IF NOT EXISTS selected_text VARCHAR(500)
    `).catch(() => {});

    const result = await pool.query(
      `INSERT INTO comments (block_hash, user_id, content, parent_comment_id, selected_text)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, block_hash, content, parent_comment_id, selected_text, created_at`,
      [blockHash, userId, content, parentCommentId || null, selectedText || null]
    );

    logger.info(`Comment created: ${result.rows[0].id} on block ${blockHash.substring(0, 8)}...`);

    res.status(201).json({ comment: result.rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Create comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 更新评论
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, isResolved } = z.object({
      content: z.string().min(1).max(5000).optional(),
      isResolved: z.boolean().optional(),
    }).parse(req.body);

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      values.push(content);
    }
    if (isResolved !== undefined) {
      updates.push(`is_resolved = $${paramIndex++}`);
      values.push(isResolved);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE comments SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, content, is_resolved, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json({ comment: result.rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Update comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 删除评论 (软删除)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      "UPDATE comments SET is_deleted = true, content = '[Deleted]' WHERE id = $1",
      [id]
    );

    logger.info(`Comment soft deleted: ${id}`);
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    logger.error('Delete comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as commentRoutes };
