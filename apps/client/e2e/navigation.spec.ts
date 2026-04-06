import { expect, test } from './fixtures/auth';

test.describe('ナビゲーション', () => {
  test.beforeEach(async ({ authenticated }) => {
    // ログイン済み状態
  });

  test('サイドバーからエントリ一覧に遷移', async ({ page }) => {
    await page.goto('/questions');
    await page.click('a[href="/entries"]');
    await expect(page).toHaveURL(/\/entries/);
  });

  test('サイドバーから質問ページに遷移', async ({ page }) => {
    await page.click('a[href="/questions"]');
    await expect(page).toHaveURL(/\/questions/);
  });

  test('サイドバーからエディタに遷移', async ({ page }) => {
    await page.click('a[href="/entries/new"]');
    await expect(page).toHaveURL(/\/entries\/new/);
  });
});
