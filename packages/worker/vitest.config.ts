import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    global: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reportOnStatus: true,
    },
  },
  resolve: {
    alias: {
      '../db/database.js': new URL('./src/db/database.ts', import.meta.url).href,
      '../utils/logger.js': new URL('./src/utils/logger.ts', import.meta.url).href,
    },
  },
});
