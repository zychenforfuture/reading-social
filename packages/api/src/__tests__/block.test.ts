/**
 * Block 模块测试
 * 测试内容块查询、相似块推荐等功能
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { pool } from '../config/database.js';

describe('Block API', () => {
  let testBlockHash: string;
  const testContent = '这是测试内容块，用于验证 Block API 功能。';

  beforeAll(async () => {
    // 确保数据库连接
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      await pool.query('DELETE FROM content_blocks WHERE block_hash = $1', [testBlockHash]);
      await pool.end();
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  });

  describe('GET /api/blocks/:hash', () => {
    it('应该返回 400 对于非法 hash 格式', async () => {
      const res = await request(app).get('/api/blocks/invalid');
      expect(res.status).toBe(400);
    });

    it('应该返回 404 对于不存在的 hash', async () => {
      const fakeHash = '0000000000000000000000000000000000000000000000000000000000000000';
      const res = await request(app).get(`/api/blocks/${fakeHash}`);
      expect(res.status).toBe(404);
    });

    it('应该返回内容块详情', async () => {
      // 先创建测试数据
      const crypto = await import('crypto');
      testBlockHash = crypto.createHash('sha256').update(testContent).digest('hex');

      await pool.query(
        `INSERT INTO content_blocks (block_hash, raw_content, word_count, occurrence_count)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (block_hash) DO NOTHING`,
        [testBlockHash, testContent, testContent.length]
      );

      const res = await request(app).get(`/api/blocks/${testBlockHash}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('block');
      expect(res.body.block).toHaveProperty('block_hash', testBlockHash);
      expect(res.body.block).toHaveProperty('raw_content', testContent);
    });
  });

  describe('GET /api/blocks/:hash/comments', () => {
    it('应该返回 400 对于非法 hash 格式', async () => {
      const res = await request(app).get('/api/blocks/invalid/comments');
      expect(res.status).toBe(400);
    });

    it('应该返回空评论列表对于不存在的块', async () => {
      const fakeHash = '0000000000000000000000000000000000000000000000000000000000000000';
      const res = await request(app).get(`/api/blocks/${fakeHash}/comments`);
      expect(res.status).toBe(404);
    });

    it('应该返回块的评论列表', async () => {
      const res = await request(app).get(`/api/blocks/${testBlockHash}/comments`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('comments');
      expect(Array.isArray(res.body.comments)).toBe(true);
    });
  });

  describe('GET /api/blocks/:hash/similar', () => {
    it('应该返回 400 对于非法 hash 格式', async () => {
      const res = await request(app).get('/api/blocks/invalid/similar');
      expect(res.status).toBe(400);
    });

    it('应该返回空相似列表对于不存在的块', async () => {
      const fakeHash = '0000000000000000000000000000000000000000000000000000000000000000';
      const res = await request(app).get(`/api/blocks/${fakeHash}/similar`);
      expect(res.status).toBe(404);
    });

    it('应该返回相似内容块列表', async () => {
      const res = await request(app).get(`/api/blocks/${testBlockHash}/similar`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('similar');
      expect(Array.isArray(res.body.similar)).toBe(true);
    });
  });
});
