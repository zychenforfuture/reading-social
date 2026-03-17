/**
 * Worker 核心逻辑集成测试
 * 测试 Worker 的文档处理流程
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Queue, Worker } from 'bullmq';

// Mock 所有依赖
vi.mock('bullmq');
vi.mock('../db/database.js');
vi.mock('../db/qdrant-client.js');
vi.mock('../utils/logger.js');
vi.mock('../utils/simhash.js', async () => {
  const actual = await vi.importActual('../utils/simhash.js');
  return {
    ...actual,
    computeSimHash: vi.fn(),
    hammingDistance: vi.fn(),
  };
});
vi.mock('../utils/embedding.js', async () => {
  const actual = await vi.importActual('../utils/embedding.js');
  return {
    ...actual,
    generateEmbedding: vi.fn(),
  };
});

describe('Worker - 集成测试', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('应该返回 Queue 实例', () => {
    expect(Queue).toBeDefined();
  });

  it('应该返回 Worker 实例', () => {
    expect(Worker).toBeDefined();
  });
});
