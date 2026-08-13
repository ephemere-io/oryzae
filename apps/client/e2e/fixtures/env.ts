import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * E2E を「どの環境に向けても同じ結果が出る」ようにするための共通ヘルパー。
 *
 * これまで cookie の domain が `'localhost'` 決め打ちだったため、`E2E_BASE_URL` を
 * デプロイ済み環境に向けると locale 系のテストが軒並み落ちていた（cookie が別ドメインに
 * 付くため切替が反映されない）。baseURL から domain を導出して解消する。
 */

/** `E2E_BASE_URL`（未指定なら localhost:3000）から cookie 用の domain を導出する。 */
export function cookieDomain(): string {
  const base = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
  return new URL(base).hostname;
}

/** locale cookie を現在の baseURL のドメインに対して設定する。 */
export async function setLocaleCookie(context: BrowserContext, locale: string): Promise<void> {
  await context.addCookies([
    { name: 'NEXT_LOCALE', value: locale, domain: cookieDomain(), path: '/' },
  ]);
}

/**
 * PC エディタの自動保存が完了するまで待つ。
 *
 * `useAutosaveEntry` は 2s の debounce 後に保存するため、**保存前にページを離れると
 * 保留中のタイマーごと破棄されてエントリが作られない**。固定 `waitForTimeout` では
 * 遅い環境で取りこぼすので、ステータスバーが公表している状態（`data-verify-status`）が
 * `saved` になるのを待つ。
 */
export async function waitForAutosave(page: Page): Promise<void> {
  await expect(page.locator('[data-verify-unit="EditorStatusBar"]')).toHaveAttribute(
    'data-verify-status',
    'saved',
    { timeout: 30_000 },
  );
}

/** 自動保存の完了を待ってから一覧へ移動し、対象エントリを開く。 */
export async function openSavedEntry(page: Page, marker: string): Promise<void> {
  await waitForAutosave(page);
  await page.goto('/entries');
  const link = page.locator('[href*="/entries/"]', { hasText: marker }).first();
  await expect(link).toBeVisible({ timeout: 30_000 });
  await link.click();
}

/**
 * Research Preview の登録枠が満了していると、signup はフォームではなく案内文を出す
 * （`signup-form.tsx` の capacityReached 分岐）。枠の状態は環境依存なので、
 * 「どちらかが描画されていること」を検証する。
 */
export async function expectSignupPageRendered(page: Page, locale: 'ja' | 'en'): Promise<void> {
  const form = locale === 'ja' ? 'アカウントを作成' : 'Create your account';
  const full = locale === 'ja' ? '現在の登録枠は満了しました' : 'Sign-ups are currently full';
  await expect(page.getByText(form).or(page.getByText(full)).first()).toBeVisible();
}
