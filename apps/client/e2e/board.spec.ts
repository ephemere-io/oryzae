import { expect, test } from './fixtures/auth';
import { deleteEntriesByMarker, waitForAutosave } from './fixtures/env';

test.describe('ボード画面', () => {
  test.beforeEach(async ({ authenticated: _, page }) => {
    await page.goto('/board');
    await page.waitForSelector('[role="application"]');
  });

  test('ボード画面が表示される（日付ナビ＋下部ツールバー）', async ({ page }) => {
    await expect(page.locator('button[data-verify-view-option="daily"]')).toBeVisible();
    await expect(page.locator('[role="toolbar"]')).toBeVisible();
    await expect(page.locator('button[data-verify-tool="snippet"]')).toBeVisible();
    await expect(page.locator('button[data-verify-tool="photo"]')).toBeVisible();
  });

  test('不要になった要素（フッター・カード数）が出ない', async ({ page }) => {
    await expect(page.locator('footer')).toHaveCount(0);
    await expect(page.getByText(/\d+ CARDS/)).toHaveCount(0);
  });

  test('日付ナビゲーションで前日/翌日に切り替えできる', async ({ page }) => {
    // 日付は BoardDateNav が公表する契約（data-verify-date-key）で見る。
    // 以前はクラス名（tracking-wider）で拾っていたが、見た目を変えるたびに
    // 壊れるうえ、何を見ているのかも読み取れなかった。
    const nav = page.locator('[data-verify-unit="BoardDateNav"]');
    const dateKey = () => nav.getAttribute('data-verify-date-key');
    const initial = await dateKey();

    await page.click('button[data-verify-nav="prev"]');
    await page.waitForTimeout(500);
    expect(await dateKey()).not.toBe(initial);

    await page.click('button[data-verify-nav="next"]');
    await page.waitForTimeout(500);
    expect(await dateKey()).toBe(initial);
  });

  test('ツールバーからスニペットを作成できる', async ({ page }) => {
    const snippet = `E2Eスニペット-${Date.now()}`;
    await page.click('button[data-verify-tool="snippet"]');
    // 入力は textarea(placeholder="テキストを入力...")、確定は「作成」。
    // 見出しは role で取る（同じ文言をツールバーのツールチップも持つため getByText は曖昧）。
    await expect(page.getByRole('heading', { name: 'スニペットを作成' })).toBeVisible();
    await page.fill('textarea[placeholder*="テキスト"]', snippet);
    await page.getByRole('button', { name: '作成', exact: true }).click();

    await page.waitForTimeout(1000);
    await expect(page.getByText(snippet)).toBeVisible();
  });

  test('スニペット作成ダイアログで「画像から読み取る」に切り替えられる', async ({ page }) => {
    await page.click('button[data-verify-tool="snippet"]');
    await expect(page.getByRole('heading', { name: 'スニペットを作成' })).toBeVisible();

    await page.click('button[data-verify-source-tab="image"]');
    // 画像タブではテキスト入力が消え、ドロップゾーン（画像用 file input）が出る。
    // 画像を選んだ時点で読み取りまで自動で進むので、未選択のうちはボタンを出さない。
    await expect(page.locator('textarea')).toHaveCount(0);
    await expect(page.locator('input[type="file"][accept*="image/"]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /読み取/ })).toHaveCount(0);

    await page.click('button[data-verify-source-tab="text"]');
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('押せる要素にポインタカーソルが出る', async ({ page }) => {
    // Tailwind v4 の Preflight が button を cursor:default にする。押せる物が
    // 押せるように見えないと操作が伝わらないので、globals.css で戻している。
    for (const sel of [
      'button[data-verify-tool="snippet"]',
      'button[data-verify-view-option="daily"]',
      'button[data-verify-nav="next"]',
    ]) {
      const cursor = await page.locator(sel).evaluate((el) => getComputedStyle(el).cursor);
      expect(cursor, sel).toBe('pointer');
    }
  });

  test('入力中でも Escape でダイアログを閉じられ、入力は持ち越さない', async ({ page }) => {
    // textarea にフォーカスがある状態の Escape は、form の stopPropagation に阻まれて
    // 長らく効いていなかった（capture で拾うようにして解消）。ここで固定する。
    await page.click('button[data-verify-tool="snippet"]');
    const textarea = page.locator('textarea');
    await textarea.fill('破棄されるはずの下書き');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'スニペットを作成' })).toHaveCount(0);

    // 開き直したときに前回の入力が残らない
    await page.click('button[data-verify-tool="snippet"]');
    await expect(textarea).toHaveValue('');
    await page.keyboard.press('Escape');

    // 写真ダイアログも同じく Escape で閉じる
    await page.click('button[data-verify-tool="photo"]');
    await expect(page.getByRole('heading', { name: '写真を追加' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: '写真を追加' })).toHaveCount(0);
  });

  test('ツールバーのショートカット（S / I）が効き、入力中は誤発火しない', async ({ page }) => {
    await page.keyboard.press('s');
    await expect(page.getByRole('heading', { name: 'スニペットを作成' })).toBeVisible();

    // 本文に s / i を打っても写真ダイアログは開かない（そのまま文字として入る）
    await page.locator('textarea').pressSequentially('sisi');
    await expect(page.locator('textarea')).toHaveValue('sisi');
    await expect(page.getByRole('heading', { name: '写真を追加' })).toHaveCount(0);

    await page.keyboard.press('Escape');
    await page.keyboard.press('i');
    await expect(page.getByRole('heading', { name: '写真を追加' })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('エントリカードが表示される（当日エントリがある場合）', async ({ page }) => {
    // まずエントリを作成（PC エディタは自動保存）
    const unique = `ボードE2E-${Date.now()}`;
    await page.goto('/entries/new');
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.pressSequentially(unique);
    // 自動保存の完了を固定待ちせず、ステータスバーの saved を待ってからボードへ。
    await waitForAutosave(page);

    // ボード（当日）にカードとして出る（カード見出し＋本文で2要素マッチするため first）
    await page.goto('/board');
    await page.waitForSelector('[role="application"]');
    await expect(page.getByText(unique).first()).toBeVisible({ timeout: 10000 });

    await deleteEntriesByMarker(page, unique);
  });
});
