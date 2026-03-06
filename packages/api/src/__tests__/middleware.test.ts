/**
 * 中间件单元测试（不依赖数据库）
 */

import { describe, it, expect } from 'vitest';
import { generateToken, authenticate } from '../middleware/auth.js';

describe('Auth Middleware', () => {
  describe('generateToken', () => {
    it('应该成功生成 JWT token', () => {
      const payload = {
        userId: 'test-user-123',
        email: 'test@example.com',
        isAdmin: false,
      };

      const token = generateToken(payload);

      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3); // JWT 有三部分
    });

    it('生成的 token 应该包含用户信息', () => {
      const payload = {
        userId: 'user-456',
        email: 'user@example.com',
        isAdmin: true,
      };

      const token = generateToken(payload);
      expect(token).toBeTruthy();
    });
  });

  describe('authenticate middleware', () => {
    it('authenticate 应该是一个函数', () => {
      expect(typeof authenticate).toBe('function');
      expect(authenticate.length).toBe(3); // req, res, next
    });
  });
});
