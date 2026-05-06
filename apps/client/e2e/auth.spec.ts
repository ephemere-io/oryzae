import { expect, test } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'yukiagatsuma@gmail.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'Test123456';

test.describe('認証フロー', () => {
  test('ログインして /entries/new にリダイレクト', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('h1')).toHaveText('Oryzae');
    await expect(page.locator('text=ログインして続ける')).toBeVisible();

    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button:has-text("ログイン")');

    await page.waitForURL('**/entries/new**');
    await expect(page).toHaveURL(/\/entries\/new/);
  });

  test('未認証で /entries にアクセスすると /login にリダイレクト', async ({ page }) => {
    await page.goto('/entries');
    await page.waitForURL('**/login**');
    await expect(page).toHaveURL(/\/login/);
  });

  test('サインアップページが表示される', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('h1')).toHaveText('Oryzae');
    await expect(page.locator('text=アカウントを作成')).toBeVisible();
    await expect(page.locator('a:has-text("ログイン")')).toBeVisible();
  });

  test('ログインとサインアップ間のリンク遷移', async ({ page }) => {
    await page.goto('/login');
    await page.click('a:has-text("サインアップ")');
    await expect(page).toHaveURL(/\/signup/);

    await page.click('a:has-text("ログイン")');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('言語切替', () => {
  test('/login の言語切替ボタンで英訳が表示され cookie が保存される', async ({ page, context }) => {
    await context.addCookies([
      { name: 'NEXT_LOCALE', value: 'ja', domain: 'localhost', path: '/' },
    ]);
    await page.goto('/login');
    await expect(page.locator('text=ログインして続ける')).toBeVisible();

    await page.getByRole('button', { name: 'Toggle language' }).click();
    await expect(page.locator('text=Log in to continue')).toBeVisible();

    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'NEXT_LOCALE')?.value).toBe('en');
  });

  test('言語切替が認証ページ間 (/login → /signup) で保持される', async ({ page, context }) => {
    await context.addCookies([
      { name: 'NEXT_LOCALE', value: 'ja', domain: 'localhost', path: '/' },
    ]);
    await page.goto('/login');
    await page.getByRole('button', { name: 'Toggle language' }).click();
    await expect(page.locator('text=Log in to continue')).toBeVisible();

    await page.goto('/signup');
    await expect(page.locator('text=Create your account')).toBeVisible();
  });

  test('/login で切り替えた言語が landing にも反映される', async ({ page, context }) => {
    await context.addCookies([
      { name: 'NEXT_LOCALE', value: 'ja', domain: 'localhost', path: '/' },
    ]);
    await page.goto('/login');
    await page.getByRole('button', { name: 'Toggle language' }).click();
    await expect(page.locator('text=Log in to continue')).toBeVisible();

    await page.goto('/');
    await expect(page.locator('h1')).toContainText('ferment');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
