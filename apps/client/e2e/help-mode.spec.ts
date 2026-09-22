import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/auth';

/**
 * ヘルプモード（`docs/help-mode-guide.md`）が実ブラウザで開閉し、検索が手元の照合で
 * 動くことを確かめる。Jev（外部）は CI に鍵が無いので、手元の照合の結果だけを見る。
 */

/**
 * /board を開き、面が閉じた状態に揃える。
 *
 * 初めての人（`onboardingCompleted` が false）には、`/api/v1/users/me` の返事が届いてから
 * 自動で面が開く。その前に `aside.isVisible()` で見ると「閉じている」と読めてしまい、
 * 直後の `?` が自動オープンと裏返る（開いたつもりが閉じる、`openHelp` が検索の文を消す）。
 * 返事を待ち、初めての人なら「ようこそ」の灯り（spotlight）が点く＝返事が状態に反映された
 * のを見てから閉じる。以後は自動で開かない。
 */
async function gotoBoardWithHelpClosed(page: Page): Promise<void> {
  const me = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/v1/users/me' && res.request().method() === 'GET',
  );
  await page.goto('/board');
  const profile: unknown = await (await me).json();
  const firstVisit =
    typeof profile === 'object' &&
    profile !== null &&
    'onboardingCompleted' in profile &&
    profile.onboardingCompleted === false;

  const aside = page.locator('aside.help-aside');
  if (firstVisit) {
    const panel = page.locator('[data-verify-unit="HelpPanel"]');
    await expect(panel).toHaveAttribute('data-verify-spotlight', 'true');
    await expect(aside).toBeVisible();
    await page.keyboard.press('Escape');
  }
  await expect(aside).toBeHidden();
}

test.describe('ヘルプモード', () => {
  test.beforeEach(async ({ authenticated }) => {
    void authenticated;
  });

  test('`?` で右の面が開き、Esc で閉じる', async ({ page }) => {
    await gotoBoardWithHelpClosed(page);
    const panel = page.locator('[data-verify-unit="HelpPanel"]');
    // 面（aside）は DOM に居続け、閉じると幅 0 に畳まれる（出入りの遷移のため）。
    // 開閉は aside の見え方で見る（中身は面の幅で固定なので、畳んでも大きさを持つ）。
    const aside = page.locator('aside.help-aside');

    await page.keyboard.press('?');
    await expect(aside).toBeVisible();
    await expect(panel).toHaveAttribute('data-verify-mode', 'browse');
    await expect(panel).toHaveAttribute('data-verify-spot', 'board');

    await page.keyboard.press('Escape');
    await expect(aside).toBeHidden();
  });

  test('したいことを書くと近い話題が出て、「開く」でそこへ行く', async ({ page }) => {
    await gotoBoardWithHelpClosed(page);
    const panel = page.locator('[data-verify-unit="HelpPanel"]');
    const aside = page.locator('aside.help-aside');
    await page.keyboard.press('?');
    await expect(aside).toBeVisible();

    await page.getByPlaceholder('使い方を検索').fill('去年書いたものを読み返したい');
    await expect(panel).toHaveAttribute('data-verify-mode', 'search');
    const first = panel.locator('[data-verify-unit="HelpTopicCard"]').first();
    await expect(first).toHaveAttribute('data-verify-topic', 'archive');

    await first.getByRole('button', { name: /^開く/ }).click();
    await expect(page).toHaveURL(/\/entries$/);
  });

  test('画面を移っても開いたまま', async ({ page }) => {
    await gotoBoardWithHelpClosed(page);
    const panel = page.locator('[data-verify-unit="HelpPanel"]');
    const aside = page.locator('aside.help-aside');
    await page.keyboard.press('?');
    await expect(aside).toBeVisible();

    await page.goto('/jar');
    await expect(aside).toBeVisible();
    await expect(panel).toHaveAttribute('data-verify-spot', 'jar');
  });
});
