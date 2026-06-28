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

  // PC サイドバーは Jar/Board/List/Editor/Account（問いは瓶の中で管理）。
  // 旧「サイドバー→質問」は存在しないため、実在する Board リンクで遷移を検証する。
  test('サイドバーからボードに遷移', async ({ page }) => {
    await page.click('a[href="/board"]');
    await expect(page).toHaveURL(/\/board/);
  });

  test('サイドバーからエディタに遷移', async ({ page }) => {
    await page.click('a[href="/entries/new"]');
    await expect(page).toHaveURL(/\/entries\/new/);
  });
});
