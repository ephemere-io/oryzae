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
  // 失敗1件あたり timeout×(1+retries) を消費する。60s へ上げたぶん
  // リトライは 1 回に減らす（2 回だと 8 件失敗で 25 分の上限に当たった）。
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    locale: 'ja-JP',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // 指で触る分は mobile-chrome で見る（Desktop Chrome には touch が無い）。
      testIgnore: /sp-board\.spec\.ts/,
    },
    {
      /**
       * **指の経路を実際に通すためのプロジェクト。**
       *
       * SP の E2E はこれまで Desktop Chrome の viewport を狭めるだけで、タップも
       * ピンチも再現できなかった。そのため「盤面がピンチをブラウザに奪われる」
       * 「タップしても前面に出ない」という壊れ方を CI が一度も拾えず、実機レビューで
       * 続けて指摘された。Pixel 5 は chromium 系なので、CI のブラウザ導入は増えない。
       */
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: /sp-board\.spec\.ts/,
    },
  ],
  webServer: {
    command:
      'pnpm --filter @oryzae/shared build && pnpm --filter @oryzae/server build && pnpm --filter @oryzae/client dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    cwd: '../..',
    timeout: 120000,
  },
});
