import { expect, test } from './fixtures/auth';

test.describe('ダッシュボード', () => {
  test('統計カードが表示される', async ({ page, authenticated }) => {
    void authenticated;
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Users')).toBeVisible();
    await expect(page.locator('text=Entries')).toBeVisible();
    await expect(page.locator('text=Fermentations')).toBeVisible();
    await expect(page.locator('text=Success Rate')).toBeVisible();
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
