import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';
import { authenticate } from '../middleware/auth.js';

const router: Router = Router();

// ─── DB 迁移（首次启动自动执行）────────────────────────────────────
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type         VARCHAR(50)  NOT NULL,          -- reply | mention | like
        title        VARCHAR(200) NOT NULL,
        content      TEXT,
        data         JSONB        NOT NULL DEFAULT '{}',
        is_read      BOOLEAN      NOT NULL DEFAULT false,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user
        ON notifications(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_unread
        ON notifications(user_id) WHERE is_read = false;
    `);
    logger.info('Notifications table ready');
  } catch (err) {
    logger.error('Notifications migration error:', err);
  }
})();

// ─── 固定路由（必须在 /:id 参数路由之前注册）────────────────────────

// GET /unread-count — 未读数角标用
router.get('/unread-count', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!;
    const result = await pool.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (error) {
    logger.error('Get unread count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /read-all — 全部标记已读
router.put('/read-all', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!;
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    logger.error('Read all notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /read-batch — 批量标记已读
router.put('/read-batch', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!;
    const { ids } = z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(req.body);
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE id = ANY($1::uuid[]) AND user_id = $2`,
      [ids, userId]
    );
    res.json({ message: 'OK' });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed' });
    logger.error('Read batch notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /batch — 批量删除（用 POST body 避免 DELETE 带 body 的兼容性问题）
router.post('/delete-batch', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!;
    const { ids } = z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(req.body);
    await pool.query(
      `DELETE FROM notifications WHERE id = ANY($1::uuid[]) AND user_id = $2`,
      [ids, userId]
    );
    res.json({ message: 'OK' });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed' });
    logger.error('Delete batch notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── 列表与 CRUD ────────────────────────────────────────────────────

// GET / — 获取通知列表（支持 unread=true|false 筛选，分页）
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!;
    const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit  as string || '20', 10)));
    const offset = Math.max(0,              parseInt(req.query.offset as string || '0',  10));
    const unreadParam = req.query.unread;

    let readFilter = '';
    if (unreadParam === 'true')  readFilter = 'AND is_read = false';
    if (unreadParam === 'false') readFilter = 'AND is_read = true';

    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT * FROM notifications WHERE user_id = $1 ${readFilter}
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM notifications WHERE user_id = $1 ${readFilter}`,
        [userId]
      ),
    ]);

    res.json({
      notifications: rows.rows,
      total: parseInt(countRow.rows[0].count, 10),
    });
  } catch (error) {
    logger.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id/read — 标记单条已读
router.put('/:id/read', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!;
    const { id } = req.params;
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    res.json({ message: 'OK' });
  } catch (error) {
    logger.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id — 删除单条
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!;
    const { id } = req.params;
    await pool.query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    res.json({ message: 'OK' });
  } catch (error) {
    logger.error('Delete notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as notificationRoutes };
