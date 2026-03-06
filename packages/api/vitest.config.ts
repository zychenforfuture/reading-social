import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    testTimeout: 10000,
    coverage: {
      enabled: false,
    },
    // 排除需要数据库的测试（CI 环境会自动运行）
    exclude: ['**/auth.test.ts'],
  },
});
