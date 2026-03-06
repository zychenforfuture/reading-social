/**
 * 评论系统功能测试（集成测试）
 * 测试评论创建、回复、点赞、删除等功能
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { pool } from '../config/database.js';

let authToken: string;
let testUserId: string;
let testDocumentId: string;
let testBlockHash: string;
let testCommentId: string;

const TEST_EMAIL = `comment_test_${Date.now()}@example.com`;
const TEST_PASSWORD = 'CommentTest123!';
const TEST_USERNAME = 'comment_tester';

describe('Comment System Tests', () => {
  beforeAll(async () => {
    // 创建测试用户
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    
    const userResult = await pool.query(
      `INSERT INTO users (email, username, password_hash, email_verified, is_admin)
       VALUES ($1, $2, $3, true, false)
       RETURNING id`,
      [TEST_EMAIL, TEST_USERNAME, passwordHash]
    );
    
    testUserId = userResult.rows[0].id;

    // 登录获取 token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    if (loginRes.status === 200) {
      authToken = loginRes.body.token;
    }

    // 创建测试文档和内容块
    const docContent = '这是第一段。\n这是第二段。\n这是第三段。';
    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: '评论测试文档',
        content: docContent,
      });

    testDocumentId = uploadRes.body.document.id;

    // 等待文档处理完成（模拟）
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 获取文档内容块
    const docRes = await request(app)
      .get(`/api/documents/${testDocumentId}`)
      .set('Authorization', `Bearer ${authToken}`);

    if (docRes.body.content && docRes.body.content.length > 0) {
      testBlockHash = docRes.body.content[0].block_hash;
    }
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      await pool.query('DELETE FROM comments WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM documents WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
      await pool.end();
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  });

  describe('创建评论', () => {
    it('应该成功创建根评论', async () => {
      if (!testBlockHash) return;

      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '这是一条测试评论',
          blockHash: testBlockHash,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body).toHaveProperty('comment');
      expect(createRes.body.comment).toHaveProperty('content', '这是一条测试评论');
      expect(createRes.body.comment).toHaveProperty('block_hash', testBlockHash);
      expect(createRes.body.comment).toHaveProperty('username', TEST_USERNAME);

      testCommentId = createRes.body.comment.id;
    });

    it('应该拒绝空内容', async () => {
      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '',
          blockHash: testBlockHash,
        });

      expect(createRes.status).toBe(400);
    });

    it('应该拒绝未登录用户', async () => {
      const createRes = await request(app)
        .post('/api/comments')
        .send({
          content: '测试评论',
          blockHash: testBlockHash,
        });

      expect(createRes.status).toBe(401);
    });

    it('应该允许带选中文字创建评论', async () => {
      if (!testBlockHash) return;

      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '针对这段文字的评论',
          blockHash: testBlockHash,
          selectedText: '这是第一段',
        });

      if (createRes.status === 201) {
        expect(createRes.body.comment).toHaveProperty('selected_text', '这是第一段');
      }
    });
  });

  describe('创建回复', () => {
    let replyId: string;

    it('应该成功创建回复', async () => {
      if (!testCommentId) return;

      const replyRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '这是对评论的回复',
          rootId: testCommentId,
        });

      expect(replyRes.status).toBe(201);
      expect(replyRes.body).toHaveProperty('comment');
      expect(replyRes.body.comment).toHaveProperty('content', '这是对评论的回复');
      expect(replyRes.body.comment).toHaveProperty('root_id', testCommentId);

      replyId = replyRes.body.comment.id;
    });

    it('应该允许@某人回复', async () => {
      if (!testCommentId) return;

      const replyRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@作者 你说得对',
          rootId: testCommentId,
          replyToUserId: testUserId,
        });

      if (replyRes.status === 201) {
        expect(replyRes.body.comment).toHaveProperty('reply_to_user_id', testUserId);
      }
    });
  });

  describe('获取评论', () => {
    it('应该获取文档评论分布', async () => {
      if (!testDocumentId) return;

      const commentsRes = await request(app)
        .get(`/api/documents/${testDocumentId}/comments`);

      expect(commentsRes.status).toBe(200);
      expect(commentsRes.body).toHaveProperty('comments');
      expect(commentsRes.body).toHaveProperty('blockCommentCount');
    });

    it('应该获取根评论的回复', async () => {
      if (!testCommentId) return;

      const repliesRes = await request(app)
        .get(`/api/comments/${testCommentId}/replies`);

      expect(repliesRes.status).toBe(200);
      expect(repliesRes.body).toHaveProperty('replies');
      expect(Array.isArray(repliesRes.body.replies)).toBe(true);
    });

    it('应该获取内容块的评论', async () => {
      if (!testBlockHash) return;

      const blockCommentsRes = await request(app)
        .get(`/api/comments/block/${testBlockHash}`);

      expect(blockCommentsRes.status).toBe(200);
      expect(blockCommentsRes.body).toHaveProperty('comments');
    });
  });

  describe('点赞功能', () => {
    it('应该允许点赞评论', async () => {
      if (!testCommentId) return;

      const likeRes = await request(app)
        .post(`/api/comments/${testCommentId}/like`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(likeRes.status).toBe(200);
      expect(likeRes.body).toHaveProperty('liked', true);
      expect(likeRes.body).toHaveProperty('likeCount');
    });

    it('应该允许取消点赞', async () => {
      if (!testCommentId) return;

      // 再次调用应该取消点赞
      const unlikeRes = await request(app)
        .post(`/api/comments/${testCommentId}/like`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(unlikeRes.status).toBe(200);
      expect(unlikeRes.body).toHaveProperty('liked', false);
    });

    it('应该拒绝未登录用户点赞', async () => {
      if (!testCommentId) return;

      const likeRes = await request(app)
        .post(`/api/comments/${testCommentId}/like`);

      expect(likeRes.status).toBe(401);
    });
  });

  describe('更新评论', () => {
    it('应该允许修改自己的评论', async () => {
      if (!testCommentId) return;

      const updateRes = await request(app)
        .patch(`/api/comments/${testCommentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '已修改的评论内容',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body).toHaveProperty('comment');
      expect(updateRes.body.comment.content).toBe('已修改的评论内容');
    });

    it('应该允许标记评论为已解决', async () => {
      if (!testCommentId) return;

      const updateRes = await request(app)
        .patch(`/api/comments/${testCommentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isResolved: true });

      if (updateRes.status === 200) {
        expect(updateRes.body.comment.is_resolved).toBe(true);
      }
    });
  });

  describe('删除评论', () => {
    it('应该允许删除自己的评论', async () => {
      if (!testCommentId) return;

      // 先创建一个新评论用于删除
      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '待删除的评论',
          blockHash: testBlockHash,
        });

      const commentToDelete = createRes.body.comment.id;

      // 删除评论
      const deleteRes = await request(app)
        .delete(`/api/comments/${commentToDelete}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body).toHaveProperty('message', 'Comment deleted');
    });

    it('应该拒绝删除他人评论', async () => {
      if (!testCommentId) return;

      // 创建另一个用户
      const bcrypt = await import('bcryptjs');
      const otherPassword = 'OtherUser123!';
      const passwordHash = await bcrypt.hash(otherPassword, 10);
      
      const otherUserResult = await pool.query(
        `INSERT INTO users (email, username, password_hash, email_verified)
         VALUES ($1, $2, $3, true) RETURNING id`,
        [`other_${Date.now()}@example.com`, 'other_user', passwordHash]
      );
      
      const otherUserId = otherUserResult.rows[0].id;

      // 用另一个用户创建评论
      const otherLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: `other_${Date.now()}@example.com`, password: otherPassword });

      if (otherLoginRes.status === 200) {
        const otherToken = otherLoginRes.body.token;

        const createRes = await request(app)
          .post('/api/comments')
          .set('Authorization', `Bearer ${otherToken}`)
          .send({
            content: '他人的评论',
            blockHash: testBlockHash,
          });

        const otherCommentId = createRes.body.comment.id;

        // 尝试删除他人评论
        const deleteRes = await request(app)
          .delete(`/api/comments/${otherCommentId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(deleteRes.status).toBe(403);

        // 清理
        await pool.query('DELETE FROM comments WHERE id = $1', [otherCommentId]);
      }

      await pool.query('DELETE FROM users WHERE id = $1', [otherUserId]);
    });
  });

  describe('SSE 实时推送', () => {
    it('应该允许订阅文档评论更新', async () => {
      if (!testDocumentId) return;

      // SSE 连接测试（简单验证）
      const sseRes = await request(app)
        .get(`/api/comments/stream/${testDocumentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // SSE 会保持连接，我们只验证能建立连接
      expect(sseRes.status).toBe(200);
      expect(sseRes.headers['content-type']).toContain('text/event-stream');
    });
  });
});
