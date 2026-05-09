import { expect, test } from '@playwright/test';

test.describe('サポートページ', () => {
  test('未認証で /support にアクセスできる', async ({ page }) => {
    await page.goto('/support');
    await expect(page.locator('h1')).toContainText('使い方');
    // 主要セクションの見出しが表示される
    await expect(page.locator('text=基本の流れ').first()).toBeVisible();
    await expect(page.locator('text=エディタのエフェクト').first()).toBeVisible();
    await expect(page.locator('text=よくある質問').first()).toBeVisible();
  });

  test('言語トグルで EN に切り替わる', async ({ page }) => {
    await page.goto('/support');
    await page.locator('button:has-text("English")').click();
    await expect(page.locator('h1')).toContainText('How to use Oryzae');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('FAQ を開閉できる', async ({ page }) => {
    await page.goto('/support');
    const firstFaqButton = page
      .locator('button[aria-expanded]')
      .filter({ hasText: 'AIは何を読みますか' });
    await expect(firstFaqButton).toHaveAttribute('aria-expanded', 'false');
    await firstFaqButton.click();
    await expect(firstFaqButton).toHaveAttribute('aria-expanded', 'true');
  });

  test('目次のアンカーリンクで該当セクションへ移動する', async ({ page }) => {
    await page.goto('/support');
    await page.locator('nav[aria-label="目次"] a').filter({ hasText: 'エフェクト' }).click();
    await expect(page).toHaveURL(/\/support#effects$/);
  });

  test('お問い合わせ欄に oryzae@ephemere.io が記載されている', async ({ page }) => {
    await page.goto('/support');
    await expect(page.locator('a[href="mailto:oryzae@ephemere.io"]')).toBeVisible();
  });

  test('LP フッターから /support へ遷移できる', async ({ page }) => {
    await page.goto('/');
    await page.locator('footer a:has-text("ヘルプ")').click();
    await expect(page).toHaveURL(/\/support$/);
    await expect(page.locator('h1')).toContainText('使い方');
  });

  test('メタ情報がロケールに応じて切り替わる', async ({ page }) => {
    await page.goto('/support');
    await expect(page).toHaveTitle(/サポート/);

    await page.locator('button:has-text("English")').click();
    // 言語切替後の再描画を待つ
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle(/Support/);
  });
});
