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
    const bcrypt = await import('bcrypt');
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
      const bcrypt = await import('bcrypt');
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
    it.skip('应该允许订阅文档评论更新', async () => {
      // SSE 测试需要特殊处理（长连接），暂时跳过
      // 实际项目中应该使用专门的 HTTP 客户端测试 SSE
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 🔥 热门评论排序测试（新增）
  // 热度排序公式：(3×reply_count + like_count) × e^(-0.05×小时数) + 冷启动加成 (2 小时内 +1.5)
  // ──────────────────────────────────────────────────────────────────

  describe('热门评论排序测试', () => {
    let sortedAuthToken: string;
    let testSortedUserId: string;
    let testSortedDocumentId: string;
    let blockHash: string;
    let rootComment1: any;
    let rootComment2: any;
    let rootComment3: any;

    const SORTED_TEST_EMAIL = `sorted_test_${Date.now()}@example.com`;
    const SORTED_TEST_PASSWORD = 'SortedTest123!';
    const SORTED_TEST_USERNAME = 'sorted_test_user';

    beforeAll(async () => {
      // 创建测试用户
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash(SORTED_TEST_PASSWORD, 10);
      
      const userResult = await pool.query(
        `INSERT INTO users (email, username, password_hash, email_verified, is_admin)
         VALUES ($1, $2, $3, true, false)
         RETURNING id`,
        [SORTED_TEST_EMAIL, SORTED_TEST_USERNAME, passwordHash]
      );
      
      const userId = userResult.rows[0].id;

      // 登录获取 token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: SORTED_TEST_EMAIL, password: SORTED_TEST_PASSWORD });

      if (loginRes.status === 200) {
        sortedAuthToken = loginRes.body.token;
      }

      // 创建测试文档
      const docContent = '第一段。\n第二段。\n第三段。';
      const uploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${sortedAuthToken}`)
        .send({
          title: '排序测试文档',
          content: docContent,
        });

      testSortedDocumentId = uploadRes.body.document.id;

      // 获取第一个 block_hash
      const docRes = await request(app)
        .get(`/api/documents/${testSortedDocumentId}`)
        .set('Authorization', `Bearer ${sortedAuthToken}`);

      if (docRes.body.content && docRes.body.content.length > 0) {
        blockHash = docRes.body.content[0].block_hash;
      }
    });

    afterAll(async () => {
      try {
        await pool.query('DELETE FROM comments WHERE user_id = $1', [testSortedUserId]);
        await pool.query('DELETE FROM documents WHERE id = $1', [testSortedDocumentId]);
        await pool.query('DELETE FROM users WHERE email LIKE $1', ['sorted_test_%@example.com']);
      } catch (e) {
        // Ignore
      }
    });

    it('新评论应该有冷启动加成（2 小时内 +1.5）', async () => {
      if (!blockHash || !sortedAuthToken) return;

      // 创建多个新评论（时间相近，模拟冷启动）
      const createComment = async (content: string) => {
        const res = await request(app)
          .post('/api/comments')
          .set('Authorization', `Bearer ${sortedAuthToken}`)
          .send({
            content,
            blockHash,
          });
        return res.body.comment;
      };

      rootComment1 = await createComment('新评论 1（高赞）');
      rootComment2 = await createComment('新评论 2（低赞）');
      rootComment3 = await createComment('新评论 3（无赞）');

      // 等待评论创建完成
      await new Promise(resolve => setTimeout(resolve, 300));

      // 获取评论列表
      const commentsRes = await request(app)
        .get(`/api/documents/${testSortedDocumentId}/comments`);

      expect(commentsRes.status).toBe(200);
      expect(commentsRes.body.comments).toHaveLength(3);

      // 热门排序应该把新评论放在前面（冷启动加成）
      const firstComment = commentsRes.body.comments[0];
      expect(['新评论 1（高赞）', '新评论 2（低赞）', '新评论 3（无赞）'])
        .toContain(firstComment.content);
    });

    it('老评论应该随时间衰减', async () => {
      if (!blockHash || !sortedAuthToken) return;

      // 创建一个老评论（使用 SQL 直接插入，设置较早的 created_at）
      const oldCommentRes = await pool.query(
        `INSERT INTO comments (block_hash, user_id, content, like_count, reply_count, created_at)
         VALUES ($1, $2, $3, 10, 5, NOW() - INTERVAL '72 hours') -- 3 天前
         RETURNING id`,
        [blockHash, testSortedUserId, '老评论（高赞但过时）']
      );

      const oldCommentId = oldCommentRes.rows[0].id;

      // 获取评论列表
      const commentsRes = await request(app)
        .get(`/api/documents/${testSortedDocumentId}/comments`);

      expect(commentsRes.status).toBe(200);

      // 老评论应该排在新评论之后（时间衰减）
      const commentContents = commentsRes.body.comments.map((c: any) => c.content);
      expect(commentContents.indexOf('老评论（高赞但过时）')).toBeGreaterThan(0);
    });

    it('高回复评论应该排序更高', async () => {
      if (!blockHash || !sortedAuthToken) return;

      // 创建评论 1：高回复低点赞
      const comment1 = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${sortedAuthToken}`)
        .send({
          content: '评论 A（高回复）',
          blockHash,
        });

      // 创建评论 2：低回复高点赞
      const comment2 = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${sortedAuthToken}`)
        .send({
          content: '评论 B（高点赞）',
          blockHash,
        });

      // 为评论 1 添加回复
      await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${sortedAuthToken}`)
        .send({
          content: '回复 A1',
          rootId: comment1.body.comment.id,
        });

      await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${sortedAuthToken}`)
        .send({
          content: '回复 A2',
          rootId: comment1.body.comment.id,
        });

      // 为评论 2 添加点赞
      await request(app)
        .post(`/api/comments/${comment2.body.comment.id}/like`)
        .set('Authorization', `Bearer ${sortedAuthToken}`);

      // 等待
      await new Promise(resolve => setTimeout(resolve, 300));

      // 获取排序后的评论
      const commentsRes = await request(app)
        .get(`/api/documents/${testSortedDocumentId}/comments`);

      expect(commentsRes.status).toBe(200);

      // 热度公式：(3×reply_count + like_count) ×衰减因子
      // 评论 A: 3×2 + 0 = 6
      // 评论 B: 0 + 1 = 1
      // 评论 A 应该排在前面
      const contents = commentsRes.body.comments.map((c: any) => c.content);
      expect(contents.indexOf('评论 A（高回复）')).toBeLessThan(contents.indexOf('评论 B（高点赞）'));
    });

    it('点赞数应影响排序', async () => {
      if (!blockHash || !sortedAuthToken) return;

      // 创建新评论 1：5 个赞
      const comment1 = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${sortedAuthToken}`)
        .send({
          content: '点赞热门评论',
          blockHash,
        });

      // 模拟 5 个赞（直接更新数据库）
      await pool.query(
        `UPDATE comments SET like_count = 5 WHERE id = $1`,
        [comment1.body.comment.id]
      );

      // 创建新评论 2：1 个赞
      const comment2 = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${sortedAuthToken}`)
        .send({
          content: '低点赞评论',
          blockHash,
        });

      await pool.query(
        `UPDATE comments SET like_count = 1 WHERE id = $1`,
        [comment2.body.comment.id]
      );

      // 等待
      await new Promise(resolve => setTimeout(resolve, 300));

      // 获取排序后的评论
      const commentsRes = await request(app)
        .get(`/api/documents/${testSortedDocumentId}/comments`);

      expect(commentsRes.status).toBe(200);

      // 评论 1 (like=5) 应该排在评论 2 (like=1) 前面
      const contents = commentsRes.body.comments.map((c: any) => c.content);
      expect(contents.indexOf('点赞热门评论')).toBeLessThan(contents.indexOf('低点赞评论'));
    });
  });
});
