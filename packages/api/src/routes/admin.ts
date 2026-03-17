import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { pool } from '../config/database.js';

const router: Router = Router();

// 所有管理员路由都需要认证和管理员权限
router.use(authenticate, requireAdmin);

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get system statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [usersResult, docsResult, commentsResult, blocksResult] = await Promise.all([
      pool.query('SELECT COUNT(*) as count, COUNT(*) FILTER (WHERE is_admin = true) as admin_count FROM users'),
      pool.query(`SELECT
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE status = 'ready') as ready_count,
        COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
        COUNT(*) FILTER (WHERE status = 'error') as error_count,
        COALESCE(SUM(word_count), 0) as total_words
      FROM documents`),
      pool.query('SELECT COUNT(*) as count FROM comments WHERE is_deleted = false'),
      pool.query('SELECT COUNT(*) as count FROM content_blocks'),
    ]);

    const recentUsersResult = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE created_at >= NOW() - INTERVAL \'7 days\''
    );
    const recentDocsResult = await pool.query(
      'SELECT COUNT(*) as count FROM documents WHERE created_at >= NOW() - INTERVAL \'7 days\''
    );
    const recentCommentsResult = await pool.query(
      'SELECT COUNT(*) as count FROM comments WHERE created_at >= NOW() - INTERVAL \'7 days\' AND is_deleted = false'
    );

    res.json({
      users: {
        total: parseInt(usersResult.rows[0].count),
        admins: parseInt(usersResult.rows[0].admin_count),
        recent: parseInt(recentUsersResult.rows[0].count),
      },
      documents: {
        total: parseInt(docsResult.rows[0].total_count),
        ready: parseInt(docsResult.rows[0].ready_count),
        processing: parseInt(docsResult.rows[0].processing_count),
        error: parseInt(docsResult.rows[0].error_count),
        totalWords: parseInt(docsResult.rows[0].total_words),
        recent: parseInt(recentDocsResult.rows[0].count),
      },
      comments: {
        total: parseInt(commentsResult.rows[0].count),
        recent: parseInt(recentCommentsResult.rows[0].count),
      },
      blocks: {
        total: parseInt(blocksResult.rows[0].count),
      },
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string || '').trim();
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        id, email, username, avatar_url, is_admin, email_verified,
        created_at, updated_at,
        (SELECT COUNT(*) FROM documents WHERE user_id = users.id) as document_count,
        (SELECT COUNT(*) FROM comments WHERE user_id = users.id AND is_deleted = false) as comment_count
      FROM users
    `;
    const params: any[] = [];

    if (search) {
      query += ` WHERE email ILIKE $1 OR username ILIKE $1`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [usersResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(
        search
          ? 'SELECT COUNT(*) FROM users WHERE email ILIKE $1 OR username ILIKE $1'
          : 'SELECT COUNT(*) FROM users',
        search ? [`%${search}%`] : []
      ),
    ]);

    res.json({
      users: usersResult.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

/**
 * @swagger
 * /api/admin/users/{id}:
 *   put:
 *     summary: Update user (toggle admin status)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_admin:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated
 */
router.put('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateSchema = z.object({
      is_admin: z.boolean().optional(),
    });

    const data = updateSchema.parse(req.body);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Prevent self-demotion
    if (data.is_admin === false && req.user?.userId === id) {
      return res.status(400).json({ error: 'Cannot remove your own admin status' });
    }

    const fields = Object.keys(data).map((key, idx) => `${key} = $${idx + 2}`).join(', ');
    const values = Object.values(data);

    const result = await pool.query(
      `UPDATE users SET ${fields} WHERE id = $1 RETURNING id, email, username, is_admin`,
      [id, ...values]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Delete user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted
 */
router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (req.user?.userId === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * @swagger
 * /api/admin/documents:
 *   get:
 *     summary: Get all documents
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [processing, ready, error]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of documents
 */
router.get('/documents', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string;
    const search = (req.query.search as string || '').trim();
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        d.id, d.title, d.status, d.word_count, d.block_count,
        d.created_at, d.updated_at,
        u.username as uploader, u.email as uploader_email,
        (SELECT COUNT(*) FROM comments c
         JOIN document_blocks db ON c.block_hash = db.block_hash
         WHERE db.document_id = d.id AND c.is_deleted = false) as comment_count
      FROM documents d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      params.push(status);
      query += ` AND d.status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (d.title ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }

    query += ` ORDER BY d.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const countQuery = `
      SELECT COUNT(*) FROM documents d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE 1=1
      ${status ? ` AND d.status = $1` : ''}
      ${search ? ` AND (d.title ILIKE $${status ? '2' : '1'} OR u.username ILIKE $${status ? '2' : '1'} OR u.email ILIKE $${status ? '2' : '1'})` : ''}
    `;
    const countParams = [];
    if (status) countParams.push(status);
    if (search) countParams.push(`%${search}%`);

    const [docsResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams),
    ]);

    res.json({
      documents: docsResult.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (err) {
    console.error('Get documents error:', err);
    res.status(500).json({ error: 'Failed to get documents' });
  }
});

/**
 * @swagger
 * /api/admin/documents/{id}:
 *   delete:
 *     summary: Delete document
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document deleted
 */
router.delete('/documents/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    console.error('Delete document error:', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

/**
 * @swagger
 * /api/admin/comments:
 *   get:
 *     summary: Get all comments
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of comments
 */
router.get('/comments', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string || '').trim();
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        c.id, c.content, c.selected_text, c.like_count, c.reply_count,
        c.is_deleted, c.created_at,
        u.username, u.email,
        cb.raw_content as block_content
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN content_blocks cb ON c.block_hash = cb.block_hash
      WHERE c.is_deleted = false
    `;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (c.content ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const countQuery = `
      SELECT COUNT(*) FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.is_deleted = false
      ${search ? ` AND (c.content ILIKE $1 OR u.username ILIKE $1 OR u.email ILIKE $1)` : ''}
    `;

    const [commentsResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, search ? [`%${search}%`] : []),
    ]);

    res.json({
      comments: commentsResult.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

/**
 * @swagger
 * /api/admin/comments/{id}:
 *   delete:
 *     summary: Delete comment
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment deleted
 */
router.delete('/comments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE comments SET is_deleted = true WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json({ message: 'Comment deleted successfully' });
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export { router as adminRoutes };
