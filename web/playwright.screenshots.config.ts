import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/screenshots', outputDir: './test-results/screenshots',
  workers: 1, timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:4176', channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', viewport: { width: 1600, height: 1100 }, trace: 'retain-on-failure' },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4176 --strictPort', url: 'http://127.0.0.1:4176', reuseExistingServer: false },
});
