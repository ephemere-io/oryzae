import { expect, test } from './fixtures/auth';

test.describe('ダッシュボード', () => {
  test('統計カードが表示される', async ({ page, authenticated }) => {
    void authenticated;
    // `text=` はサイドバーのリンクや別セクションの見出しとも一致し、
    // strict mode violation になる（Fermentations は3要素にマッチしていた）。
    // 統計カードは main 配下に限定し、複数一致は first() で受ける。
    const main = page.locator('main');
    for (const label of ['Users', 'Entries', 'Fermentations', 'Success Rate']) {
      await expect(main.getByText(label).first()).toBeVisible();
    }
  });

  test('サイドバーナビゲーションが動作する', async ({ page, authenticated }) => {
    void authenticated;

    // Navigate to Users
    await page.click('nav >> a:has-text("Users")');
    await expect(page).toHaveURL(/\/users/);

    // Navigate to Fermentations
    await page.click('nav >> a:has-text("Fermentations")');
    await expect(page).toHaveURL(/\/fermentations/);

    // Navigate to Costs
    await page.click('nav >> a:has-text("Costs")');
    await expect(page).toHaveURL(/\/costs/);

    // Navigate to Analytics
    await page.click('nav >> a:has-text("Analytics")');
    await expect(page).toHaveURL(/\/analytics/);

    // Back to Dashboard
    await page.click('nav >> a:has-text("Dashboard")');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
