import { expect, test } from './fixtures/auth';
import { deleteEntriesByMarker, openSavedEntry, waitForAutosave } from './fixtures/env';

test.describe('エントリ管理', () => {
  test.beforeEach(async ({ authenticated }) => {
    // ログイン済み状態
  });

  test('エントリ一覧が表示される', async ({ page }) => {
    await page.goto('/entries');
    // PC 一覧のヘッダは "All Entries" ＋ "+ New Entry"。安定要素で判定する。
    await expect(page.getByRole('link', { name: /New Entry/i })).toBeVisible();
  });

  test('新規エントリを作成できる', async ({ page }) => {
    await page.goto('/entries/new');
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    const unique = `E2E作成テスト-${Date.now()}`;
    await editor.pressSequentially(unique);

    // PC エディタは自動保存（debounce 後に作成）。固定待ちではなく保存完了を待つ。
    await waitForAutosave(page);
    await page.goto('/entries');
    await expect(page.getByText(unique)).toBeVisible({ timeout: 10000 });

    await deleteEntriesByMarker(page, unique);
  });

  test('エントリ一覧から詳細に遷移できる', async ({ page }) => {
    const firstEntry = page.locator('[href*="/entries/"]').first();
    if (await firstEntry.isVisible()) {
      await firstEntry.click();
      await page.waitForURL(/\/entries\/.+/);
      // 本文を指す。題も textarea になったので `textarea, [contenteditable]` では
      // 2つに当たって落ちる（本文は contentEditable、題は textarea）。
      await expect(page.locator('[contenteditable="true"]')).toBeVisible();
    }
  });

  // regression: #219 — Enter キーで入れた改行が保存・再表示時に失われる
  test('改行を含むエントリを保存して再読込しても改行が反映される', async ({ page }) => {
    await page.goto('/entries/new');
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    // 先頭行はタイトルとして解釈される（一覧で見つける用のマーカー）。本文の改行を検証
    // するため、タイトルの後に3行の本文を入れる。
    const marker = `newline-219-${Date.now()}`;
    await page.keyboard.type(marker);
    await page.keyboard.press('Enter');
    await page.keyboard.type('1行目');
    await page.keyboard.press('Enter');
    await page.keyboard.type('2行目');
    await page.keyboard.press('Enter');
    await page.keyboard.type('3行目');

    // 自動保存（debounce 後に作成）を待ち、一覧から開き直す。
    // 固定待ちは負荷時に取りこぼすため、一覧に現れるまでの条件待ちにする。
    await openSavedEntry(page, marker);
    await page.waitForURL(/\/entries\/[^/]+$/);

    const reopened = page.locator('[contenteditable="true"]').first();
    await expect(reopened).toBeVisible();
    // 本文（先頭行=タイトルを除いた残り）に改行が保たれているか
    const text = await reopened.innerText();
    expect(text).toContain('1行目');
    expect(text).toContain('2行目');
    expect(text).toContain('3行目');
    // 改行が保たれていれば本文は3行以上
    expect(text.split('\n').filter((l) => l.trim().length > 0).length).toBeGreaterThanOrEqual(3);

    await deleteEntriesByMarker(page, marker);
  });
});
