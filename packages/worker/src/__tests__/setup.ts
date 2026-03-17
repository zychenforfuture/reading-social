/**
 * Worker 测试配置
 * 这个文件会在每个测试文件之前执行
 */

import { vi, afterAll } from 'vitest';

// Mock BullMQ
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    getJobs: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    isEmpty: vi.fn(async () => true),
    count: vi.fn(async () => 0),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
}));

// Mock 数据库
vi.mock('./db/database.js', () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
  },
}));

// Mock Qdrant
vi.mock('./db/qdrant-client.js', () => ({
  initializeQdrantCollection: vi.fn(),
  storeEmbedding: vi.fn(),
  findSimilarEmbeddings: vi.fn(),
  checkEmbeddingExists: vi.fn(),
}));

// Mock logger
vi.mock('./utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock setImmediate
global.setImmediate = vi.fn((cb) => {
  setImmediate(cb);
});

// 清理
afterAll(() => {
  vi.clearAllMocks();
});
