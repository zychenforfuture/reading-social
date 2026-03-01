import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';

const router: Router = Router();

// ─── DB 迁移（首次启动自动执行）────────────────────────────────────
;(async () => {
  try {
    await pool.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comment_likes (
        comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
        user_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (comment_id, user_id)
      )
    `);
    // 二级回复结构迁移
    await pool.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS root_id UUID REFERENCES comments(id) ON DELETE CASCADE`);
    await pool.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS reply_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS reply_count INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_comments_root_id ON comments(root_id)`);
    // 修正存量 reply_count（重新按实际未删除回复数对齐，幂等）
    await pool.query(`
      UPDATE comments c
      SET reply_count = (
        SELECT COUNT(*) FROM comments r
        WHERE r.root_id = c.id AND r.is_deleted = false
      )
      WHERE c.root_id IS NULL
    `);
    logger.info('comment_likes migration OK');
  } catch (err) {
    logger.error('comment_likes migration failed:', err);
  }
})();
// ────────────────────────────────────────────────────────────────

// ─── SSE 客户端注册表 ────────────────────────────────────────────
// documentId → Set<Response>（存每个打开文档的长连接）
const sseClients = new Map<string, Set<Response>>();

function addSseClient(documentId: string, res: Response): void {
  if (!sseClients.has(documentId)) sseClients.set(documentId, new Set());
  sseClients.get(documentId)!.add(res);
}

function removeSseClient(documentId: string, res: Response): void {
  const clients = sseClients.get(documentId);
  if (clients) {
    clients.delete(res);
    if (clients.size === 0) sseClients.delete(documentId);
  }
}

function broadcastToDocument(documentId: string, data: object): void {
  const clients = sseClients.get(documentId);
  if (!clients || clients.size === 0) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { /* 客户端已断开 */ }
  }
}
// ────────────────────────────────────────────────────────────────

// 从 Authorization header 解析当前用户 ID
async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer dummy_token_')) return null;
  const userId = auth.replace('Bearer dummy_token_', '');
  try {
    const r = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    return r.rows.length > 0 ? userId : null;
  } catch {
    return null;
  }
}

const commentSchema = z.object({
  content: z.string().min(1).max(5000),
  blockHash: z.string().length(64).optional(), // 根评论必填
  rootId: z.string().uuid().optional(),         // 回复时必填
  replyToUserId: z.string().uuid().optional(),  // @某人（可选）
  selectedText: z.string().max(500).optional(),
  // 小兴容旧字段
  parentCommentId: z.string().uuid().optional(),
});

// SSE 推送：订阅文档的实时评论更新
router.get('/stream/:documentId', (req: Request, res: Response) => {
  const documentId = String(req.params['documentId'] ?? '');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 关闭 nginx 缓冲，SSE 立即推送
  res.flushHeaders();

  // 初始心跳确认连接建立
  res.write(': connected\n\n');

  addSseClient(documentId, res);
  logger.info(`SSE connected: doc=${documentId.substring(0, 8)}… clients=${sseClients.get(documentId)?.size}`);

  // 每 25s 发心跳，防止 nginx/负载均衡器因空闲超时断开连接
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(heartbeat); }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeSseClient(documentId, res);
    logger.info(`SSE disconnected: doc=${documentId.substring(0, 8)}…`);
  });
});

// 获取根评论下的所有回复（二级扁平）
router.get('/:id/replies', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = await getUserId(req); // 可为 null
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
      [id, userId ?? null]
    );
    res.json({ replies: result.rows });
  } catch (error) {
    logger.error('Get replies error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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

// 创建评论（根评论或回复）
router.post('/', async (req: Request, res: Response) => {
  try {
    const { content, blockHash, rootId, replyToUserId, selectedText } = commentSchema.parse(req.body);

    const userId = await getUserId(req);

    // 确保列存在（兼容旧数据库）
    await pool.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS selected_text VARCHAR(500)`).catch(() => {});

    if (rootId) {
      // ───── 回复模式 ─────
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 从根评论继承 block_hash
        const rootRow = await client.query(
          'SELECT block_hash FROM comments WHERE id = $1 AND root_id IS NULL AND is_deleted = false',
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

        // 根评论 reply_count +1
        await client.query('UPDATE comments SET reply_count = reply_count + 1 WHERE id = $1', [rootId]);
        await client.query('COMMIT');

        const reply = result.rows[0];
        if (userId) {
          const u = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
          reply.username = u.rows[0]?.username ?? null;
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
            broadcastToDocument(row.document_id, { type: 'new_reply', rootId, reply });
          }
        } catch { /* 广播失败不影响响应 */ }

        return res.status(201).json({ comment: reply });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // ───── 根评论模式 ─────
    if (!blockHash) {
      return res.status(400).json({ error: 'blockHash is required for root comments' });
    }

    const result = await pool.query(
      `INSERT INTO comments (block_hash, user_id, content, selected_text)
       VALUES ($1, $2, $3, $4)
       RETURNING id, block_hash, user_id, content, selected_text, reply_count, created_at`,
      [blockHash, userId, content, selectedText || null]
    );

    const comment = result.rows[0];
    if (userId) {
      const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
      comment.username = userResult.rows[0]?.username ?? null;
    }

    logger.info(`Comment created: ${comment.id} on block ${blockHash.substring(0, 8)}...`);

    try {
      const docRows = await pool.query(
        'SELECT DISTINCT document_id FROM document_blocks WHERE block_hash = $1',
        [blockHash]
      );
      for (const row of docRows.rows) {
        broadcastToDocument(row.document_id, { type: 'new_comment', comment });
      }
    } catch { /* 广播失败不影响正常响应 */ }

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

// 删除评论 (软删除) — 只能删自己的，管理员可删所有
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 查评论归属 + 当前用户是否管理员
    const [commentRow, userRow] = await Promise.all([
      pool.query('SELECT user_id, root_id FROM comments WHERE id = $1 AND is_deleted = false', [id]),
      pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]),
    ]);

    if (commentRow.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const isAdmin = userRow.rows[0]?.is_admin === true;
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
      // 如果是回复，根评论 reply_count -1
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

// 点赞 / 取消点赞（toggle）
router.post('/:id/like', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 查评论（需要 block_hash 用于广播）
      const commentRow = await client.query(
        'SELECT block_hash FROM comments WHERE id = $1 AND is_deleted = false',
        [id]
      );
      if (commentRow.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Comment not found' });
      }
      const blockHash: string = commentRow.rows[0].block_hash;

      // 判断是否已点赞
      const existing = await client.query(
        'SELECT 1 FROM comment_likes WHERE comment_id = $1 AND user_id = $2',
        [id, userId]
      );

      let liked: boolean;
      let likeCount: number;

      if (existing.rows.length > 0) {
        // 取消点赞
        await client.query('DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [id, userId]);
        const updated = await client.query(
          'UPDATE comments SET like_count = GREATEST(0, like_count - 1) WHERE id = $1 RETURNING like_count',
          [id]
        );
        liked = false;
        likeCount = updated.rows[0].like_count;
      } else {
        // 点赞
        await client.query('INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)', [id, userId]);
        const updated = await client.query(
          'UPDATE comments SET like_count = like_count + 1 WHERE id = $1 RETURNING like_count',
          [id]
        );
        liked = true;
        likeCount = updated.rows[0].like_count;
      }

      await client.query('COMMIT');

      // 广播到所有包含该 block 的文档（跨文档实时同步）
      try {
        const docRows = await pool.query(
          'SELECT DISTINCT document_id FROM document_blocks WHERE block_hash = $1',
          [blockHash]
        );
        for (const row of docRows.rows) {
          broadcastToDocument(row.document_id, { type: 'like_updated', commentId: id, likeCount });
        }
      } catch { /* 广播失败不影响正常响应 */ }

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

export { router as commentRoutes };
