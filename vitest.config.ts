import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    env: {
      OG_SITE_KEYS: 'letmoe:letmoe-secret,patch:patch-secret',
      LOG_LEVEL: 'silent',
    },
  },
});
