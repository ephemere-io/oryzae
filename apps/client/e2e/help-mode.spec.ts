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
    // 面（aside）は DOM に居続け、閉じると幅 0 に畳まれる（出入りの遷移のため）。
    // 開閉は aside の見え方で見る（中身は面の幅で固定なので、畳んでも大きさを持つ）。
    const aside = page.locator('aside.help-aside');
    // 初めての人には自動で開いている。閉じてから始める。
    if (await aside.isVisible()) await page.keyboard.press('Escape');
    await expect(aside).toBeHidden();

    await page.keyboard.press('?');
    await expect(aside).toBeVisible();
    await expect(panel).toHaveAttribute('data-verify-mode', 'browse');
    await expect(panel).toHaveAttribute('data-verify-spot', 'board');

    await page.keyboard.press('Escape');
    await expect(aside).toBeHidden();
  });

  test('したいことを書くと近い話題が出て、「開く」でそこへ行く', async ({ page }) => {
    await page.goto('/board');
    const panel = page.locator('[data-verify-unit="HelpPanel"]');
    const aside = page.locator('aside.help-aside');
    if (!(await aside.isVisible())) await page.keyboard.press('?');
    await expect(aside).toBeVisible();

    await page.getByPlaceholder('使い方を検索').fill('去年書いたものを読み返したい');
    await expect(panel).toHaveAttribute('data-verify-mode', 'search');
    const first = panel.locator('[data-verify-unit="HelpTopicCard"]').first();
    await expect(first).toHaveAttribute('data-verify-topic', 'archive');

    await first.getByRole('button', { name: /^開く/ }).click();
    await expect(page).toHaveURL(/\/entries$/);
  });

  test('画面を移っても開いたまま', async ({ page }) => {
    await page.goto('/board');
    const panel = page.locator('[data-verify-unit="HelpPanel"]');
    const aside = page.locator('aside.help-aside');
    if (!(await aside.isVisible())) await page.keyboard.press('?');
    await expect(aside).toBeVisible();

    await page.goto('/jar');
    await expect(aside).toBeVisible();
    await expect(panel).toHaveAttribute('data-verify-spot', 'jar');
  });
});
