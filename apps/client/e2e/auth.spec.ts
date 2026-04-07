import { expect, test } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'yukiagatsuma@gmail.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'Test123456';

test.describe('認証フロー', () => {
  test('ログインして /entries にリダイレクト', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('h1')).toHaveText('Oryzae');
    await expect(page.locator('text=ログインして続ける')).toBeVisible();

    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button:has-text("ログイン")');

    await page.waitForURL('**/entries**');
    await expect(page).toHaveURL(/\/entries/);
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
    await expect(page.locator('text=ログイン')).toBeVisible();
  });

  test('ログインとサインアップ間のリンク遷移', async ({ page }) => {
    await page.goto('/login');
    await page.click('a:has-text("サインアップ")');
    await expect(page).toHaveURL(/\/signup/);

    await page.click('a:has-text("ログイン")');
    await expect(page).toHaveURL(/\/login/);
  });
});
