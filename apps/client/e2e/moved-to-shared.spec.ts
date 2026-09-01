import { expect, test } from '@playwright/test';

/**
 * flat features（`features/auth` / `features/onboarding`）を `features/shared` へ
 * 畳んだ移動（#490 の後始末）が、実ブラウザで壊れていないことを確認する。
 *
 * なぜ E2E が要るか: 移動は 17 ファイル中 15 が R100（バイト同一）で、変わったのは
 * import パスだけ。型チェックとユニットテストは通る。しかし **jsdom は CSS を評価しない**ため、
 * `onboarding.css`（コンポーネントと一緒に移動した相対 import）が実際に読み込まれて
 * 適用されているかは、これまでどのテストも見ていなかった。ここが唯一の穴だった。
 *
 * 検証面には `/verify`（dev/preview 限定の孤立マウントルート）を使う。1ユニット×fixture を
 * 実物 DOM にマウントして invariant を回し、結果を `window.__verify.current()` に出す。
 * ページ全体を組み立てずに、移動したコンポーネントだけを名指しで確認できる。
 */

/** `features/shared` へ移動した、検証スペックを持つユニット。 */
const MOVED_UNITS = [
  { unit: 'LoginForm', fixture: 'empty' },
  { unit: 'SignupForm', fixture: 'empty' },
  { unit: 'ForgotPasswordForm', fixture: 'empty' },
  { unit: 'ResetPasswordForm', fixture: 'invalid-link' },
  { unit: 'ResetPasswordForm', fixture: 'form' },
  { unit: 'OnboardingFlow', fixture: 'step-concept' },
  { unit: 'StepQuestion', fixture: 'empty' },
  { unit: 'ConceptIllo', fixture: 'default' },
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

  /**
   * `onboarding.css` が読み込まれ、適用されていることの決定的な確認。
   *
   * `.ob-stage { position: fixed }` はこの CSS にしか無い。読み込みに失敗していれば
   * ブラウザ既定の `static` になるので、移動で import が壊れた場合ここで落ちる。
   * ユニットテスト（jsdom）はスタイルを評価しないので、この1点は実ブラウザでしか守れない。
   */
  test('onboarding.css が実ブラウザで適用されている', async ({ page }) => {
    await page.goto('/verify/OnboardingFlow/step-concept');

    const stage = page.locator('.ob-stage').first();
    await expect(stage).toBeAttached();

    await expect(stage).toHaveCSS('position', 'fixed');
  });
});
