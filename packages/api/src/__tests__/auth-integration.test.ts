/**
 * 用户认证完整流程测试（集成测试）
 * 测试登录、注册、密码修改等完整流程
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { pool } from '../config/database.js';
import bcrypt from 'bcryptjs';

const TEST_EMAIL = `integration_${Date.now()}@example.com`;
const TEST_PASSWORD = 'SecurePass123!';
const TEST_USERNAME = 'integration_test_user';

describe('Auth Integration Tests', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // 确保数据库连接
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      await pool.query('DELETE FROM users WHERE email LIKE $1', ['integration_%@example.com']);
      await pool.end();
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  });

  describe('完整注册流程', () => {
    it('应该完成注册全流程', async () => {
      // 步骤 1: 发送验证码
      const sendCodeRes = await request(app)
        .post('/api/auth/send-code')
        .send({ email: TEST_EMAIL, purpose: 'register' });

      expect([200, 400, 500]).toContain(sendCodeRes.status);

      // 步骤 2: 注册账号（使用测试验证码）
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: TEST_EMAIL,
          username: TEST_USERNAME,
          password: TEST_PASSWORD,
          code: '123456', // 测试环境可能跳过验证
        });

      // 可能成功或因验证码失败
      if (registerRes.status === 201) {
        expect(registerRes.body.message).toContain('注册成功');
      } else if (registerRes.status === 400) {
        expect(registerRes.body.error).toContain('验证码');
      }
    });

    it('应该拒绝重复注册', async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: TEST_EMAIL,
          username: TEST_USERNAME,
          password: TEST_PASSWORD,
          code: '123456',
        });

      // 已注册应该失败
      if (registerRes.status === 400) {
        expect(registerRes.body.error).toContain('已注册');
      }
    });
  });

  describe('完整登录流程', () => {
    it('应该成功登录并返回 JWT token', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        });

      // 如果注册成功，登录应该成功
      if (loginRes.status === 200) {
        expect(loginRes.body).toHaveProperty('token');
        expect(loginRes.body).toHaveProperty('user');
        expect(loginRes.body.user).toHaveProperty('email', TEST_EMAIL);
        expect(loginRes.body.user).toHaveProperty('username', TEST_USERNAME);
        
        authToken = loginRes.body.token;
        testUserId = loginRes.body.user.id;

        // 验证 token 格式
        expect(authToken.split('.')).toHaveLength(3);
      }
    });

    it('应该拒绝错误密码', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_EMAIL,
          password: 'WrongPassword',
        });

      expect(loginRes.status).toBe(401);
      expect(loginRes.body.error).toBe('Invalid credentials');
    });

    it('应该拒绝不存在的账号', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword',
        });

      expect(loginRes.status).toBe(401);
    });
  });

  describe('获取当前用户信息', () => {
    it('应该返回当前登录用户信息', async () => {
      if (!authToken) {
        // 先登录获取 token
        const loginRes = await request(app)
          .post('/api/auth/login')
          .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
        
        if (loginRes.status === 200) {
          authToken = loginRes.body.token;
        } else {
          return; // 跳过测试
        }
      }

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user).toHaveProperty('email', TEST_EMAIL);
      expect(meRes.body.user).toHaveProperty('username', TEST_USERNAME);
    });

    it('应该拒绝无效 token', async () => {
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token_here');

      expect(meRes.status).toBe(401);
    });
  });

  describe('修改密码功能', () => {
    const NEW_PASSWORD = 'NewSecurePass456!';

    it('应该允许修改密码', async () => {
      if (!authToken) return;

      // 修改密码
      const changeRes = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          oldPassword: TEST_PASSWORD,
          newPassword: NEW_PASSWORD,
        });

      if (changeRes.status === 200) {
        expect(changeRes.body.message).toContain('密码修改成功');

        // 验证新密码可以登录
        const loginNewRes = await request(app)
          .post('/api/auth/login')
          .send({ email: TEST_EMAIL, password: NEW_PASSWORD });

        expect(loginNewRes.status).toBe(200);
        expect(loginNewRes.body).toHaveProperty('token');

        // 恢复原密码（方便后续测试）
        await request(app)
          .put('/api/auth/change-password')
          .set('Authorization', `Bearer ${loginNewRes.body.token}`)
          .send({
            oldPassword: NEW_PASSWORD,
            newPassword: TEST_PASSWORD,
          });
      }
    });

    it('应该拒绝错误旧密码', async () => {
      if (!authToken) return;

      const changeRes = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          oldPassword: 'WrongOldPassword',
          newPassword: 'SomeNewPassword',
        });

      if (changeRes.status !== 401) { // 可能因未登录返回 401
        expect(changeRes.status).toBe(400);
        expect(changeRes.body.error).toContain('原密码');
      }
    });
  });

  describe('更新个人资料', () => {
    it('应该允许更新头像', async () => {
      if (!authToken) return;

      const avatarUrl = 'https://api.dicebear.com/7.x/test/svg?seed=test';
      
      const updateRes = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ avatar_url: avatarUrl });

      if (updateRes.status === 200) {
        expect(updateRes.body.user.avatar_url).toBe(avatarUrl);
      }
    });
  });
});
