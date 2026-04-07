import { expect, test } from './fixtures/auth';

test.describe('エントリ管理', () => {
  test.beforeEach(async ({ authenticated }) => {
    // ログイン済み状態
  });

  test('エントリ一覧が表示される', async ({ page }) => {
    await expect(page.locator('text=エントリ')).toBeVisible();
  });

  test('新規エントリを作成できる', async ({ page }) => {
    await page.click('a:has-text("新規"), button:has-text("新規"), a[href="/entries/new"]');
    await page.waitForURL('**/entries/new**');

    const editor = page.locator('textarea, [contenteditable="true"]');
    await expect(editor).toBeVisible();

    await editor.fill('Playwright E2E テスト用エントリ');
    await page.click('button:has-text("保存"), button:has-text("作成")');

    await page.waitForURL(/\/entries/);
  });

  test('エントリ一覧から詳細に遷移できる', async ({ page }) => {
    const firstEntry = page.locator('[href*="/entries/"]').first();
    if (await firstEntry.isVisible()) {
      await firstEntry.click();
      await page.waitForURL(/\/entries\/.+/);
      await expect(page.locator('textarea, [contenteditable="true"]')).toBeVisible();
    }
  });
});
