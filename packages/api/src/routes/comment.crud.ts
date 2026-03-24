import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';
import { authenticate, optionalAuth, type AuthPayload } from '../middleware/auth.js';
import { broadcastToDocument } from './comment.sse.js';
import { sendCommentNotifications, sendLikeNotification } from './comment.notify.js';
import { cleanText } from '../utils/clean.js';

const router: Router = Router();

const commentSchema = z.object({
  content: z.string().min(1).max(5000),
  blockHash: z.string().length(64).optional(),
  rootId: z.string().uuid().optional(),
  replyToUserId: z.string().uuid().optional(),
  selectedText: z.string().max(500).optional(),
  parentCommentId: z.string().uuid().optional(),
});

// 去掉空白和中英文标点，保留纯文字内容，用于 sentence_hash 归一化
function normalizeSentence(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, '')
    .replace(/[\u3000-\u303f\uff00-\uffef]/g, c => {
      const cp = c.codePointAt(0)!;
      return cp >= 0xff01 && cp <= 0xff5e ? String.fromCodePoint(cp - 0xfee0) : c;
    })
    .replace(/[^\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af\w]/g, '');
}

function sentenceHash(text: string): string {
  return createHash('md5').update(normalizeSentence(text)).digest('hex');
}

// 获取根评论下的所有回复（二级扁平）
router.get('/:id/replies', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const { id } = _req.params;
    const userId = _req.user?.userId || null;
    const result = await pool.query(
      `SELECT c.*, u.username, u.avatar_url,
              ru.username as reply_to_username,
              CASE WHEN cl.user_id IS NOT NULL THEN true ELSE false END as liked_by_me
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN users ru ON ru.id = c.reply_to_user_id
       LEFT JOIN comment_likes cl ON cl.comment_id = c.id AND cl.user_id = $2
       WHERE c.root_id = $1 AND c.is_deleted = false
       ORDER BY c.created_at ASC`,
      [id, userId]
    );
    res.json({ replies: result.rows });
  } catch (error) {
    logger.error('Get replies error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取某内容块的所有评论
router.get('/block/:hash', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const { hash } = _req.params;

    const result = await pool.query(
      `SELECT c.*, u.username, u.avatar_url
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.block_hash = $1 AND c.is_deleted = false AND c.parent_comment_id IS NULL
       ORDER BY c.created_at ASC`,
      [hash]
    );

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

// 创建评论（根评论或回复）
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const parsedBody = commentSchema.parse(req.body);
    const { blockHash, rootId, replyToUserId } = parsedBody;
    let content = parsedBody.content;
    let selectedText = parsedBody.selectedText;

    content = cleanText(content, 5000);
    if (typeof selectedText === 'string') selectedText = cleanText(selectedText, 500);

    const { userId } = req.user!;

    if (rootId) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const rootRow = await client.query(
          'SELECT block_hash, user_id, content, selected_text FROM comments WHERE id = $1 AND root_id IS NULL AND is_deleted = false',
          [rootId]
        );
        if (rootRow.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Root comment not found' });
        }
        const inheritedBlockHash: string = rootRow.rows[0].block_hash;

        const result = await client.query(
          `INSERT INTO comments (block_hash, user_id, content, root_id, reply_to_user_id, selected_text)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, block_hash, user_id, content, root_id, reply_to_user_id, selected_text, created_at`,
          [inheritedBlockHash, userId, content, rootId, replyToUserId || null, selectedText || null]
        );

        await client.query('UPDATE comments SET reply_count = reply_count + 1 WHERE id = $1', [rootId]);
        await client.query('COMMIT');

        const reply = result.rows[0];
        if (userId) {
          const u = await pool.query('SELECT username, avatar_url FROM users WHERE id = $1', [userId]);
          reply.username = u.rows[0]?.username ?? null;
          reply.avatar_url = u.rows[0]?.avatar_url ?? null;
        }
        if (replyToUserId) {
          const rtu = await pool.query('SELECT username FROM users WHERE id = $1', [replyToUserId]);
          reply.reply_to_username = rtu.rows[0]?.username ?? null;
        }

        logger.info(`Reply created: ${reply.id} under root ${rootId.substring(0, 8)}...`);

        // 跨文档广播
        try {
          const docRows = await pool.query(
            'SELECT DISTINCT document_id FROM document_blocks WHERE block_hash = $1',
            [inheritedBlockHash]
          );
          for (const row of docRows.rows) {
            broadcastToDocument(row.document_id as string | string[], { type: 'new_reply', rootId, reply });
          }
        } catch {
          // SSE 广播失败不影响主流程，静默忽略
        }

        // 发送通知
        await sendCommentNotifications({
          reply,
          rootRow: rootRow.rows[0],
          userId,
          content,
          replyToUserId,
          inheritedBlockHash,
        });

        return res.status(201).json({ comment: reply });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    if (!blockHash) {
      return res.status(400).json({ error: 'blockHash is required for root comments' });
    }

    const sourceText = selectedText ?? content;
    const normalized = normalizeSentence(sourceText);
    const sHash = normalized ? sentenceHash(sourceText) : null;
    const result = await pool.query(
      `INSERT INTO comments (block_hash, user_id, content, selected_text, sentence_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, block_hash, user_id, content, selected_text, sentence_hash, reply_count, created_at`,
      [blockHash, userId, content, selectedText || null, sHash]
    );

    const comment = result.rows[0];
    if (userId) {
      const userResult = await pool.query('SELECT username, avatar_url FROM users WHERE id = $1', [userId]);
      comment.username = userResult.rows[0]?.username ?? null;
      comment.avatar_url = userResult.rows[0]?.avatar_url ?? null;
    }

    logger.info(`Comment created: ${comment.id} on block ${blockHash.substring(0, 8)}...`);

    try {
      const docRows = await pool.query(
        `SELECT DISTINCT d.id AS document_id
         FROM document_blocks db
         JOIN documents d ON (d.id = db.document_id OR d.canonical_document_id = db.document_id)
         WHERE db.block_hash = $1`,
        [blockHash]
      );
      for (const row of docRows.rows) {
        broadcastToDocument(row.document_id, { type: 'new_comment', comment });
      }
    } catch {
      // SSE 广播失败不影响主流程，静默忽略
    }

    res.status(201).json({ comment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Create comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 更新评论
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = z.object({
      content: z.string().min(1).max(5000).optional(),
      isResolved: z.boolean().optional(),
    }).parse(req.body);
    const { isResolved } = parsed;
    let { content } = parsed;
    if (content !== undefined) content = cleanText(content, 5000);

    const { userId, isAdmin } = req.user!;

    const commentResult = await pool.query('SELECT user_id FROM comments WHERE id = $1 AND is_deleted = false', [id]);
    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (!isAdmin && commentResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Cannot update other users\' comments' });
    }

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
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, isAdmin } = req.user!;

    const commentRow = await pool.query('SELECT user_id, root_id FROM comments WHERE id = $1 AND is_deleted = false', [id]);

    if (commentRow.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const commentOwnerId = commentRow.rows[0].user_id;
    const rootId: string | null = commentRow.rows[0].root_id;

    if (!isAdmin && commentOwnerId !== userId) {
      return res.status(403).json({ error: 'Cannot delete other users\' comments' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "UPDATE comments SET is_deleted = true, content = '[Deleted]' WHERE id = $1",
        [id]
      );
      if (rootId) {
        await client.query(
          'UPDATE comments SET reply_count = GREATEST(0, reply_count - 1) WHERE id = $1',
          [rootId]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    logger.info(`Comment soft deleted: ${id} by user ${userId}`);
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    logger.error('Delete comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 点赞 / 取消点赞
router.post('/:id/like', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req.user as AuthPayload).userId;

    const commentRow = await pool.query(
      'SELECT block_hash, user_id, content FROM comments WHERE id = $1 AND is_deleted = false',
      [id]
    );
    if (commentRow.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    const blockHash: string = commentRow.rows[0].block_hash as string;
    const authorId: string | null = commentRow.rows[0].user_id ?? null;
    const content: string = commentRow.rows[0].content;

    const { isRedisAvailable, atomicToggleLike } = await import('../utils/likeCounter.js');
    if (await isRedisAvailable()) {
      const result = await atomicToggleLike(String(id), String(userId));

      Promise.resolve().then(async () => {
        try {
          const docRows = await pool.query(
            `SELECT DISTINCT d.id AS document_id
             FROM document_blocks db
             JOIN documents d ON (d.id = db.document_id OR d.canonical_document_id = db.document_id)
             WHERE db.block_hash = $1`,
            [blockHash]
          );
          for (const row of docRows.rows) {
            broadcastToDocument(row.document_id as string, { type: 'like_updated', commentId: id, likeCount: result.likeCount });
          }
        } catch {
          // SSE 广播失败不影响主流程，静默忽略
        }

        if (result.liked && authorId && authorId !== userId) {
          await sendLikeNotification({ userId, authorId, content, commentId: id, blockHash });
        }
      }).catch(err => logger.warn('Async like notification failed:', err));

      return res.json(result);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query('SELECT 1 FROM comments WHERE id = $1 FOR UPDATE', [id]);

      const existing = await client.query(
        'SELECT 1 FROM comment_likes WHERE comment_id = $1 AND user_id = $2',
        [id, userId]
      );

      let liked: boolean;
      let likeCount: number;

      if (existing.rows.length > 0) {
        await client.query('DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [id, userId]);
        const updated = await client.query(
          'UPDATE comments SET like_count = GREATEST(0, like_count - 1) WHERE id = $1 RETURNING like_count',
          [id]
        );
        liked = false;
        likeCount = updated.rows[0].like_count;
      } else {
        await client.query(
          `INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)
           ON CONFLICT (comment_id, user_id) DO NOTHING`,
          [id, userId]
        );
        const updated = await client.query(
          'UPDATE comments SET like_count = like_count + 1 WHERE id = $1 RETURNING like_count',
          [id]
        );
        liked = true;
        likeCount = updated.rows[0].like_count;
      }

      await client.query('COMMIT');

      const docRows = await pool.query(
        `SELECT DISTINCT d.id AS document_id
         FROM document_blocks db
         JOIN documents d ON (d.id = db.document_id OR d.canonical_document_id = db.document_id)
         WHERE db.block_hash = $1`,
        [blockHash]
      );
      for (const row of docRows.rows) {
        broadcastToDocument(row.document_id as string, { type: 'like_updated', commentId: id, likeCount });
      }

      if (liked && authorId && authorId !== userId) {
        await sendLikeNotification({ userId, authorId, content, commentId: id, blockHash });
      }

      res.json({ liked, likeCount });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Like comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as commentCrudRoutes };
