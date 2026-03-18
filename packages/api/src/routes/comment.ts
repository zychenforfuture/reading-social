import { Router, type Request, type Response } from 'express';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';
import { addSseClient, removeSseClient } from './comment.sse.js';
import { commentCrudRoutes } from './comment.crud.js';

const router: Router = Router();

// DB 迁移（首次启动自动执行）
(async () => {
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
    await pool.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS root_id UUID REFERENCES comments(id) ON DELETE CASCADE`);
    await pool.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS reply_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS reply_count INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_comments_root_id ON comments(root_id)`);
    await pool.query(`
      UPDATE comments c
      SET reply_count = (
        SELECT COUNT(*) FROM comments r
        WHERE r.root_id = c.id AND r.is_deleted = false
      )
      WHERE c.root_id IS NULL
    `);
    await pool.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS selected_text VARCHAR(500)`);
    await pool.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS sentence_hash VARCHAR(64)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_comments_sentence_hash ON comments(sentence_hash)`);
    await pool.query(`
      UPDATE comments SET sentence_hash = md5(
        regexp_replace(
          regexp_replace(trim(selected_text), '[\\s\\u3000]+', '', 'g'),
          '[^\\u4e00-\\u9fa5\\u3040-\\u30ff\\uac00-\\ud7af\\w]', '', 'g'
        )
      )
      WHERE selected_text IS NOT NULL
    `);
    logger.info('comment_likes migration OK');
  } catch (err) {
    logger.error('comment_likes migration failed:', err);
  }
})();

// SSE 推送：订阅文档的实时评论更新
router.get('/stream/:documentId', (req: Request, res: Response) => {
  const documentId = String(req.params['documentId'] ?? '');

  const added = addSseClient(documentId, res);
  if (!added) {
    res.status(503).json({ error: 'Too many connections to this document' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(': connected\n\n');

  logger.info(`SSE connected: doc=${documentId.substring(0, 8)}…`);

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearInterval(heartbeat);
    removeSseClient(documentId, res);
    logger.info(`SSE disconnected: doc=${documentId.substring(0, 8)}…`);
  };

  req.socket.on('close', cleanup);
  res.on('close', cleanup);
});

// 挂载 CRUD 路由
router.use('/', commentCrudRoutes);

export { router as commentRoutes };