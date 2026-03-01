import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';

const router: Router = Router();

// 上传文档验证 schema
const uploadSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string(),
});

/** 从 Authorization header 解析当前用户 ID（与 comment 路由一致） */
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

// 列出文档（公共，按时间倒序；管理员看到上传者信息）
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    let isAdmin = false;
    if (userId) {
      const r = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
      isAdmin = r.rows[0]?.is_admin === true;
    }

    const result = await pool.query(
      `SELECT d.id, d.title, d.word_count, d.block_count, d.status, d.created_at, d.updated_at,
              d.user_id,
              ${isAdmin ? 'u.username AS uploader' : 'NULL::text AS uploader'}
       FROM documents d
       LEFT JOIN users u ON d.user_id = u.id
       ORDER BY d.created_at DESC`,
    );

    res.json({ documents: result.rows });
  } catch (error) {
    logger.error('List documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取单个文档
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT d.id, d.title, d.word_count, d.block_count, d.status, d.created_at, d.updated_at,
              ARRAY_AGG(db.block_hash ORDER BY db.sequence_order) as block_hashes
       FROM documents d
       LEFT JOIN document_blocks db ON d.id = db.document_id
       WHERE d.id = $1
       GROUP BY d.id`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = result.rows[0];

    // 获取内容块
    const blocksResult = await pool.query(
      'SELECT block_hash, raw_content, word_count FROM content_blocks WHERE block_hash = ANY($1)',
      [doc.block_hashes],
    );

    const blocksMap = new Map(blocksResult.rows.map((b) => [b.block_hash, b]));

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

// 获取文档评论分布（包含 like_count、liked_by_me、root_id）
router.get('/:id/comments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = await getUserId(req);

    const blocksResult = await pool.query(
      'SELECT block_hash FROM document_blocks WHERE document_id = $1',
      [id],
    );

    const blockHashes = blocksResult.rows.map((r) => r.block_hash);

    if (blockHashes.length === 0) {
      return res.json({ comments: [], blockCommentCount: {} });
    }

    const commentsResult = await pool.query(
      `SELECT c.id, c.block_hash, c.user_id, c.content, c.selected_text,
              c.is_resolved, c.like_count, c.reply_count,
              c.root_id, c.reply_to_user_id, c.created_at, c.updated_at,
              u.username, u.avatar_url,
              ru.username AS reply_to_username,
              CASE WHEN cl.user_id IS NOT NULL THEN true ELSE false END AS liked_by_me
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN users ru ON ru.id = c.reply_to_user_id
       LEFT JOIN comment_likes cl ON cl.comment_id = c.id AND cl.user_id = $2
       WHERE c.block_hash = ANY($1) AND c.is_deleted = false
       ORDER BY c.created_at ASC`,
      [blockHashes, userId ?? null],
    );

    // 只有根评论（root_id IS NULL）计入 blockCommentCount
    const blockCommentCount: Record<string, number> = {};
    for (const hash of blockHashes) {
      blockCommentCount[hash] = commentsResult.rows.filter(
        (c) => c.block_hash === hash && !c.root_id,
      ).length;
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
    const userId = await getUserId(req);

    const crypto = await import('crypto');
    const fileHash = crypto.createHash('md5').update(content).digest('hex');

    // 秒传：同一用户+同一文件哈希
    const existing = await pool.query(
      'SELECT id FROM documents WHERE file_hash = $1 AND user_id IS NOT DISTINCT FROM $2',
      [fileHash, userId],
    );

    if (existing.rows.length > 0) {
      logger.info(`Document already exists: ${fileHash}`);
      return res.json({
        document: existing.rows[0],
        message: 'Document already processed (quick upload)',
      });
    }

    const docResult = await pool.query(
      'INSERT INTO documents (user_id, title, file_hash, status, content) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at',
      [userId, title, fileHash, 'processing', content],
    );

    const docId = docResult.rows[0].id;

    const blocks = content
      .split(/\r?\n/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0);

    for (let i = 0; i < blocks.length; i++) {
      const blockContent = blocks[i]!.trim();
      const blockHash = crypto.createHash('sha256').update(blockContent).digest('hex');

      await pool.query(
        `INSERT INTO content_blocks (block_hash, raw_content, normalized_content, word_count)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (block_hash) DO UPDATE SET occurrence_count = content_blocks.occurrence_count + 1`,
        [blockHash, blockContent, blockContent, blockContent.length],
      );

      await pool.query(
        'INSERT INTO document_blocks (document_id, block_hash, sequence_order) VALUES ($1, $2, $3)',
        [docId, blockHash, i],
      );
    }

    await pool.query(
      'UPDATE documents SET word_count = $1, block_count = $2, status = $3 WHERE id = $4',
      [content.length, blocks.length, 'ready', docId],
    );

    logger.info(`Document created: ${docId}, blocks: ${blocks.length}, user: ${userId ?? 'anonymous'}`);

    res.json({
      document: {
        id: docId,
        title,
        word_count: content.length,
        block_count: blocks.length,
        status: 'ready',
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

// 删除文档（仅创建者或管理员）
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = await getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [docRow, userRow] = await Promise.all([
      pool.query('SELECT user_id FROM documents WHERE id = $1', [id]),
      pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]),
    ]);

    if (docRow.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const isAdmin = userRow.rows[0]?.is_admin === true;
    const docOwnerId = docRow.rows[0].user_id;

    if (!isAdmin && docOwnerId !== userId) {
      return res.status(403).json({ error: 'Cannot delete other users\' documents' });
    }

    await pool.query('DELETE FROM documents WHERE id = $1', [id]);

    logger.info(`Document deleted: ${id} by user ${userId}`);
    res.json({ message: 'Document deleted' });
  } catch (error) {
    logger.error('Delete document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as documentRoutes };

