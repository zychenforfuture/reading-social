/**
 * JWT_SECRET 验证测试脚本
 * 测试不同复杂度的 JWT_SECRET 是否能被正确验证
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// 模拟 validateStartupEnv 函数
function estimateEntropy(str: string): number {
  const freq = new Map<string, number>();
  for (const char of str) {
    freq.set(char, (freq.get(char) ?? 0) + 1);
  }
  let entropy = 0;
  const len = str.length;
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function validateJWTSecret(jwtSecret: string): { valid: boolean; error?: string } {
  // 检查默认值
  if (jwtSecret === 'dev-secret-change-in-prod') {
    return { valid: false, error: 'JWT_SECRET 不能使用默认值' };
  }

  // 检查弱模式（先于长度检查，这样可以明确告知用户具体问题）
  const weakPatterns = ['123456', 'abcdef', 'password', 'secret', 'qwerty', 'admin'];
  const lowerSecret = jwtSecret.toLowerCase();
  for (const pattern of weakPatterns) {
    if (lowerSecret.includes(pattern)) {
      return { valid: false, error: `JWT_SECRET 包含弱模式 "${pattern}"` };
    }
  }

  // 检查长度
  if (jwtSecret.length < 32) {
    return { valid: false, error: 'JWT_SECRET 长度不足 32 字符' };
  }

  // 检查熵值
  const entropy = estimateEntropy(jwtSecret);
  if (entropy < 3.5) {
    return { valid: false, error: `JWT_SECRET 熵值过低 (${entropy.toFixed(2)} < 3.5)` };
  }

  return { valid: true };
}

describe('JWT_SECRET 验证测试', () => {
  describe('长度验证', () => {
    it('应该拒绝短于 32 字符的密钥', () => {
      const result = validateJWTSecret('shortsecret');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('长度不足');
    });

    it('应该接受恰好 32 字符的密钥', () => {
      const result = validateJWTSecret('thisisexactly32characterssecret!');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('应该接受长于 32 字符的密钥', () => {
      const result = validateJWTSecret('thisisalongersecretkeywithmorethan32chars');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('默认值验证', () => {
    it('应该拒绝默认开发密钥', () => {
      const result = validateJWTSecret('dev-secret-change-in-prod');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('不能使用默认值');
    });
  });

  describe('熵值验证', () => {
    it('应该拒绝低熵值的重复字符密钥', () => {
      const result = validateJWTSecret('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('熵值过低');
    });

    it('应该拒绝低熵值的简单模式密钥', () => {
      const result = validateJWTSecret('abcabcabcabcabcabcabcabcabcabcabcabc');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('熵值过低');
    });

    it('应该接受高熵值的随机密钥', () => {
      const result = validateJWTSecret('xK7#mP9$vL2@nQ8&wR5!zT3*yF6%dS1+gH4');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('弱模式验证', () => {
    it('应该拒绝包含 "123456" 的密钥', () => {
      const result = validateJWTSecret('validlengthsecret123456!moretext');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('弱模式');
      expect(result.error).toContain('123456');
    });

    it('应该拒绝包含 "password" 的密钥', () => {
      const result = validateJWTSecret('validlengthsecretPassword!moretext');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('弱模式');
      expect(result.error).toContain('password');
    });

    it('应该拒绝包含 "admin" 的密钥', () => {
      const result = validateJWTSecret('validlengthsecretAdmin!moretext');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('弱模式');
      expect(result.error).toContain('admin');
    });
  });

  describe('综合验证', () => {
    it('应该接受 openssl rand -hex 32 生成的密钥', () => {
      // 模拟 openssl rand -hex 32 生成的密钥
      const result = validateJWTSecret('a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('应该接受 openssl rand -base64 32 生成的密钥', () => {
      // 模拟 openssl rand -base64 32 生成的密钥
      const result = validateJWTSecret('XK7+mP9$vL2@nQ8&wR5!zT3*yF6%dS1+gH4==');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});