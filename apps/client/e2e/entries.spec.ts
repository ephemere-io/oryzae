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

  // 1x1 の PNG。canvas でのリサイズを実ブラウザで通すために実データが要る。
  const TINY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  /**
   * 写真を選ぶと取り込みモーダルが開き、2つの取り込み方を選べる。
   *
   * ここでは「文字として読み込む」は押さない — 1回ごとに LLM の実費が発生し、
   * 結果も非決定的なため。ボタンが押せる状態であることまでを検証範囲とする。
   */
  test('写真を選ぶと取り込みモーダルが開き、取り込み方を選べる', async ({ page }) => {
    await page.goto('/entries/new');
    // 写真の入口はアクションパレットの「写真」（#525 でヘッダーのボタンからパレットへ移った）。
    // 以前は `photo-import-trigger` の目印を探していて、目印ごと無くなってからずっと落ちていた。
    await expect(page.getByRole('button', { name: '写真', exact: true })).toBeVisible();

    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: 'note.png', mimeType: 'image/png', buffer: TINY_PNG });

    const dialog = page.getByRole('dialog', { name: '写真を取り込む' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: '文字として読み込む' })).toBeEnabled();
    await expect(dialog.getByRole('button', { name: '写真として貼る' })).toBeEnabled();

    // キャンセルで閉じる（本文にもエントリにも副作用を残さない）。
    await dialog.getByRole('button', { name: 'キャンセル' }).click();
    await expect(dialog).toBeHidden();
  });
});
