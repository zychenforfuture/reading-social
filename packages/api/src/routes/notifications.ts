import express, { Request, Response, Router } from 'express';
import { pool } from '../config/database.js';
import { notificationQueue, NotificationJobData } from '../config/notificationQueue.js';
import { authenticate } from '../middleware/auth.js';

const router: Router = express.Router();

// 所有通知路由都需要认证
router.use(authenticate);

// 获取当前用户的通知列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const unreadOnly = req.query.unread === 'true';

    const query = `
      SELECT id, type, title, content, data, is_read, created_at
      FROM notifications
      WHERE user_id = $1 ${unreadOnly ? 'AND is_read = FALSE' : ''}
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [userId, limit]);

    res.json({
      notifications: result.rows,
      unreadCount: unreadOnly ? result.rows.length : 0,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// 获取未读通知数量
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [userId]
    );

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// 标记单个通知为已读
router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = TRUE 
       WHERE id = $1 AND user_id = $2 
       RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// 标记所有通知为已读
router.put('/read-all', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
      [userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// 删除通知
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// 创建通知（内部使用或管理员）
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, type, title, content, data, sendTelegram } = req.body;

    if (!userId || !type || !title) {
      return res.status(400).json({ error: 'Missing required fields: userId, type, title' });
    }

    // 添加到队列（异步处理）
    const jobData: NotificationJobData = {
      userId,
      type,
      title,
      content,
      data,
      sendTelegram: sendTelegram || false,
    };

    await notificationQueue.add('send-notification', jobData);

    // 同时直接插入数据库（确保通知立即可见）
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, title, content, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, type, title, content, data, is_read, created_at`,
      [userId, type, title, content || null, JSON.stringify(data || {})]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

export { router as notificationRoutes };
