/**
 * 性能测试
 * 验证关键 API 端点响应时间在可接受范围内
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { pool } from '../config/database.js';

const TEST_EMAIL = `perf_test_${Date.now()}@example.com`;
const TEST_PASSWORD = 'PerfTest123!';
const TEST_USERNAME = 'perf_tester';

let authToken: string;
let testUserId: string;

describe('Performance Tests - 性能基准测试', () => {
  beforeAll(async () => {
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    const result = await pool.query(
      `INSERT INTO users (email, username, password_hash, email_verified)
       VALUES ($1, $2, $3, true) RETURNING id`,
      [TEST_EMAIL, TEST_USERNAME, passwordHash]
    );
    testUserId = result.rows[0].id;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    if (loginRes.status === 200) {
      authToken = loginRes.body.token;
    }
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  });

  describe('健康检查端点', () => {
    it('健康检查应在 200ms 内响应', async () => {
      const start = Date.now();
      const res = await request(app).get('/health');
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(200);
      console.log(`GET /health: ${duration}ms`);
    });

    it('连续 10 次健康检查平均响应时间 < 100ms', async () => {
      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await request(app).get('/health');
        times.push(Date.now() - start);
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`健康检查平均耗时: ${avg.toFixed(1)}ms（${times.join(', ')}ms）`);
      expect(avg).toBeLessThan(100);
    });
  });

  describe('认证端点性能', () => {
    it('登录端点应在 2000ms 内响应', async () => {
      const start = Date.now();
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(2000);
      console.log(`POST /api/auth/login: ${duration}ms`);
    });

    it('JWT 验证（受保护路由）应在 500ms 内响应', async () => {
      const start = Date.now();
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${authToken}`);
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(500);
      console.log(`GET /api/documents（含 JWT 验证）: ${duration}ms`);
    });
  });

  describe('文档端点性能', () => {
    it('文档列表查询应在 500ms 内响应', async () => {
      const start = Date.now();
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${authToken}`);
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(500);
      console.log(`GET /api/documents: ${duration}ms`);
    });

    it('文档上传应在 3000ms 内响应', async () => {
      const start = Date.now();
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '性能测试文档',
          content: '这是性能测试文档的内容。'.repeat(50),
        });
      const duration = Date.now() - start;

      expect([200, 201]).toContain(res.status);
      expect(duration).toBeLessThan(3000);
      console.log(`POST /api/documents: ${duration}ms`);
    });
  });

  describe('通知端点性能', () => {
    it('未读通知数查询应在 500ms 内响应', async () => {
      const start = Date.now();
      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${authToken}`);
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(500);
      console.log(`GET /api/notifications/unread-count: ${duration}ms`);
    });
  });

  describe('吞吐量测试', () => {
    it('10 次并发文档列表请求应在 3000ms 内全部完成', async () => {
      const start = Date.now();

      const requests = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/documents')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const results = await Promise.all(requests);
      const duration = Date.now() - start;

      const successCount = results.filter(r => r.status === 200).length;
      expect(successCount).toBe(10);
      expect(duration).toBeLessThan(3000);
      console.log(`10 次并发文档列表请求全部完成，耗时: ${duration}ms`);
    });
  });
});
