import { defineConfig, devices } from '@playwright/test';

// CI は :3000 を立ち上げて使う。ローカルでは E2E_BASE_URL で別ポート（例: 隔離
// worktree の dev server）に向けて、起動済みサーバーを再利用できる。
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // 既定 30s では「入力 → 自動保存(debounce) → 一覧に反映 → 開き直し」の一連が
  // ネットワーク往復込みで収まらずフレークしていた。実測 20-40s のため 60s にする。
  timeout: 60_000,
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
