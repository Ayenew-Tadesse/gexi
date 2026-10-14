import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test', UPLOAD_DIR: '/tmp/gexi-test-uploads/' },
    globalSetup: './test/globalSetup.js',
    fileParallelism: false,
    testTimeout: 20000,
  },
});
