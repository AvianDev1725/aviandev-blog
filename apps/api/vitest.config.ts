import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

export default defineConfig({
  test: {
    env: config({ path: '.env.test' }).parsed,
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ['./tests/setup.ts'],
  },
});