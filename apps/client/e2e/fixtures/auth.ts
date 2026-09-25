import { test as base, expect } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'yukiagatsuma@gmail.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'Test123456';

// biome-ignore lint/suspicious/noConfusingVoidType: Playwright fixture type requires void for auto fixtures
export const test = base.extend<{ authenticated: void }>({
  authenticated: [
    async ({ page }, use) => {
      await page.goto('/login');
      // ログインのユーザー欄は nickname/email 兼用で type="text"（type="email" ではない）。
      const identifier = page.getByPlaceholder('nickname or email@example.com');
      /**
       * **SP は入力欄が畳まれている。**
       *
       * 扉の画面（PR #624）では、SP の紙は「Google でログイン」と「メールアドレスでログイン」の
       * 2 つだけで始まり、後者を押すと入力欄が開く。畳んでいる間も input は DOM に居るので、
       * locator は解決するが `not visible` で fill が 60 秒待って落ちる。PC は最初から開いている。
       */
      const openEmail = page.getByRole('button', { name: 'メールアドレスでログイン' });
      await expect(identifier.or(openEmail).first()).toBeVisible();
      if (!(await identifier.isVisible())) await openEmail.click();
      await identifier.fill(TEST_EMAIL);
      await page.locator('input[type="password"]').fill(TEST_PASSWORD);
      // 「Google でログイン」とも部分一致するため exact で「ログイン」ボタンを特定する。
      await page.getByRole('button', { name: 'ログイン', exact: true }).click();
      // ログイン後はホームへ。既定は書斎（ルート /）、書斎を止めていれば /entries/new。
      await page.waitForURL((url) => url.pathname === '/' || url.pathname.startsWith('/entries'));
      await use();
    },
    { auto: false },
  ],
});

export { expect };
