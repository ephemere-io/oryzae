import { expect, test } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'test@oryzae.dev';
const TEST_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'TestAdmin2026!';

test.describe('管理者認証フロー', () => {
  test('ログインして /dashboard にリダイレクト', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('text=Oryzae Admin')).toBeVisible();
    await expect(page.locator('text=管理者アカウントでログイン')).toBeVisible();

    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button:has-text("ログイン")');

    await page.waitForURL('**/dashboard**');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('未認証で /dashboard にアクセスすると /login にリダイレクト', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login**');
    await expect(page).toHaveURL(/\/login/);
  });

  test('ログアウト', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button:has-text("ログイン")');
    await page.waitForURL('**/dashboard**');

    // Logout
    await page.click('button:has-text("Logout")');
    await page.waitForURL('**/login**');
    await expect(page).toHaveURL(/\/login/);
  });
});
