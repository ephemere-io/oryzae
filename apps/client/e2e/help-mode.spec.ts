import { expect, test } from './fixtures/auth';

/**
 * ヘルプモード（`docs/help-mode-guide.md`）が実ブラウザで開閉し、検索が手元の照合で
 * 動くことを確かめる。Jev（外部）は CI に鍵が無いので、手元の照合の結果だけを見る。
 */
test.describe('ヘルプモード', () => {
  test.beforeEach(async ({ authenticated }) => {
    void authenticated;
  });

  test('`?` で右の面が開き、Esc で閉じる', async ({ page }) => {
    await page.goto('/board');
    const panel = page.locator('[data-verify-unit="HelpPanel"]');
    // 初めての人には自動で開いている。閉じてから始める。
    if (await panel.isVisible()) await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);

    await page.keyboard.press('?');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-verify-mode', 'browse');
    await expect(panel).toHaveAttribute('data-verify-spot', 'board');

    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
  });

  test('したいことを書くと近い話題が出て、「開く」でそこへ行く', async ({ page }) => {
    await page.goto('/board');
    const panel = page.locator('[data-verify-unit="HelpPanel"]');
    if (!(await panel.isVisible())) await page.keyboard.press('?');
    await expect(panel).toBeVisible();

    await page.getByPlaceholder('したいことを書く').fill('去年書いたものを読み返したい');
    await expect(panel).toHaveAttribute('data-verify-mode', 'search');
    const first = panel.locator('[data-verify-unit="HelpTopicCard"]').first();
    await expect(first).toHaveAttribute('data-verify-topic', 'archive');

    await first.getByRole('button', { name: /^開く/ }).click();
    await expect(page).toHaveURL(/\/entries$/);
  });

  test('画面を移っても開いたまま', async ({ page }) => {
    await page.goto('/board');
    const panel = page.locator('[data-verify-unit="HelpPanel"]');
    if (!(await panel.isVisible())) await page.keyboard.press('?');
    await expect(panel).toBeVisible();

    await page.goto('/jar');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-verify-spot', 'jar');
  });
});
