import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';

export type NotificationType = 'reply' | 'mention' | 'like';

/**
 * 创建通知（fire-and-forget 安全包装，内部捕获所有错误）
 */
export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  content?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, content, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        params.userId,
        params.type,
        params.title,
        params.content ?? null,
        JSON.stringify(params.data ?? {}),
      ]
    );
  } catch (err) {
    logger.error('Failed to create notification:', err);
  }
}
