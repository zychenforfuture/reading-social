import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    testTimeout: 60000, // 60 秒超时（集成测试需要更长时间）
    coverage: {
      enabled: false,
    },
  },
});
