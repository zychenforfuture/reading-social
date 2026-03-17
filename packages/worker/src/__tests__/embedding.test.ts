/**
 * Embedding 单元测试
 * 测试 embedding 模块的结构和导出
 */

import { describe, it, expect, vi } from 'vitest';

describe('Embedding - 模块结构测试', () => {
  it('应该导出 getEmbeddingPipeline 函数', async () => {
    const module = await import('../utils/embedding.js');
    expect(typeof module.getEmbeddingPipeline).toBe('function');
  });

  it('应该导出 generateEmbedding 函数', async () => {
    const module = await import('../utils/embedding.js');
    expect(typeof module.generateEmbedding).toBe('function');
  });
});
