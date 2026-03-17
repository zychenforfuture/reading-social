import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';
import { sendOTPEmail } from '../utils/email.js';
import { generateToken, authenticate } from '../middleware/auth.js';

const router: Router = Router();

const SALT_ROUNDS = 10;

// 启动时执行迁移，添加邮箱验证字段及 OTP 表
async function runMigration() {
  try {
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS verification_token VARCHAR(64),
        ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMPTZ;
    `);
    // 将老用户标记为已验证，避免影响现有账号
    await pool.query(`
      UPDATE users SET email_verified = true
      WHERE email_verified IS NULL OR email_verified = false
        AND verification_token IS NULL;
    `);
    // OTP 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_otps (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        purpose VARCHAR(20) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_email_otps_email_purpose ON email_otps(email, purpose);
    `);
    // 将 avatar_url 字段扩展为 TEXT（支持 base64 图片）
    await pool.query(`
      ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT;
    `);
    // 为 SimHash LSH 加 4 个 band 列（如已存在则跳过）
    await pool.query(`
      ALTER TABLE content_blocks
        ADD COLUMN IF NOT EXISTS sh_b0 VARCHAR(4),
        ADD COLUMN IF NOT EXISTS sh_b1 VARCHAR(4),
        ADD COLUMN IF NOT EXISTS sh_b2 VARCHAR(4),
        ADD COLUMN IF NOT EXISTS sh_b3 VARCHAR(4);
      CREATE INDEX IF NOT EXISTS idx_cb_sh_b0 ON content_blocks(sh_b0) WHERE sh_b0 IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_cb_sh_b1 ON content_blocks(sh_b1) WHERE sh_b1 IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_cb_sh_b2 ON content_blocks(sh_b2) WHERE sh_b2 IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_cb_sh_b3 ON content_blocks(sh_b3) WHERE sh_b3 IS NOT NULL;
    `);
    // 失败嵌入记录表（用于重试，worker 依赖此表）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS failed_embeddings (
        block_hash VARCHAR(64) PRIMARY KEY REFERENCES content_blocks(block_hash) ON DELETE CASCADE,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_failed_embeddings_retry ON failed_embeddings(created_at);
    `);
    // 文档级 SimHash（优化三：文档近似去重，跨用户同书识别）
    await pool.query(`
      ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS doc_simhash VARCHAR(16),
        ADD COLUMN IF NOT EXISTS doc_b0 VARCHAR(4),
        ADD COLUMN IF NOT EXISTS doc_b1 VARCHAR(4),
        ADD COLUMN IF NOT EXISTS doc_b2 VARCHAR(4),
        ADD COLUMN IF NOT EXISTS doc_b3 VARCHAR(4);
      CREATE INDEX IF NOT EXISTS idx_documents_doc_b0 ON documents(doc_b0) WHERE doc_b0 IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_documents_doc_b1 ON documents(doc_b1) WHERE doc_b1 IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_documents_doc_b2 ON documents(doc_b2) WHERE doc_b2 IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_documents_doc_b3 ON documents(doc_b3) WHERE doc_b3 IS NOT NULL;
    `);
    logger.info('Auth migration: email_verified + email_otps + avatar_url(TEXT) + failed_embeddings + doc_simhash ready');

    // 同步管理员状态
    await syncAdminEmails();
    // 创建初始管理员
    await createInitialAdmin();
  } catch (err) {
    logger.error('Auth migration error:', err);
  }
}

// 根据环境变量自动创建初始管理员账号
async function createInitialAdmin() {
  const email = process.env.ADMIN_INIT_EMAIL?.trim();
  const username = process.env.ADMIN_INIT_USERNAME?.trim();
  const password = process.env.ADMIN_INIT_PASSWORD?.trim();

  if (!email || !username || !password) return;

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

  if (existing.rows.length > 0) {
    // 用户已存在：仅确保管理员权限与邮箱验证状态，不覆盖密码（用户可自行修改密码）
    await pool.query(
      `UPDATE users SET is_admin = true, email_verified = true WHERE email = $1`,
      [email]
    );
    return;
  }

  // ✅ 使用 bcrypt 哈希管理员密码
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await pool.query(
    `INSERT INTO users (email, username, password_hash, email_verified, is_admin)
     VALUES ($1, $2, $3, true, true)`,
    [email, username, passwordHash]
  );
  logger.info(`Initial admin created: ${email} (${username})`);
}

// 从环境变量同步管理员邮箱列表（只授权，不自动撤销）
async function syncAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || '';
  const adminEmails = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) return;

  const result = await pool.query(
    `UPDATE users SET is_admin = true WHERE LOWER(email) = ANY($1::text[]) RETURNING email`,
    [adminEmails]
  );

  logger.info(`Admin emails synced (${result.rowCount} granted): ${adminEmails.join(', ')}`);
  return result.rowCount ?? 0;
}

runMigration();

// 注册请求验证 schema
const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(2).max(50),
  password: z.string().min(6),
  code: z.string().length(6),
});

// 登录请求验证 schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// 发送 OTP 验证码
router.post('/send-code', async (req, res) => {
  try {
    const { email, purpose } = z.object({
      email: z.string().email(),
      purpose: z.enum(['register', 'reset_password']),
    }).parse(req.body);

    if (purpose === 'register') {
      const existing = await pool.query(
        'SELECT id, email_verified FROM users WHERE email = $1',
        [email]
      );
      if (existing.rows.length > 0 && existing.rows[0].email_verified) {
        return res.status(400).json({ error: '该邮箱已注册，请直接登录' });
      }
    }

    if (purpose === 'reset_password') {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length === 0) {
        return res.status(400).json({ error: '该邮箱未注册' });
      }
    }

    // 删除旧的验证码，生成新的
    await pool.query(
      'DELETE FROM email_otps WHERE email = $1 AND purpose = $2',
      [email, purpose]
    );

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 分钟

    await pool.query(
      'INSERT INTO email_otps (email, code, purpose, expires_at) VALUES ($1, $2, $3, $4)',
      [email, code, purpose, expiresAt]
    );

    await sendOTPEmail(email, code, purpose);

    logger.info(`OTP sent to ${email} for ${purpose}`);
    res.json({ message: '验证码已发送，请查收邮件' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Send code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 注册（OTP 验证）
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, code } = registerSchema.parse(req.body);

    // 检查验证码
    const otpResult = await pool.query(
      `SELECT id, expires_at FROM email_otps
       WHERE email = $1 AND code = $2 AND purpose = 'register'
       ORDER BY created_at DESC LIMIT 1`,
      [email, code]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ error: '验证码错误' });
    }
    if (new Date(otpResult.rows[0].expires_at) < new Date()) {
      return res.status(400).json({ error: '验证码已过期，请重新发送' });
    }

    // 检查用户是否已存在
    const existing = await pool.query(
      'SELECT id, email_verified FROM users WHERE email = $1',
      [email]
    );
    if (existing.rows.length > 0 && existing.rows[0].email_verified) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // 清除 OTP
    await pool.query('DELETE FROM email_otps WHERE email = $1 AND purpose = $2', [email, 'register']);

    // 判断是否为预设管理员
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const isAdmin = adminEmails.includes(email.toLowerCase());

    // ✅ 使用 bcrypt 哈希密码
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    if (existing.rows.length > 0) {
      // 已存在未验证的用户，更新并标记验证
      await pool.query(
        `UPDATE users SET username = $1, password_hash = $2, email_verified = true,
         is_admin = $4, verification_token = NULL, verification_token_expires = NULL
         WHERE email = $3`,
        [username, passwordHash, email, isAdmin]
      );
    } else {
      await pool.query(
        `INSERT INTO users (email, username, password_hash, email_verified, is_admin)
         VALUES ($1, $2, $3, true, $4)`,
        [email, username, passwordHash, isAdmin]
      );
    }

    logger.info(`User registered: ${email}`);
    res.status(201).json({ message: '注册成功，请登录' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 重置密码（OTP 验证）
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, password } = z.object({
      email: z.string().email(),
      code: z.string().length(6),
      password: z.string().min(6),
    }).parse(req.body);

    const otpResult = await pool.query(
      `SELECT id, expires_at FROM email_otps
       WHERE email = $1 AND code = $2 AND purpose = 'reset_password'
       ORDER BY created_at DESC LIMIT 1`,
      [email, code]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ error: '验证码错误' });
    }
    if (new Date(otpResult.rows[0].expires_at) < new Date()) {
      return res.status(400).json({ error: '验证码已过期，请重新发送' });
    }

    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: '用户不存在' });
    }

    await pool.query('DELETE FROM email_otps WHERE email = $1 AND purpose = $2', [email, 'reset_password']);
    
    // ✅ 使用 bcrypt 哈希新密码
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);

    logger.info(`Password reset for ${email}`);
    res.json({ message: '密码重置成功，请登录' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const result = await pool.query(
      'SELECT id, email, username, password_hash, avatar_url, is_admin, email_verified FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // ✅ 使用 bcrypt 验证密码
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 检查邮箱是否已验证
    if (!user.email_verified) {
      return res.status(403).json({ error: 'email_not_verified' });
    }

    // ✅ 生成真实 JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      isAdmin: user.is_admin ?? false,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url ?? null,
        is_admin: user.is_admin ?? false,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取当前用户
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, username, avatar_url, is_admin FROM users WHERE id = $1',
      [req.user!.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    logger.error('Get user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 更新头像
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { avatar_url } = z.object({ avatar_url: z.string().max(500000) }).parse(req.body);
    const result = await pool.query(
      'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, username, avatar_url, is_admin',
      [avatar_url, req.user!.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed' });
    logger.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 修改密码（需验证旧密码）
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { oldPassword, newPassword } = z.object({
      oldPassword: z.string().min(1),
      newPassword: z.string().min(6),
    }).parse(req.body);

    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user!.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    // ✅ 使用 bcrypt 验证旧密码
    const validOldPassword = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
    if (!validOldPassword) {
      return res.status(400).json({ error: '原密码错误' });
    }

    // ✅ 使用 bcrypt 哈希新密码
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, req.user!.userId]
    );
    res.json({ message: '密码修改成功' });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed' });
    logger.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/admin/sync — 管理员触发同步（无需重启）
router.post('/admin/sync', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!;
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const granted = await syncAdminEmails();
    res.json({ message: 'Admin emails synced', granted });
  } catch (err) {
    logger.error('Admin sync error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as authRoutes };
