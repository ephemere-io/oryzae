import { expect, test } from '@playwright/test';
import { extractTokenHash, waitForLatestEmail } from './fixtures/mailbox';

/**
 * 新規登録の通し（Issue #490 follow-up）。
 *
 * これまで「サインアップ → 確認メール → リンク → ログイン」は自動テストに載っておらず、
 * **新規ユーザーの入口がまるごと未検証**だった。しかもこの経路は #496 で
 * `use-email-confirm.ts` として全面的に書き直した箇所でもある。
 *
 * 登録できなかった人は何も言わずに去るため、壊れても気づけない（＝静かな障害）。
 * 使い捨て Supabase には受信箱（inbucket）が付いてくるので、ここで実際に通す。
 * 実行ごとにユーザーを1人作るが、CI のインスタンスは毎回破棄されるので枠は溜まらない。
 *
 * 失敗系の読み方に注意:
 * `confirm/page.tsx` は `invalid_link` 以外を全部 `error_failed` に畳むので、
 * 「error_failed が出た」だけでは原因がトークン拒否とは限らない（サーバー障害でも出る）。
 * そこで invalid_link と error_failed を**別テストで撃ち分けて**区別し、成功ケースとも対にする
 * — サーバーが落ちていれば成功ケースが先に落ちるので、失敗ケースだけが
 * 「間違った理由で緑」になることはない。
 */

/** auth.confirm.error_invalid_link の実文言（type が不正なとき）。 */
const INVALID_LINK = 'リンクが無効です。もう一度お試しください。';
/** auth.confirm.error_failed の実文言（検証そのものが失敗したとき）。 */
const VERIFY_FAILED = '確認に失敗しました。リンクの有効期限が切れている可能性があります。';

test.describe('新規登録', () => {
  test('サインアップ → 確認メール → リンクでログインできる', async ({ page }) => {
    // 受信箱は宛先で引くので、アドレスが他の実行と被ると別のメールを掴みうる。
    // 現状 workers=1 / fullyParallel=false なので同一実行内では衝突しないが、
    // 設定が変わったときに静かに壊れないよう乱数も混ぜておく。
    //
    // ニックネームは `^[a-zA-Z0-9_-]+$` かつ 30 文字以内（signup-form.tsx）。
    // 接頭辞 11 文字 + 時刻下 8 桁 + 乱数 4 文字 = 24 文字で収める。
    const stamp = `${String(Date.now()).slice(-8)}${Math.random().toString(36).slice(2, 6)}`;
    const email = `e2e-signup-${stamp}@oryzae.test`;
    const nickname = `e2e_signup_${stamp}`;
    const password = 'E2ePassword-1234';

    // ── 登録 ──
    await page.goto('/signup');
    await page.getByRole('textbox', { name: 'ニックネーム（ログインID）' }).fill(nickname);
    await page.locator('input[type="email"]').fill(email);
    const passwords = page.locator('input[type="password"]');
    await passwords.nth(0).fill(password);
    await passwords.nth(1).fill(password);
    await page.getByRole('button', { name: 'サインアップ', exact: true }).click();

    // 登録成功時、フォームは URL を変えずに「確認メールを送信しました」へ差し替わる
    // （signup-form.tsx の emailSent 分岐）。URL を見ても何も分からないので、
    // その描画と宛先アドレスの表示を待つ。ここが緩いと、409 や 500 で失敗しても
    // 気づけないまま次に進んでしまう。
    await expect(page.getByText('確認メールを送信しました')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(email)).toBeVisible();

    // ── 確認メールを受け取り、token を取り出す ──
    const mail = await waitForLatestEmail(email);
    const tokenHash = extractTokenHash(mail);

    // ── アプリの確認ページを踏む（use-email-confirm.ts の経路） ──
    await page.goto(`/auth/confirm?token_hash=${tokenHash}&type=signup`);

    // 確定するとセッションが保存され、書く画面へ送られる。
    await page.waitForURL('**/entries/new**', { timeout: 30_000 });
    await expect(page).toHaveURL(/\/entries\/new/);

    // 保護ルートに留まれる＝セッションが本当に確立している。
    await page.goto('/entries');
    await expect(page).toHaveURL(/\/entries/);
  });

  test('type が不正なリンクは invalid_link として弾く', async ({ page }) => {
    await page.goto('/auth/confirm?token_hash=whatever&type=not-a-real-type');

    // 通信する前に弾く分岐。専用文言なので error_failed と区別できる。
    await expect(page.getByText(INVALID_LINK)).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/auth\/confirm/);
  });

  test('壊れたトークンではログインさせない', async ({ page }) => {
    await page.goto('/auth/confirm?token_hash=this-token-is-not-valid&type=signup');

    // type は正しいので invalid_link ではなく検証失敗側に落ちる。
    // （同じ <p> にどちらか一方しか出ないので、この文言が出た時点で分岐は確定する。
    //   2分岐の区別は上の invalid_link テストと対で担保している。）
    await expect(page.getByText(VERIFY_FAILED)).toBeVisible({ timeout: 30_000 });
    // 失敗したら確認ページに留まる（保護ルートへ進まない）。
    await expect(page).toHaveURL(/\/auth\/confirm/);
  });
});
