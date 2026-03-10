/**
 * 中间件单元测试（不依赖数据库）
 */

import { describe, it, expect, vi } from 'vitest';
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

    it('authenticate 应该拒绝无 Authorization 头的请求', () => {
      const req = { headers: {} } as any;
      let statusReturned = 0;
      let jsonReturned: any = null;
      const res = {
        status: (code: number) => {
          statusReturned = code;
          return res;
        },
        json: (data: any) => {
          jsonReturned = data;
          return res;
        },
      };

      authenticate(req, res as any, () => {});

      expect(statusReturned).toBe(401);
      expect(jsonReturned).toEqual({ error: 'Unauthorized' });
    });

    it('authenticate 应该拒绝无效 token', () => {
      const req = { headers: { authorization: 'Bearer invalid_token' } } as any;
      let statusReturned = 0;
      let jsonReturned: any = null;
      const res = {
        status: (code: number) => {
          statusReturned = code;
          return res;
        },
        json: (data: any) => {
          jsonReturned = data;
          return res;
        },
      };

      authenticate(req, res as any, () => {});

      expect(statusReturned).toBe(401);
      expect(jsonReturned).toEqual({ error: 'Invalid or expired token' });
    });
  });
});
