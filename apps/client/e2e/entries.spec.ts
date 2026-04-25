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

  // regression: #219 — Enter キーで入れた改行が保存・再表示時に失われる
  test('改行を含むエントリを保存して再読込しても改行が反映される', async ({ page }) => {
    await page.goto('/entries/new');
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await page.keyboard.type('1行目');
    await page.keyboard.press('Enter');
    await page.keyboard.type('2行目');
    await page.keyboard.press('Enter');
    await page.keyboard.type('3行目');

    await page.click('button[data-tooltip="保存する"]');
    await page.fill('input[placeholder="タイトルを入力..."]', 'newline-regression-219');
    await page.click('button:has-text("保存"):not([data-tooltip])');

    await page.waitForURL(/\/entries\/[^/]+$/);
    await page.reload();

    const reopened = page.locator('[contenteditable="true"]').first();
    await expect(reopened).toBeVisible();
    const text = await reopened.innerText();
    expect(text).toContain('1行目');
    expect(text).toContain('2行目');
    expect(text).toContain('3行目');
    // 改行が保たれていれば、行数は 3 行以上になる
    expect(text.split('\n').filter((l) => l.trim().length > 0).length).toBeGreaterThanOrEqual(3);
  });
});
