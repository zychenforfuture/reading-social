/**
 * Mock database connection for unit tests
 * This replaces the real PostgreSQL connection with a mock
 */

export const pool = {
  query: vi.fn(),
  connect: vi.fn(),
  end: vi.fn(),
};

export const mockQuery = (sql: string, values?: any[]) => {
  // 实现一个简单的 SQL 解析器，用于返回预设结果
  // 实际项目中应该使用更完整的 mock 库
};
