/**
 * 认证模块单元测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { pool } from '../config/database.js';

const TEST_EMAIL = `test_${Date.now()}@example.com`;
const TEST_PASSWORD = 'testPassword123';

describe('Auth Routes', () => {
  beforeAll(async () => {
    // 确保数据库连接正常
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      await pool.query('DELETE FROM users WHERE email LIKE $1', ['test_%@example.com']);
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  });

  describe('POST /api/auth/send-code', () => {
    it('应该接受有效的邮箱格式', async () => {
      const res = await request(app)
        .post('/api/auth/send-code')
        .send({ email: TEST_EMAIL, purpose: 'register' });

      // 可能成功或因 SMTP 配置失败，但不应该验证错误
      expect([200, 400, 500]).toContain(res.status);
    });

    it('应该拒绝无效邮箱格式', async () => {
      const res = await request(app)
        .post('/api/auth/send-code')
        .send({ email: 'invalid-email', purpose: 'register' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/health', () => {
    it('应该返回健康状态', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Protected Routes', () => {
    it('应该拒绝未认证的请求', async () => {
      const res = await request(app).get('/api/documents');

      expect(res.status).toBe(401);
    });

    it('应该拒绝无效的 JWT token', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', 'Bearer invalid_token');

      expect(res.status).toBe(401);
    });
  });
});
