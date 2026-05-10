import { expect, test } from '@playwright/test';

test.describe('プライバシーポリシーページ', () => {
  test('未認証で /privacy にアクセスできる', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page).toHaveURL(/\/privacy/);
    await expect(page.locator('h1')).toContainText('プライバシーポリシー');
    // Should not redirect to login.
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('JA で各セクションが表示される', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('text=取得する情報').first()).toBeVisible();
    await expect(page.locator('text=お問い合わせ').first()).toBeVisible();
    await expect(page.locator('text=oryzae@ephemere.io').first()).toBeVisible();
  });

  test('「トップへ戻る」リンクで / に遷移できる', async ({ page }) => {
    await page.goto('/privacy');
    await page.locator('a:has-text("トップへ戻る")').click();
    await expect(page).toHaveURL(/\/$|\/login$/);
  });

  test('locale を en に切り替えると英語版が表示される', async ({ context, page }) => {
    await context.addCookies([{ name: 'NEXT_LOCALE', value: 'en', url: 'http://localhost:3000' }]);
    await page.goto('/privacy');
    await expect(page.locator('h1')).toContainText('Privacy Policy');
    await expect(page.locator('text=Information we collect').first()).toBeVisible();
  });
});
