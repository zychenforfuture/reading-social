/**
 * SimHash 单元测试
 * 测试 SimHash 计算、海明距离、相似度判断等核心功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeSimHash,
  hammingDistance,
  similarityFromDistance,
  isSimilar,
} from '../utils/simhash.js';

describe('SimHash - 核心功能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('computeSimHash - SimHash 计算', () => {
    it('应该返回 16 位十六进制字符串', () => {
      const hash = computeSimHash('测试文本');
      expect(hash).toHaveLength(16);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });

    it('应该对相同文本返回相同的 SimHash', () => {
      const text = '这是一段测试文本';
      const hash1 = computeSimHash(text);
      const hash2 = computeSimHash(text);
      expect(hash1).toBe(hash2);
    });

    it('应该对不同文本返回不同的 SimHash', () => {
      const hash1 = computeSimHash('这是文本一');
      const hash2 = computeSimHash('这是文本二');
      expect(hash1).not.toBe(hash2);
    });

    it('应该对空文本返回全 0', () => {
      const hash = computeSimHash('');
      expect(hash).toBe('0000000000000000');
    });

    it('应该对相似文本返回接近的 SimHash', () => {
      const text1 = '这是一段关于编程的测试文本';
      const text2 = '这是一段关于编程的测试文本'; // 相同
      const text3 = '这是一段关于编程的测试文本'; // 相同

      const hash1 = computeSimHash(text1);
      const hash2 = computeSimHash(text2);
      const hash3 = computeSimHash(text3);

      expect(hash1).toBe(hash2);
      expect(hash1).toBe(hash3);
    });
  });

  describe('hammingDistance - 海明距离', () => {
    it('应该返回 0 对于相同哈希', () => {
      const hash = computeSimHash('测试');
      expect(hammingDistance(hash, hash)).toBe(0);
    });

    it('应该正确计算两个不同哈希的海明距离', () => {
      const hash1 = 'f000000000000000';
      const hash2 = '0000000000000000';
      expect(hammingDistance(hash1, hash2)).toBe(4); // F = 1111
    });

    it('应该对无效哈希抛出错误', () => {
      expect(() => hammingDistance('invalid', '0000000000000000'))
        .toThrow('Invalid hash length');
      expect(() => hammingDistance('f000000000000000', 'invalid'))
        .toThrow('Invalid hash length');
    });

    it('应该计算随机哈希的海明距离', () => {
      const hash1 = computeSimHash('文本一');
      const hash2 = computeSimHash('文本二');
      
      const distance = hammingDistance(hash1, hash2);
      expect(distance).toBeGreaterThanOrEqual(0);
      expect(distance).toBeLessThanOrEqual(64);
    });
  });

  describe('similarityFromDistance - 相似度计算', () => {
    it('应该返回 1 对于海明距离 0', () => {
      expect(similarityFromDistance(0)).toBe(1);
    });

    it('应该返回 0 对于海明距离 64', () => {
      expect(similarityFromDistance(64)).toBe(0);
    });

    it('应该返回正确的相似度分数', () => {
      expect(similarityFromDistance(32)).toBe(0.5);
      expect(similarityFromDistance(16)).toBeCloseTo(0.75);
    });
  });

  describe('isSimilar - 相似度判断', () => {
    it('应该判断相同哈希为相似', () => {
      const hash = computeSimHash('测试');
      expect(isSimilar(hash, hash)).toBe(true);
    });

    it('应该使用默认阈值 3 判断相似性', () => {
      const hash1 = computeSimHash('这是一段测试文本');
      const hash2 = computeSimHash('这是一段测试文本');
      const hash3 = '0000000000000000';

      expect(isSimilar(hash1, hash2)).toBe(true);
      expect(isSimilar(hash1, hash3)).toBe(false);
    });

    it('应该使用自定义阈值判断相似性', () => {
      const hash1 = computeSimHash('文本一');
      const hash2 = '0000000000000000';

      expect(isSimilar(hash1, hash2, 64)).toBe(true);
      expect(isSimilar(hash1, hash2, 0)).toBe(false);
    });
  });
});
