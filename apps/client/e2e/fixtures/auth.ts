import { test as base, expect } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'yukiagatsuma@gmail.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'Test123456';

// biome-ignore lint/suspicious/noConfusingVoidType: Playwright fixture type requires void for auto fixtures
export const test = base.extend<{ authenticated: void }>({
  authenticated: [
    async ({ page }, use) => {
      await page.goto('/login');
      // ログインのユーザー欄は nickname/email 兼用で type="text"（type="email" ではない）。
      await page.getByPlaceholder('nickname or email@example.com').fill(TEST_EMAIL);
      await page.locator('input[type="password"]').fill(TEST_PASSWORD);
      // 「Google でログイン」とも部分一致するため exact で「ログイン」ボタンを特定する。
      await page.getByRole('button', { name: 'ログイン', exact: true }).click();
      // ログイン後はホームへ。既定は書斎（/study）、書斎を止めていれば /entries/new。
      await page.waitForURL(/\/(study|entries)/);
      await use();
    },
    { auto: false },
  ],
});

export { expect };
