import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    testTimeout: 30000,
    // 跳过覆盖率检查（初次配置）
    coverage: {
      enabled: false,
    },
  },
});
