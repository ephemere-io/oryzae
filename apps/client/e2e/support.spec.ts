import { expect, test } from '@playwright/test';

test.describe('サポートページ', () => {
  test('未認証で /support にアクセスできる', async ({ page }) => {
    await page.goto('/support');
    await expect(page).toHaveURL(/\/support/);
    await expect(page.locator('h1')).toContainText('使い方');
    // Should not redirect to login.
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('JA で各セクションが表示される', async ({ page }) => {
    await page.goto('/support');
    await expect(page.locator('text=基本の流れ').first()).toBeVisible();
    await expect(page.locator('text=エディタのエフェクト').first()).toBeVisible();
    await expect(page.locator('text=よくある質問').first()).toBeVisible();
    await expect(page.locator('text=oryzae@ephemere.io').first()).toBeVisible();
  });

  test('「トップへ戻る」リンクで / に遷移できる', async ({ page }) => {
    await page.goto('/support');
    await page.locator('a:has-text("トップへ戻る")').click();
    await expect(page).toHaveURL(/\/$|\/login$/);
  });

  test('locale を en に切り替えると英語版が表示される', async ({ context, page }) => {
    await context.addCookies([{ name: 'NEXT_LOCALE', value: 'en', url: 'http://localhost:3000' }]);
    await page.goto('/support');
    await expect(page.locator('h1')).toContainText('How to use Oryzae');
    await expect(page.locator('text=The basic rhythm').first()).toBeVisible();
  });

  test('LP フッターから /support へ遷移できる', async ({ page }) => {
    await page.goto('/');
    await page.locator('footer a:has-text("ヘルプ")').click();
    await expect(page).toHaveURL(/\/support$/);
    await expect(page.locator('h1')).toContainText('使い方');
  });
});
