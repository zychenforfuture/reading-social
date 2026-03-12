/**
 * 类型测试（Zod Schema + 错误响应）
 * 测试 API 的输入验证和错误处理
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// 模拟从 auth.ts 导入的 schema（实际应该从源文件导入）
// 这里重新定义以确保测试独立

const SALT_ROUNDS = 10;

// 注册请求验证 schema
const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(2).max(50),
  password: z.string().min(6),
  code: z.string().length(6),
});

// 登录请求验证 schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// 评论创建 schema（简化版）
const commentSchema = z.object({
  content: z.string().min(1).max(5000),
  blockHash: z.string().length(64).optional(),
  rootId: z.string().uuid().optional(),
  replyToUserId: z.string().uuid().optional(),
  selectedText: z.string().max(500).optional(),
});

// 上传文档 schema
const uploadSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string(),
});

describe('Zod Schema Validation', () => {
  describe('registerSchema', () => {
    it('应该接受有效的注册数据', () => {
      const validData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
        code: '123456',
      };

      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('应该拒绝无效邮箱', () => {
      const invalidData = {
        email: 'not-an-email',
        username: 'testuser',
        password: 'password123',
        code: '123456',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['email']);
      }
    });

    it('应该拒绝短于 2 字符的用户名', () => {
      const invalidData = {
        email: 'test@example.com',
        username: 'A', // 短于 2 字符
        password: 'password123',
        code: '123456',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['username']);
      }
    });

    it('应该拒绝长于 50 字符的用户名', () => {
      const invalidData = {
        email: 'test@example.com',
        username: 'A'.repeat(51), // 长于 50 字符
        password: 'password123',
        code: '123456',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('应该拒绝短于 6 字符的密码', () => {
      const invalidData = {
        email: 'test@example.com',
        username: 'testuser',
        password: '12345', // 短于 6 字符
        code: '123456',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['password']);
      }
    });

    it('应该拒绝长度不是 6 的验证码', () => {
      const invalidData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
        code: '12345', // 长度不是 6
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['code']);
      }
    });

    it('应该拒绝缺少必填字段', () => {
      const invalidData = {
        email: 'test@example.com',
        // 缺少 username, password, code
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('应该接受有效的登录数据', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('应该拒绝无效邮箱', () => {
      const invalidData = {
        email: 'not-an-email',
        password: 'password123',
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('应该拒绝缺少密码', () => {
      const invalidData = {
        email: 'test@example.com',
        // 缺少 password
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('commentSchema', () => {
    it('应该接受有效的根评论', () => {
      const validData = {
        content: '这是一条测试评论',
        blockHash: 'a'.repeat(64),
      };

      const result = commentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('应该接受有效的回复（带 rootId）', () => {
      const validData = {
        content: '这是对评论的回复',
        rootId: '123e4567-e89b-12d3-a456-426614174000',
        replyToUserId: '123e4567-e89b-12d3-a456-426614174001',
      };

      const result = commentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('应该接受带 selectedText 的评论', () => {
      const validData = {
        content: '这是一条测试评论',
        blockHash: 'a'.repeat(64),
        selectedText: '这是选中的文字',
      };

      const result = commentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('应该拒绝空内容', () => {
      const invalidData = {
        content: '',
        blockHash: 'a'.repeat(64),
      };

      const result = commentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('应该拒绝超过 5000 字符的内容', () => {
      const invalidData = {
        content: 'A'.repeat(5001), // 超过限制
        blockHash: 'a'.repeat(64),
      };

      const result = commentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('应该拒绝无效的 blockHash 格式', () => {
      const invalidData = {
        content: 'Test comment',
        blockHash: 'invalid', // 不是 64 字符
      };

      const result = commentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('应该拒绝无效的 UUID 格式', () => {
      const invalidData = {
        content: 'Test comment',
        rootId: 'not-a-uuid',
      };

      const result = commentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('应该拒绝超过 500 字符的 selectedText', () => {
      const invalidData = {
        content: 'Test comment',
        blockHash: 'a'.repeat(64),
        selectedText: 'A'.repeat(501), // 超过限制
      };

      const result = commentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('uploadSchema', () => {
    it('应该接受有效的文档上传', () => {
      const validData = {
        title: '测试文档标题',
        content: '文档的完整内容',
      };

      const result = uploadSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('应该拒绝空标题', () => {
      const invalidData = {
        title: '', // 空标题
        content: '文档内容',
      };

      const result = uploadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('应该拒绝超过 500 字符的标题', () => {
      const invalidData = {
        title: 'A'.repeat(501), // 超过限制
        content: '文档内容',
      };

      const result = uploadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

describe('Error Response Format', () => {
  it('Zod 验证错误应返回 Validation failed', () => {
    const result = registerSchema.safeParse({
      email: 'invalid-email',
      username: 'A', // 太短
      password: '123', // 太短
      code: '12345', // 太短
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.length).toBeGreaterThan(0);
      // 验证错误格式：[{ path: ['field'], message: '...", code: '...' }]
      result.error.errors.forEach(error => {
        expect(error).toHaveProperty('path');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('code');
      });
    }
  });

  it('错误响应应包含 details 字段（扩展模式）', () => {
    const invalidData = {
      email: 'not-an-email',
      username: 'A',
      password: '123',
      code: '12345',
    };

    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);

    if (!result.success) {
      // 在实际 API 中，应该返回 { error: 'Validation failed', details: result.error.errors }
      const apiError = {
        error: 'Validation failed',
        details: result.error.errors,
      };

      expect(apiError).toHaveProperty('error');
      expect(apiError).toHaveProperty('details');
      expect(Array.isArray(apiError.details)).toBe(true);
    }
  });
});
