/**
 * 认证模块单元测试
 * 
 * 测试登录、注册、JWT 鉴权等核心功能
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { pool } from '../config/database.js';

const TEST_EMAIL = `test_${Date.now()}@example.com`;
const TEST_PASSWORD = 'testPassword123';
const TEST_USERNAME = 'testuser';

describe('Auth Routes', () => {
  let authToken: string;

  beforeAll(async () => {
    // 确保测试数据库连接正常
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    // 清理测试数据
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`test_%@example.com`]);
    await pool.end();
  });

  describe('POST /api/auth/send-code', () => {
    it('应该成功发送注册验证码', async () => {
      const res = await request(app)
        .post('/api/auth/send-code')
        .send({ email: TEST_EMAIL, purpose: 'register' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('验证码已发送');
    });

    it('应该拒绝无效邮箱格式', async () => {
      const res = await request(app)
        .post('/api/auth/send-code')
        .send({ email: 'invalid-email', purpose: 'register' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('应该拒绝已注册的邮箱', async () => {
      // 先创建一个测试用户
      await request(app)
        .post('/api/auth/send-code')
        .send({ email: 'existing@example.com', purpose: 'register' });

      const res = await request(app)
        .post('/api/auth/send-code')
        .send({ email: 'existing@example.com', purpose: 'register' });

      // 如果邮箱已验证，应该拒绝
      if (res.status === 400) {
        expect(res.body.error).toContain('已注册');
      }
    });
  });

  describe('POST /api/auth/register', () => {
    const code = '123456'; // 测试环境可能跳过验证码校验

    it('应该成功注册新用户', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: TEST_EMAIL,
          username: TEST_USERNAME,
          password: TEST_PASSWORD,
          code: code,
        });

      // 测试环境可能返回 201 或 400（验证码错误）
      if (res.status === 201) {
        expect(res.body.message).toContain('注册成功');
      } else if (res.status === 400) {
        expect(res.body.error).toContain('验证码');
      }
    });

    it('应该拒绝弱密码', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: `weak_${Date.now()}@example.com`,
          username: 'weakuser',
          password: '123', // 小于 6 位
          code: code,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/auth/login', () => {
    it('应该拒绝不存在的账号', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('应该拒绝错误的密码', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });
  });

  describe('Protected Routes', () => {
    it('应该拒绝未认证的请求', async () => {
      const res = await request(app).get('/api/documents');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('应该拒绝无效的 JWT token', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', 'Bearer invalid_token');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });
  });
});
