import { defineConfig, devices } from '@playwright/test';

// CI は :3000 を立ち上げて使う。ローカルでは E2E_BASE_URL で別ポート（例: 隔離
// worktree の dev server）に向けて、起動済みサーバーを再利用できる。
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    locale: 'ja-JP',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      'pnpm --filter @oryzae/shared build && pnpm --filter @oryzae/server build && pnpm --filter @oryzae/client dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    cwd: '../..',
    timeout: 120000,
  },
});
