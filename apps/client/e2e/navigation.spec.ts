import { expect, test } from './fixtures/auth';

test.describe('ナビゲーション', () => {
  test.beforeEach(async ({ authenticated }) => {
    void authenticated;
  });

  // 既定は書斎ホーム（サイドバーは無い）。サブ画面からは上端の「書斎に戻る」で戻る。
  test('サブ画面の「書斎に戻る」で書斎へ戻る', async ({ page }) => {
    await page.goto('/board');
    await page.getByRole('link', { name: '書斎に戻る' }).click();
    // 書斎はルート（/）。
    await page.waitForURL((url) => url.pathname === '/');
  });

  // 撤退口（`?study=off`）では従来のサイドバーで動く。書斎を止めたときに
  // 行き先を失わないことを確かめる。切替は端末に憶えられるので、最初に 1 度付ければよい。
  test.describe('書斎を止めたとき（?study=off）', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/questions?study=off');
    });

    test('サイドバーからエントリ一覧に遷移', async ({ page }) => {
      await page.click('a[href="/entries"]');
      await expect(page).toHaveURL(/\/entries/);
    });

    test('サイドバーからボードに遷移', async ({ page }) => {
      await page.click('a[href="/board"]');
      await expect(page).toHaveURL(/\/board/);
    });

    test('サイドバーからエディタに遷移', async ({ page }) => {
      await page.click('a[href="/entries/new"]');
      await expect(page).toHaveURL(/\/entries\/new/);
    });
  });
});
