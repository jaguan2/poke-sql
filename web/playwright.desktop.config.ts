import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', testMatch: '**/desktop.spec.ts', outputDir: './test-results/desktop', workers: 1, timeout: 45000 });
