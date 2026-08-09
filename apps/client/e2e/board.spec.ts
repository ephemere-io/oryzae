import { expect, test } from './fixtures/auth';
import { waitForAutosave } from './fixtures/env';

test.describe('ボード画面', () => {
  test.beforeEach(async ({ authenticated: _, page }) => {
    await page.goto('/board');
    await page.waitForSelector('[role="application"]');
  });

  test('ボード画面が表示される', async ({ page }) => {
    await expect(page.locator('text=Daily')).toBeVisible();
    await expect(page.locator('button:has-text("Snippet")')).toBeVisible();
  });

  test('日付ナビゲーションで前日/翌日に切り替えできる', async ({ page }) => {
    // 日付ラベルは tracking-wider が一意（他コントロールは tracking-[0.15em] 等）。
    const dateText = page.locator('[class*="tracking-wider"]').first();
    const initialDate = await dateText.textContent();

    await page.click('button:has-text("‹")');
    await page.waitForTimeout(500);
    const prevDate = await dateText.textContent();
    expect(prevDate).not.toBe(initialDate);

    await page.click('button:has-text("›")');
    await page.waitForTimeout(500);
    const nextDate = await dateText.textContent();
    expect(nextDate).toBe(initialDate);
  });

  test('スニペットを作成できる', async ({ page }) => {
    const snippet = `E2Eスニペット-${Date.now()}`;
    await page.click('button:has-text("Snippet")');
    // ダイアログ見出しは「スニペットを作成」、入力は textarea(placeholder="テキストを入力...")、確定は「作成」。
    await expect(page.getByText('スニペットを作成')).toBeVisible();
    await page.fill('textarea[placeholder*="テキスト"]', snippet);
    await page.getByRole('button', { name: '作成', exact: true }).click();

    await page.waitForTimeout(1000);
    await expect(page.getByText(snippet)).toBeVisible();
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
  });
});
