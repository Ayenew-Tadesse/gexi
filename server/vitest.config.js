import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test' },
    globalSetup: './test/globalSetup.js',
    fileParallelism: false,
    testTimeout: 20000,
  },
});
