import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';
import { documentQueue } from '../config/queue.js';

const router: Router = Router();

// 上传文档验证 schema
const uploadSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string(),
});

// 从 Authorization header 解析当前登录用户信息
async function getCallerInfo(req: Request): Promise<{ userId: string | null; isAdmin: boolean }> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer dummy_token_')) {
    return { userId: null, isAdmin: false };
  }
  const userId = auth.replace('Bearer dummy_token_', '');
  try {
    const r = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (r.rows.length === 0) return { userId: null, isAdmin: false };
    return { userId, isAdmin: r.rows[0].is_admin === true };
  } catch {
    return { userId: null, isAdmin: false };
  }
}

// 列出用户文档
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, isAdmin } = await getCallerInfo(req);

    let result;
    if (isAdmin) {
      // 管理员看所有文档
      result = await pool.query(
        `SELECT d.id, d.title, d.word_count, d.block_count, d.status, d.created_at, d.updated_at,
                u.username as uploader
         FROM documents d
         LEFT JOIN users u ON d.user_id = u.id
         ORDER BY d.created_at DESC`
      );
    } else if (userId) {
      // 普通用户只看自己的
      result = await pool.query(
        `SELECT d.id, d.title, d.word_count, d.block_count, d.status, d.created_at, d.updated_at,
                u.username as uploader
         FROM documents d
         LEFT JOIN users u ON d.user_id = u.id
         WHERE d.user_id = $1
         ORDER BY d.created_at DESC`,
        [userId]
      );
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    res.json({ documents: result.rows });
  } catch (error) {
    logger.error('List documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取单个文档
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT d.id, d.title, d.word_count, d.block_count, d.status, d.created_at, d.updated_at,
              ARRAY_AGG(db.block_hash ORDER BY db.sequence_order) as block_hashes
       FROM documents d
       LEFT JOIN document_blocks db ON d.id = db.document_id
       WHERE d.id = $1
       GROUP BY d.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = result.rows[0];

    // 获取内容块
    const blocksResult = await pool.query(
      'SELECT block_hash, raw_content, word_count FROM content_blocks WHERE block_hash = ANY($1)',
      [doc.block_hashes]
    );

    const blocksMap = new Map(blocksResult.rows.map(b => [b.block_hash, b]));

    // 构建带内容的文档
    const content = doc.block_hashes
      .filter((h: string) => blocksMap.has(h))
      .map((h: string) => blocksMap.get(h));

    res.json({
      document: {
        id: doc.id,
        title: doc.title,
        word_count: doc.word_count,
        block_count: doc.block_count,
        status: doc.status,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
      },
      content,
    });
  } catch (error) {
    logger.error('Get document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取文档评论分布
router.get('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;

    // 获取文档的所有块
    const blocksResult = await pool.query(
      'SELECT block_hash FROM document_blocks WHERE document_id = $1',
      [id]
    );

    const blockHashes = blocksResult.rows.map(r => r.block_hash);

    if (blockHashes.length === 0) {
      return res.json({ comments: [], blockCommentCount: {} });
    }

    // 获取这些块的所有评论（含 like_count、liked_by_me）—— 只拉根评论
    const { userId } = await getCallerInfo(req);
    const commentsResult = await pool.query(
      `SELECT c.*, u.username, u.avatar_url,
              c.like_count,
              c.reply_count,
              CASE WHEN cl.user_id IS NOT NULL THEN true ELSE false END as liked_by_me
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN comment_likes cl ON cl.comment_id = c.id AND cl.user_id = $2
       WHERE c.block_hash = ANY($1) AND c.root_id IS NULL AND c.is_deleted = false
       ORDER BY c.created_at ASC`,
      [blockHashes, userId]
    );

    // 统计每个块的评论数
    const blockCommentCount: Record<string, number> = {};
    for (const hash of blockHashes) {
      blockCommentCount[hash] = commentsResult.rows.filter(c => c.block_hash === hash).length;
    }

    res.json({
      comments: commentsResult.rows,
      blockCommentCount,
    });
  } catch (error) {
    logger.error('Get document comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 上传/创建文档
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, content } = uploadSchema.parse(req.body);

    // 从 Authorization header 获取用户 ID
    const { userId } = await getCallerInfo(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 计算文件哈希 (用于秒传)
    const crypto = await import('crypto');
    const fileHash = crypto.createHash('md5').update(content).digest('hex');

    // 检查是否已存在相同文件（同一用户）
    const existing = await pool.query(
      'SELECT id FROM documents WHERE file_hash = $1 AND user_id = $2',
      [fileHash, userId]
    );

    if (existing.rows.length > 0) {
      logger.info(`Document already exists: ${fileHash}`);
      return res.json({
        document: existing.rows[0],
        message: 'Document already processed (quick upload)',
      });
    }

    // 创建文档记录
    const docResult = await pool.query(
      'INSERT INTO documents (user_id, title, file_hash, status, content) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at',
      [userId, title, fileHash, 'processing', content]
    );

    const docId = docResult.rows[0].id;

    // 将处理任务推入 BullMQ 队列，立即返回给前端
    // 只传 documentId，content 已存 DB，worker 直接读取避免大文本进 Redis
    await documentQueue.add('process-document', { documentId: docId });

    logger.info(`Document queued for processing: ${docId}`);

    res.json({
      document: {
        id: docId,
        title,
        word_count: content.length,   // 字符数作为初始估算值
        block_count: 0,
        status: 'processing',
        created_at: docResult.rows[0].created_at,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Create document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 删除文档
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM documents WHERE id = $1', [id]);

    logger.info(`Document deleted: ${id}`);
    res.json({ message: 'Document deleted' });
  } catch (error) {
    logger.error('Delete document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as documentRoutes };
