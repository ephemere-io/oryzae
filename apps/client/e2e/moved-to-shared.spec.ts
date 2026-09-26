import { expect, test } from '@playwright/test';

/**
 * flat features（`features/auth`）を `features/shared` へ畳んだ移動（#490 の後始末）が、
 * 実ブラウザで壊れていないことを確認する。
 *
 * 検証面には `/verify`（dev/preview 限定の孤立マウントルート）を使う。1ユニット×fixture を
 * 実物 DOM にマウントして invariant を回し、結果を `window.__verify.current()` に出す。
 * ページ全体を組み立てずに、移動したコンポーネントだけを名指しで確認できる。
 *
 * 同じ移動で運ばれた `features/onboarding` は、ヘルプモード（`features/shared/help`）に
 * 置き換えて撤去した。ヘルプの面の孤立検証は `help-mode.spec.ts`。
 */

/** `features/shared` へ移動した、検証スペックを持つユニット。 */
const MOVED_UNITS = [
  { unit: 'LoginForm', fixture: 'empty' },
  { unit: 'SignupForm', fixture: 'empty' },
  { unit: 'ForgotPasswordForm', fixture: 'empty' },
  { unit: 'ResetPasswordForm', fixture: 'invalid-link' },
  { unit: 'ResetPasswordForm', fixture: 'form' },
];

test.describe('shared へ移動したコンポーネント', () => {
  for (const { unit, fixture } of MOVED_UNITS) {
    test(`${unit}/${fixture} が孤立マウントで PASS する`, async ({ page }) => {
      await page.goto(`/verify/${unit}/${fixture}`);

      // ハーネスは非同期に act を回してから結果を書き出す。結果が出るまで待つ。
      await expect(page.locator('#verify-result-json')).not.toBeEmpty();

      const result = await page.evaluate(() => window.__verify?.current() ?? null);

      expect(result, `${unit}/${fixture} の検証結果が取得できない`).not.toBeNull();
      expect(result?.unitId).toBe(unit);

      // BLOCKED（観測できなかった）も見逃さない。移動でマウントが壊れると
      // FAIL ではなく BLOCKED になるため、PASS 以外はすべて落とす。
      const failed = result?.checks.filter((c) => c.status === 'fail') ?? [];
      expect(
        result?.verdict,
        `verdict=${result?.verdict}${result?.blockedReason ? ` (${result.blockedReason})` : ''}` +
          (failed.length ? ` / 失敗: ${failed.map((c) => c.label).join(', ')}` : ''),
      ).toBe('PASS');
    });
  }
});
