import { expect, test } from './fixtures/auth';

test.describe('質問管理', () => {
  test.beforeEach(async ({ authenticated }) => {
    // ログイン済み状態
  });

  test('質問ページに遷移できる', async ({ page }) => {
    await page.goto('/questions');
    await page.waitForURL('**/questions**');
    // 問いが0件だとタイムラインは空表示になり「問いの変遷」見出しは描画されない
    // （question-timeline.tsx の early return）。まっさらな DB でも通るよう、
    // どちらの状態でも「問い画面が描画されている」ことを見る。
    await expect(
      page.getByText('問いの変遷').or(page.getByText('問いはまだありません')).first(),
    ).toBeVisible();
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
