import { test as base, expect } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'yukiagatsuma@gmail.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'Test123456';

// biome-ignore lint/suspicious/noConfusingVoidType: Playwright fixture type requires void for auto fixtures
export const test = base.extend<{ authenticated: void }>({
  authenticated: [
    async ({ page }, use) => {
      await page.goto('/login');
      await page.fill('input[type="email"]', TEST_EMAIL);
      await page.fill('input[type="password"]', TEST_PASSWORD);
      await page.click('button:has-text("ログイン")');
      await page.waitForURL('**/entries**');
      await use();
    },
    { auto: false },
  ],
});

export { expect };
