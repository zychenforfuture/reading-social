import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';
import { sendOTPEmail } from '../utils/email.js';

const router: Router = Router();

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
    logger.info('Auth migration: email_verified + email_otps ready');

    // 同步管理员状态
    await syncAdminEmails();
  } catch (err) {
    logger.error('Auth migration error:', err);
  }
}

// 从环境变量同步管理员邮箱列表
async function syncAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || '';
  const adminEmails = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) return;

  // 将列表内邮箱设为管理员
  await pool.query(
    `UPDATE users SET is_admin = true WHERE LOWER(email) = ANY($1::text[])`,
    [adminEmails]
  );
  // 将不在列表中的邮箱取消管理员
  await pool.query(
    `UPDATE users SET is_admin = false WHERE LOWER(email) != ALL($1::text[])`,
    [adminEmails]
  );

  logger.info(`Admin emails synced: ${adminEmails.join(', ')}`);
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

    if (existing.rows.length > 0) {
      // 已存在未验证的用户，更新并标记验证
      await pool.query(
        `UPDATE users SET username = $1, password_hash = $2, email_verified = true,
         is_admin = $4, verification_token = NULL, verification_token_expires = NULL
         WHERE email = $3`,
        [username, `$hashed$${password}`, email, isAdmin]
      );
    } else {
      await pool.query(
        `INSERT INTO users (email, username, password_hash, email_verified, is_admin)
         VALUES ($1, $2, $3, true, $4)`,
        [email, username, `$hashed$${password}`, isAdmin]
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
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2',
      [`$hashed$${password}`, email]
    );

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
      'SELECT id, email, username, password_hash, is_admin, email_verified FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // TODO: 验证密码哈希
    if (!user.password_hash.endsWith(password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 检查邮箱是否已验证
    if (!user.email_verified) {
      return res.status(403).json({ error: 'email_not_verified' });
    }

    // TODO: 生成 JWT token
    const token = `dummy_token_${user.id}`;

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
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
router.get('/me', async (req, res) => {
  // TODO: 添加 JWT 验证中间件
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // TODO: 解析 JWT 获取用户 ID
  res.json({ user: { id: 'dummy', email: 'demo@example.com', username: 'Demo' } });
});

export { router as authRoutes };
