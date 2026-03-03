import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';
import { documentQueue } from '../config/queue.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);
const pdfParse = _require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number }>;

const PDFS_DIR = process.env.PDFS_DIR || '/app/pdfs';
if (!fs.existsSync(PDFS_DIR)) fs.mkdirSync(PDFS_DIR, { recursive: true });

// multer：存内存，上传后自己写文件（需要先算 hash）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('只支持 PDF 文件'));
    }
  },
});

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
        `SELECT d.id, d.title, d.word_count, d.block_count, d.status, d.source_type, d.created_at, d.updated_at,
                u.username as uploader
         FROM documents d
         LEFT JOIN users u ON d.user_id = u.id
         ORDER BY d.created_at DESC`
      );
    } else if (userId) {
      // 普通用户只看自己的
      result = await pool.query(
        `SELECT d.id, d.title, d.word_count, d.block_count, d.status, d.source_type, d.created_at, d.updated_at,
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
    // 支持分页：offset + limit，默认一次最多返回 2000 块
    const offset = Math.max(0, parseInt((req.query.offset as string) || '0', 10));
    const limit  = Math.min(5000, Math.max(1, parseInt((req.query.limit  as string) || '2000', 10)));

    const docResult = await pool.query(
      `SELECT id, title, word_count, block_count, status, source_type, created_at, updated_at
       FROM documents WHERE id = $1`,
      [id]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = docResult.rows[0];

    // 直接 JOIN，避免把数十万个 hash 塞进 ANY($1)
    const blocksResult = await pool.query(
      `SELECT cb.block_hash, cb.raw_content, cb.word_count
       FROM document_blocks db
       JOIN content_blocks cb ON db.block_hash = cb.block_hash
       WHERE db.document_id = $1
       ORDER BY db.sequence_order
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    res.json({
      document: {
        id: doc.id,
        title: doc.title,
        word_count: doc.word_count,
        block_count: doc.block_count,
        status: doc.status,
        source_type: doc.source_type ?? 'text',
        created_at: doc.created_at,
        updated_at: doc.updated_at,
      },
      content: blocksResult.rows,
      pagination: {
        offset,
        limit,
        total: doc.block_count,
        hasMore: offset + limit < doc.block_count,
      },
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

// ─── PDF 相关路由（放在 export 后面，挂载到同一 router）─────────────────────

// 上传 PDF 文档
router.post('/upload-pdf', upload.single('pdf'), async (req: Request, res: Response) => {
  try {
    const { userId } = await getCallerInfo(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!req.file) return res.status(400).json({ error: '请上传 PDF 文件' });

    const fileBuffer = req.file.buffer;

    // SHA-256 文件哈希（跨用户去重）
    const crypto = await import('crypto');
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 检查是否已存在
    const existing = await pool.query(
      'SELECT id, title FROM documents WHERE file_hash = $1',
      [fileHash]
    );
    if (existing.rows.length > 0) {
      return res.json({ document: existing.rows[0], existed: true });
    }

    // 保存 PDF 文件
    const pdfPath = `${fileHash}.pdf`;
    fs.writeFileSync(path.join(PDFS_DIR, pdfPath), fileBuffer);

    // 用 pdf-parse 提取纯文本（供 Worker 分块）
    const pdfData = await pdfParse(fileBuffer);
    const rawText = pdfData.text;

    // 文档标题：优先用表单 title 字段，其次用文件名
    const title = ((req.body?.title as string) || req.file.originalname.replace(/\.pdf$/i, '')).trim();

    const docResult = await pool.query(
      `INSERT INTO documents (user_id, title, file_hash, status, content, source_type, pdf_path)
       VALUES ($1, $2, $3, 'processing', $4, 'pdf', $5)
       RETURNING id, created_at`,
      [userId, title, fileHash, rawText, pdfPath]
    );
    const docId = docResult.rows[0].id;

    // 与 TXT 走同一个 Worker 队列
    await documentQueue.add('process-document', { documentId: docId });
    logger.info(`PDF document queued: ${docId} (${pdfData.numpages} pages)`);

    res.json({
      document: {
        id: docId,
        title,
        status: 'processing',
        source_type: 'pdf',
        created_at: docResult.rows[0].created_at,
      },
      existed: false,
    });
  } catch (error) {
    logger.error('PDF upload error:', error);
    res.status(500).json({ error: 'PDF 上传失败' });
  }
});

// 提供 PDF 文件下载/预览
router.get('/:id/pdf', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT pdf_path, title FROM documents WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0 || !result.rows[0].pdf_path) {
      return res.status(404).json({ error: 'PDF not found' });
    }
    const fullPath = path.join(PDFS_DIR, result.rows[0].pdf_path);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'PDF file missing on disk' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(result.rows[0].title)}.pdf"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(fullPath).pipe(res);
  } catch (error) {
    logger.error('PDF serve error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── 数据库迁移（module 加载时自动执行）──────────────────────────────────────
async function runDocumentMigration() {
  try {
    await pool.query(`
      ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS source_type VARCHAR(10) DEFAULT 'text',
        ADD COLUMN IF NOT EXISTS pdf_path TEXT;
    `);
    logger.info('Document migration: source_type + pdf_path ready');
  } catch (err) {
    logger.error('Document migration error:', err);
  }
}
runDocumentMigration();
