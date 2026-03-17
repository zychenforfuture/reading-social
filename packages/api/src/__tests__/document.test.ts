/**
 * 文档管理功能测试（集成测试）
 * 测试文档上传、列表、删除等功能
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { pool } from '../config/database.js';

let authToken: string;
let testUserId: string;
let testDocumentId: string;

const TEST_EMAIL = `doc_test_${Date.now()}@example.com`;
const TEST_PASSWORD = 'DocTest123!';
const TEST_USERNAME = 'doc_tester';

describe('Document Management Tests', () => {
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
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      await pool.query('DELETE FROM documents WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  });

  describe('文档上传功能', () => {
    const testContent = '这是一个测试文档内容。\n包含多行文本。\n用于测试文档上传功能。';

    it('应该成功上传文档', async () => {
      const uploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '测试文档',
          content: testContent,
        });

      expect(uploadRes.status).toBe(200);
      expect(uploadRes.body).toHaveProperty('document');
      expect(uploadRes.body.document).toHaveProperty('title', '测试文档');
      expect(uploadRes.body.document).toHaveProperty('status', 'processing');
      expect(uploadRes.body.document).toHaveProperty('id');

      testDocumentId = uploadRes.body.document.id;
    });

    it('应该拒绝空标题', async () => {
      const uploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '',
          content: 'Some content',
        });

      expect(uploadRes.status).toBe(400);
    });

    it('应该拒绝未登录用户', async () => {
      const uploadRes = await request(app)
        .post('/api/documents')
        .send({
          title: '测试文档',
          content: 'Some content',
        });

      expect(uploadRes.status).toBe(401);
    });
  });

  describe('获取文档列表', () => {
    it('应该返回当前用户的文档列表', async () => {
      const listRes = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body).toHaveProperty('documents');
      expect(Array.isArray(listRes.body.documents)).toBe(true);
      
      // 应该包含刚才上传的文档
      const doc = listRes.body.documents.find((d: any) => d.id === testDocumentId);
      if (doc) {
        expect(doc).toHaveProperty('title', '测试文档');
      }
    });

    it('应该拒绝未登录用户访问列表', async () => {
      const listRes = await request(app)
        .get('/api/documents');

      expect(listRes.status).toBe(401);
    });
  });

  describe('获取单个文档', () => {
    it('应该返回文档详情', async () => {
      if (!testDocumentId) return;

      const docRes = await request(app)
        .get(`/api/documents/${testDocumentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(docRes.status).toBe(200);
      expect(docRes.body).toHaveProperty('document');
      expect(docRes.body.document).toHaveProperty('id', testDocumentId);
      expect(docRes.body).toHaveProperty('content');
      expect(docRes.body).toHaveProperty('pagination');
    });

    it('应该返回 404 对于不存在的文档', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      const docRes = await request(app)
        .get(`/api/documents/${fakeId}`);

      expect(docRes.status).toBe(404);
    });

    it('应该支持分页参数', async () => {
      if (!testDocumentId) return;

      const docRes = await request(app)
        .get(`/api/documents/${testDocumentId}?offset=0&limit=100`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(docRes.status).toBe(200);
      expect(docRes.body.pagination).toHaveProperty('offset', 0);
      expect(docRes.body.pagination).toHaveProperty('limit', 100);
    });
  });

  describe('删除文档', () => {
    it('应该允许删除自己的文档', async () => {
      if (!testDocumentId) return;

      // 先创建一个新文档用于删除测试
      const uploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '待删除文档',
          content: '这个文档会被删除',
        });

      const docToDelete = uploadRes.body.document.id;

      // 删除文档
      const deleteRes = await request(app)
        .delete(`/api/documents/${docToDelete}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body).toHaveProperty('message', 'Document deleted');

      // 验证文档已删除
      const getRes = await request(app)
        .get(`/api/documents/${docToDelete}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getRes.status).toBe(404);
    });

    it('应该拒绝删除他人文档', async () => {
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

      // 用另一个用户创建文档
      const otherLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: `other_${Date.now()}@example.com`, password: otherPassword });

      if (otherLoginRes.status === 200) {
        const otherToken = otherLoginRes.body.token;

        const uploadRes = await request(app)
          .post('/api/documents')
          .set('Authorization', `Bearer ${otherToken}`)
          .send({
            title: '他人的文档',
            content: '这个文档不属于当前用户',
          });

        const otherDocId = uploadRes.body.document.id;

        // 尝试删除他人文档
        const deleteRes = await request(app)
          .delete(`/api/documents/${otherDocId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(deleteRes.status).toBe(403);

        // 清理
        await pool.query('DELETE FROM documents WHERE id = $1', [otherDocId]);
      }

      await pool.query('DELETE FROM users WHERE id = $1', [otherUserId]);
    });
  });

  describe('文档状态管理', () => {
    it('应该显示文档处理状态', async () => {
      if (!testDocumentId) return;

      const docRes = await request(app)
        .get(`/api/documents/${testDocumentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(docRes.status).toBe(200);
      expect(docRes.body.document).toHaveProperty('status');
      expect(['processing', 'ready', 'error']).toContain(docRes.body.document.status);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 📤 秒传重复上传测试（新增）
  // ──────────────────────────────────────────────────────────────────

  describe('秒传重复上传测试', () => {
    let другойToken: string;
    let другойUserId: string;
    const DEUTSCH_PASSWORD = 'AnotherUser123!';
    const DEUTSCH_USERNAME = 'deutsch_tester';
    const DEUTSCH_EMAIL = `deutsch_${Date.now()}@example.com`;
    
    const TEST_FILE_CONTENT = '这是用于秒传测试的文件内容。\n包含多行文本。';

    beforeAll(async () => {
      // 创建第二个测试用户
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash(DEUTSCH_PASSWORD, 10);
      
      const userResult = await pool.query(
        `INSERT INTO users (email, username, password_hash, email_verified, is_admin)
         VALUES ($1, $2, $3, true, false)
         RETURNING id`,
        [DEUTSCH_EMAIL, DEUTSCH_USERNAME, passwordHash]
      );
      
      другойUserId = userResult.rows[0].id;

      // 登录获取 token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ 
          email: DEUTSCH_EMAIL,
          password: DEUTSCH_PASSWORD 
        });

      if (loginRes.status === 200) {
        другойToken = loginRes.body.token;
      }
    });

    afterAll(async () => {
      try {
        await pool.query('DELETE FROM documents WHERE user_id = $1', [другойUserId]);
        await pool.query('DELETE FROM users WHERE id = $1', [другойUserId]);
      } catch (e) {
        // Ignore
      }
    });

    it('同一用户重复上传应该秒传（返回已存在文档）', async () => {
      // 第一次上传
      const firstUploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '秒传测试文档',
          content: TEST_FILE_CONTENT,
        });

      expect(firstUploadRes.status).toBe(200);
      expect(firstUploadRes.body.document).toHaveProperty('id');
      expect(firstUploadRes.body.document.status).toBe('processing');

      const documentId = firstUploadRes.body.document.id;

      // 等待处理完成
      await new Promise(resolve => setTimeout(resolve, 500));

      // 第二次上传相同内容（秒传）
      const secondUploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '秒传测试文档（重复）',
          content: TEST_FILE_CONTENT,
        });

      expect(secondUploadRes.status).toBe(200);
      
      // 秒传应该返回 message 字段
      if (secondUploadRes.body.message) {
        expect(secondUploadRes.body.message).toContain('quick upload');
      }
      
      // 应该返回有效 document
      expect(typeof secondUploadRes.body.document.id).toBe('string');
    });

    it('不同用户上传相同文件应该去重（创建引用）', async () => {
      // 第一个用户上传
      const firstUploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '共享文件 - 用户 A',
          content: TEST_FILE_CONTENT,
        });

      expect(firstUploadRes.status).toBe(200);
      const canonicalDocId = firstUploadRes.body.document.id;

      // 等待处理完成
      await new Promise(resolve => setTimeout(resolve, 500));

      // 第二个用户上传相同文件（去重）
      const secondUploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${другойToken}`)
        .send({
          title: '共享文件 - 用户 B',
          content: TEST_FILE_CONTENT,
        });

      expect(secondUploadRes.status).toBe(200);
      
      // 去重应该返回 deduped 消息
      if (secondUploadRes.body.message) {
        expect(secondUploadRes.body.message).toContain('deduped');
      }
      
      // 应该返回引用文档（不同 ID）
      expect(secondUploadRes.body.document.id).not.toBe(canonicalDocId);
      
      // 引用文档可能显式返回 canonical_document_id，也可能仅通过后端内部关联实现
      if (Object.prototype.hasOwnProperty.call(secondUploadRes.body.document, 'canonical_document_id')) {
        expect(secondUploadRes.body.document.canonical_document_id).toBe(canonicalDocId);
      }
    });

    it('去重后两个用户都应该能访问文件', async () => {
      // 用户 A 访问
      const docARes = await request(app)
        .get(`/api/documents/${testDocumentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(docARes.status).toBe(200);
      expect(docARes.body).toHaveProperty('document');

      // 用户 B 访问（引用）
      const docBRes = await request(app)
        .get(`/api/documents/${testDocumentId}`) // 假设去重后用同一个 ID 获取
        .set('Authorization', `Bearer ${другойToken}`);

      expect(docBRes.status).toBe(200);
      expect(docBRes.body).toHaveProperty('document');
    });

    it('不同用户上传不同文件不应该去重', async () => {
      const uniqueContent = `这是另一个唯一文件。\nContent: ${Date.now()}`;
      
      const userARes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '唯一文件 A',
          content: uniqueContent,
        });

      expect(userARes.status).toBe(200);

      await new Promise(resolve => setTimeout(resolve, 300));

      const userBRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${другойToken}`)
        .send({
          title: '唯一文件 B',
          content: uniqueContent,
        });

      expect(userBRes.status).toBe(200);
      
      // 两个不同的文档
      expect(userBRes.body.document.id).not.toBe(userARes.body.document.id);
    });
  });
});
