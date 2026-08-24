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
    // 日付ラベルは tracking-wider が一意（セグメント切り替えは tracking-[0.15em]）。
    const dateText = page.locator('[class*="tracking-wider"]').first();
    const initialDate = await dateText.textContent();

    await page.click('button[data-verify-nav="prev"]');
    await page.waitForTimeout(500);
    const prevDate = await dateText.textContent();
    expect(prevDate).not.toBe(initialDate);

    await page.click('button[data-verify-nav="next"]');
    await page.waitForTimeout(500);
    const nextDate = await dateText.textContent();
    expect(nextDate).toBe(initialDate);
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
    // 画像タブではテキスト入力が消え、読み取りボタン（未選択なので無効）が出る。
    await expect(page.locator('textarea')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '文字を読み取る' })).toBeDisabled();

    await page.click('button[data-verify-source-tab="text"]');
    await expect(page.locator('textarea')).toBeVisible();
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
