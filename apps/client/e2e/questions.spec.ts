import { expect, test } from './fixtures/auth';

test.describe('質問管理', () => {
  test.beforeEach(async ({ authenticated }) => {
    // ログイン済み状態
  });

  test('質問ページに遷移できる', async ({ page }) => {
    await page.goto('/questions');
    await page.waitForURL('**/questions**');
    await expect(page.locator('text=質問')).toBeVisible();
  });

  test('新しい質問を作成できる', async ({ page }) => {
    await page.goto('/questions');

    const input = page.locator('input[placeholder*="質問"]');
    if (await input.isVisible()) {
      const testQuestion = `E2E テスト質問 ${Date.now()}`;
      await input.fill(testQuestion);
      await page.click('button:has-text("追加")');

      await expect(page.locator(`text=${testQuestion}`)).toBeVisible({ timeout: 5000 });
    }
  });
});
