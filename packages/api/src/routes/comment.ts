import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';

const router: Router = Router();

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
  blockHash: z.string().length(64), // SHA-256 hex
  parentCommentId: z.string().uuid().optional(),
  selectedText: z.string().max(500).optional(),
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
router.post('/', async (req: Request, res: Response) => {
  try {
    const { content, blockHash, parentCommentId, selectedText } = commentSchema.parse(req.body);

    const userId = await getUserId(req);

    // 确保 selected_text 列存在（兼容旧数据库）
    await pool.query(`
      ALTER TABLE comments ADD COLUMN IF NOT EXISTS selected_text VARCHAR(500)
    `).catch(() => {});

    const result = await pool.query(
      `INSERT INTO comments (block_hash, user_id, content, parent_comment_id, selected_text)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, block_hash, user_id, content, parent_comment_id, selected_text, created_at`,
      [blockHash, userId, content, parentCommentId || null, selectedText || null]
    );

    // 补充 username
    const comment = result.rows[0];
    if (userId) {
      const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
      comment.username = userResult.rows[0]?.username ?? null;
    }

    logger.info(`Comment created: ${comment.id} on block ${blockHash.substring(0, 8)}...`);

    // 广播到所有订阅了含该 block 的文档的 SSE 客户端
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
      pool.query('SELECT user_id FROM comments WHERE id = $1 AND is_deleted = false', [id]),
      pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]),
    ]);

    if (commentRow.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const isAdmin = userRow.rows[0]?.is_admin === true;
    const commentOwnerId = commentRow.rows[0].user_id;

    if (!isAdmin && commentOwnerId !== userId) {
      return res.status(403).json({ error: 'Cannot delete other users\' comments' });
    }

    await pool.query(
      "UPDATE comments SET is_deleted = true, content = '[Deleted]' WHERE id = $1",
      [id]
    );

    logger.info(`Comment soft deleted: ${id} by user ${userId}`);
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    logger.error('Delete comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as commentRoutes };
