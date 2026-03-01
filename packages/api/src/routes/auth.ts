import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';
import { sendVerificationEmail } from '../utils/email.js';

const router: Router = Router();

// 启动时执行迁移，添加邮箱验证字段
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
    logger.info('Auth migration: email_verified columns ready');
  } catch (err) {
    logger.error('Auth migration error:', err);
  }
}

runMigration();

// 注册请求验证 schema
const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(6),
});

// 登录请求验证 schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// 注册
router.post('/register', async (req, res) => {
  try {
    const { email, username, password } = registerSchema.parse(req.body);

    // 检查用户是否已存在
    const existing = await pool.query('SELECT id, email_verified FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      // 若已存在但未验证，重新发送验证邮件
      if (!existing.rows[0].email_verified) {
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await pool.query(
          'UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE email = $3',
          [token, expires, email]
        );
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost';
        await sendVerificationEmail(email, token, frontendUrl);
        return res.status(200).json({ message: '验证邮件已重新发送，请查收邮箱完成验证' });
      }
      return res.status(400).json({ error: 'Email already registered' });
    }

    // 生成验证 token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时

    // TODO: 添加密码哈希
    await pool.query(
      `INSERT INTO users (email, username, password_hash, email_verified, verification_token, verification_token_expires)
       VALUES ($1, $2, $3, false, $4, $5)`,
      [email, username, `$hashed$${password}`, token, expires]
    );

    // 发送验证邮件
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost';
    await sendVerificationEmail(email, token, frontendUrl);

    logger.info(`User registered (pending verification): ${email}`);
    res.status(201).json({ message: '注册成功，请查收邮箱完成验证后即可登录' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 验证邮箱
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Invalid token' });
    }

    const result = await pool.query(
      `SELECT id, email_verified, verification_token_expires
       FROM users
       WHERE verification_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Token not found or already used' });
    }

    const user = result.rows[0];

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    if (new Date(user.verification_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Token expired' });
    }

    await pool.query(
      `UPDATE users
       SET email_verified = true, verification_token = NULL, verification_token_expires = NULL
       WHERE id = $1`,
      [user.id]
    );

    logger.info(`Email verified for user ${user.id}`);
    res.json({ message: '邮箱验证成功，请登录' });
  } catch (error) {
    logger.error('Verify email error:', error);
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
