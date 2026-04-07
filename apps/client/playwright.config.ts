import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      'pnpm --filter @oryzae/shared build && pnpm --filter @oryzae/server build && pnpm --filter @oryzae/client dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    cwd: '../..',
    timeout: 120000,
  },
});
