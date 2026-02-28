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

// 列出用户文档
router.get('/', async (req, res) => {
  try {
    // TODO: 从 JWT 获取用户 ID，暂时返回所有未绑定用户的文档
    const result = await pool.query(
      'SELECT id, title, word_count, block_count, status, created_at, updated_at FROM documents WHERE user_id IS NULL ORDER BY created_at DESC'
    );

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

    // 获取这些块的所有评论
    const commentsResult = await pool.query(
      `SELECT c.*, u.username, u.avatar_url,
              (SELECT COUNT(*) FROM comments c2 WHERE c2.parent_comment_id = c.id) as reply_count
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.block_hash = ANY($1) AND c.is_deleted = false
       ORDER BY c.created_at ASC`,
      [blockHashes]
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
router.post('/', async (req, res) => {
  try {
    const { title, content } = uploadSchema.parse(req.body);

    // TODO: 从 JWT 获取用户 ID，暂时使用 NULL
    const userId = null;

    // 计算文件哈希 (用于秒传)
    const crypto = await import('crypto');
    const fileHash = crypto.createHash('md5').update(content).digest('hex');

    // 检查是否已存在相同文件
    const existing = await pool.query(
      'SELECT id FROM documents WHERE file_hash = $1 AND user_id IS NOT DISTINCT FROM $2',
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

    // 按自然段（单行换行）切分，去除 \r 和空行
    const blocks = content.split(/\r?\n/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);

    for (let i = 0; i < blocks.length; i++) {
      const blockContent = blocks[i]!.trim();
      const blockHash = crypto.createHash('sha256').update(blockContent).digest('hex');

      // 插入或更新内容块
      await pool.query(
        `INSERT INTO content_blocks (block_hash, raw_content, normalized_content, word_count)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (block_hash) DO UPDATE SET occurrence_count = content_blocks.occurrence_count + 1`,
        [blockHash, blockContent, blockContent, blockContent.length]
      );

      // 插入文档 - 块映射
      await pool.query(
        'INSERT INTO document_blocks (document_id, block_hash, sequence_order) VALUES ($1, $2, $3)',
        [docId, blockHash, i]
      );
    }

    // 更新文档状态
    await pool.query(
      'UPDATE documents SET word_count = $1, block_count = $2, status = $3 WHERE id = $4',
      [content.length, blocks.length, 'ready', docId]
    );

    logger.info(`Document created: ${docId}, blocks: ${blocks.length}`);

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
