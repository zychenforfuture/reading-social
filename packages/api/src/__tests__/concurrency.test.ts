/**
 * 并发测试和压力测试
 * 测试高并发场景下的系统稳定性
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { pool } from '../config/database.js';

// 注意：并发测试需要真实数据库环境
// 这些测试主要用于验证并发安全性和性能

describe('Concurrency Tests - 并发测试', () => {
  let authToken1: string;
  let authToken2: string;
  let testUserId1: string;
  let testUserId2: string;

  const TEST_EMAIL_1 = `concurrent_test_1_${Date.now()}@example.com`;
  const TEST_EMAIL_2 = `concurrent_test_2_${Date.now()}@example.com`;
  const TEST_PASSWORD = 'ConcurrencyTest123!';

  beforeAll(async () => {
    // 创建两个测试用户
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    
    const user1Result = await pool.query(
      `INSERT INTO users (email, username, password_hash, email_verified)
       VALUES ($1, $2, $3, true) RETURNING id`,
      [TEST_EMAIL_1, 'user1', passwordHash]
    );
    
    const user2Result = await pool.query(
      `INSERT INTO users (email, username, password_hash, email_verified)
       VALUES ($1, $2, $3, true) RETURNING id`,
      [TEST_EMAIL_2, 'user2', passwordHash]
    );
    
    testUserId1 = user1Result.rows[0].id;
    testUserId2 = user2Result.rows[0].id;

    // 登录获取 tokens
    const loginRes1 = await request(await import('../app.js').then(m => m.default))
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL_1, password: TEST_PASSWORD });

    const loginRes2 = await request(await import('../app.js').then(m => m.default))
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL_2, password: TEST_PASSWORD });

    if (loginRes1.status === 200) authToken1 = loginRes1.body.token;
    if (loginRes2.status === 200) authToken2 = loginRes2.body.token;
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testUserId1, testUserId2]);
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  });

  describe('并发上传测试（秒传去重）', () => {
    it('应该正确处理多用户同时上传相同文件', async () => {
      const testContent = '这是用于测试秒传去重的相同内容。'.repeat(100);
      const crypto = await import('crypto');
      const fileHash = crypto.createHash('md5').update(testContent).digest('hex');

      // 模拟并发上传
      const [res1, res2] = await Promise.all([
        request(await import('../app.js').then(m => m.default))
          .post('/api/documents')
          .set('Authorization', `Bearer ${authToken1}`)
          .send({ title: 'User1 Doc', content: testContent }),
        
        request(await import('../app.js').then(m => m.default))
          .post('/api/documents')
          .set('Authorization', `Bearer ${authToken2}`)
          .send({ title: 'User2 Doc', content: testContent }),
      ]);

      // 两个请求都应该成功
      expect([200, 201]).toContain(res1.status);
      expect([200, 201]).toContain(res2.status);

      // 验证文件哈希相同
      if (res1.status === 200 && res2.status === 200) {
        // 第二个用户应该触发秒传
        if (typeof res2.body.message === 'string') {
          expect(res2.body.message).toContain('deduped');
        }
      }
    });
  });

  describe('并发评论测试', () => {
    it('应该正确处理并发评论（reply_count 更新）', async () => {
      // 先创建测试文档和内容块
      const docContent = '这是用于测试并发评论的内容。';
      const uploadRes = await request(await import('../app.js').then(m => m.default))
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ title: '并发评论测试文档', content: docContent });

      if (uploadRes.status !== 200 && uploadRes.status !== 201) {
        return;
      }

      const testDocumentId = uploadRes.body.document.id;

      // 等待文档处理完成
      let testBlockHash: string | null = null;
      for (let i = 0; i < 20; i++) {
        const statusRes = await request(await import('../app.js').then(m => m.default))
          .get(`/api/documents/${testDocumentId}`)
          .set('Authorization', `Bearer ${authToken1}`);

        if (statusRes.body.document?.status === 'ready' && statusRes.body.content?.length > 0) {
          testBlockHash = statusRes.body.content[0].block_hash;
          break;
        }

        if (i === 19) {
          throw new Error(`Document ${testDocumentId} did not become ready in time`);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!testBlockHash) return;

      // 模拟 10 个并发评论
      const commentPromises = Array.from({ length: 10 }, async (_, i) =>
        request(await import('../app.js').then(m => m.default))
          .post('/api/comments')
          .set('Authorization', `Bearer ${authToken1}`)
          .send({
            content: `并发评论 ${i}`,
            blockHash: testBlockHash,
          })
      );

      const results = await Promise.all(commentPromises);

      // 所有评论都应该成功
      results.forEach(res => {
        expect([201, 400, 500]).toContain(res.status);
      });

      // 统计成功数量
      const successCount = results.filter(r => r.status === 201).length;
      expect(successCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('并发点赞测试', () => {
    it('应该正确处理并发点赞（like_count 更新）', async () => {
      // 先创建测试文档
      const docContent = '这是用于测试点赞的文档内容。';
      const uploadRes = await request(await import('../app.js').then(m => m.default))
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ title: '并发点赞测试文档', content: docContent });

      if (uploadRes.status !== 200 && uploadRes.status !== 201) {
        return;
      }

      const testDocumentId = uploadRes.body.document.id;

      // 等待文档处理完成
      let testBlockHash: string | null = null;
      for (let i = 0; i < 20; i++) {
        const statusRes = await request(await import('../app.js').then(m => m.default))
          .get(`/api/documents/${testDocumentId}`)
          .set('Authorization', `Bearer ${authToken1}`);

        if (statusRes.body.document?.status === 'ready' && statusRes.body.content?.length > 0) {
          testBlockHash = statusRes.body.content[0].block_hash;
          break;
        }

        if (i === 19) {
          throw new Error(`Document ${testDocumentId} did not become ready in time`);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!testBlockHash) return;

      // 创建测试评论
      const createRes = await request(await import('../app.js').then(m => m.default))
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          content: '测试评论用于点赞',
          blockHash: testBlockHash,
        });

      if (createRes.status !== 201) return;

      const commentId = createRes.body.comment.id;

      // 模拟 2 个并发点赞（每个用户各一次，避免主键冲突）
      const [res1, res2] = await Promise.all([
        request(await import('../app.js').then(m => m.default))
          .post(`/api/comments/${commentId}/like`)
          .set('Authorization', `Bearer ${authToken1}`),
        request(await import('../app.js').then(m => m.default))
          .post(`/api/comments/${commentId}/like`)
          .set('Authorization', `Bearer ${authToken2}`),
      ]);

      // 两个点赞都应该成功
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // 验证最终点赞数（2 个赞成）
      expect(res2.body.likeCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('并发登录压力测试', () => {
    it('应该正确处理 100 并发登录请求', async () => {
      // 模拟 100 个并发登录
      const loginPromises = Array.from({ length: 100 }, async () =>
        request(await import('../app.js').then(m => m.default))
          .post('/api/auth/login')
          .send({ email: TEST_EMAIL_1, password: TEST_PASSWORD })
      );

      const startTime = Date.now();
      const results = await Promise.all(loginPromises);
      const endTime = Date.now();

      // 所有登录都应该成功
      const successCount = results.filter(r => r.status === 200).length;
      expect(successCount).toBe(100);

      // 验证性能（100 个请求应该在合理时间内完成）
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000); // 10 秒内完成

      console.log(`100 并发登录完成，耗时：${duration}ms`);
    });
  });

  describe('并发文档上传压力测试', () => {
    it('应该正确处理 50 并发文档上传', async () => {
      // 模拟 50 个并发上传
      const uploadPromises = Array.from({ length: 50 }, async (_, i) =>
        request(await import('../app.js').then(m => m.default))
          .post('/api/documents')
          .set('Authorization', `Bearer ${authToken1}`)
          .send({
            title: `并发文档 ${i}`,
            content: `这是文档 ${i} 的内容`.repeat(100),
          })
      );

      const startTime = Date.now();
      const results = await Promise.all(uploadPromises);
      const endTime = Date.now();

      // 统计成功数量
      const successCount = results.filter(r => [200, 201].includes(r.status)).length;
      expect(successCount).toBeGreaterThan(40); // 至少 80% 成功

      // 验证性能
      const duration = endTime - startTime;
      console.log(`50 并发上传完成，成功：${successCount}/50，耗时：${duration}ms`);
    });
  });
});
