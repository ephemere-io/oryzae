/**
 * ResetPasswordForm の検証スペック（auth・パスワード再設定フォーム）。
 *
 * このフォームは props を取らず、マウント時の useEffect で localStorage の access token を
 * 読み、トークンの有無で 2 つの実描画状態に分岐する:
 *  - token 無し → invalid_link（無効リンク表示＋戻るリンク）
 *  - token 有り → フォーム（新パスワード＋確認＋送信）
 *
 * seam は localStorage。runner は `unit.render(fixture.props)` を mount の前・useEffect が
 * 走る tick の前に評価するため、render の中で localStorage を仕込めば useEffect 実行時には
 * 既に値が入っている。よって fixture の `token` ノブで両状態を孤立再現できる（fetch ゼロ）。
 * token は実 props ではなく fixture 制御用。leak 防止のため毎回 set/remove の両方を行う。
 *
 * mismatch probe は password !== confirmPassword の early-return で error_mismatch を出す。
 * これは createApiClient().fetch に到達する前に return するので network ゼロ。逆に一致送信は
 * 実 fetch を撃つ（createApiClient は注入できない）ため fixture には置かない。
 *
 * i18n（auth.reset_password / auth.error）依存のため withVerifyProviders で包む。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { ResetPasswordForm } from './reset-password-form';

const TOKEN_KEY = 'oryzae_access_token';

interface Props {
  /** fixture 制御ノブ: localStorage に仕込む access token（null/undefined で無効リンク状態）。 */
  token?: string | null;
}

registerUnit<Props>({
  id: 'ResetPasswordForm',
  title: 'ResetPasswordForm',
  description: 'パスワード再設定フォーム（access token の有無で無効リンク／入力フォームに分岐）。',
  kind: 'component',
  render: (props) => {
    // mount 前に seam（localStorage）を仕込む。useEffect 実行時には既に反映済み。
    if (props.token) {
      localStorage.setItem(TOKEN_KEY, props.token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    return withVerifyProviders(<ResetPasswordForm />);
  },
  fixtures: [
    // このユニットは localStorage の読み取りを useEffect に置いており（SSR では
    // localStorage を参照できないため）、tokenChecked が立つまで DOM 契約を出さない
    // loading 分岐を通る。ランナーはマウント後に tick（setTimeout 0）を 1 回しか挟まないので、
    // act を持たない fixture は実ブラウザで「No DOM contract emitted」になる。
    // jsdom では effect が同期的に落ち着くため露見せず、実ブラウザで初めて落ちる。
    // 観測前に effect を確定させるため、両 fixture に最小の待機を置く。
    {
      id: 'invalid-link',
      description: 'token 無し → 無効リンク表示（state=invalid・戻るリンクのみ）',
      props: { token: null },
      act: async (ctx) => {
        await ctx.wait(16);
      },
    },
    {
      id: 'form',
      description: 'token 有り → 入力フォーム表示（state=form・エラー無し）',
      props: { token: 'reset-token-abc' },
      act: async (ctx) => {
        await ctx.wait(16);
      },
    },
    {
      id: 'mismatch',
      probe: true,
      description:
        'Probe: パスワードと確認が不一致のまま送信すると error_mismatch を表示（fetch 前に early-return）',
      props: { token: 'reset-token-abc' },
      act: async (ctx) => {
        await ctx.type('input[aria-label="新しいパスワード"]', 'password1');
        await ctx.type('input[aria-label="パスワード確認"]', 'password2');
        await ctx.click('button[type="submit"]');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'inputs-present-iff-form',
      description:
        'パスワード入力 2 つは state=form のときだけ描画され、invalid では戻るリンクが出る',
      check: ({ root, contract }) => {
        const passwordInputs = root.querySelectorAll('input[type="password"]').length;
        const backLink = Boolean(root.querySelector('a[href="/forgot-password"]'));
        if (contract.state === 'form') {
          return (
            (passwordInputs === 2 && !backLink) ||
            `state=form なのに password 入力=${passwordInputs}・戻るリンク=${backLink}`
          );
        }
        return (
          (passwordInputs === 0 && backLink) ||
          `state=invalid なのに password 入力=${passwordInputs}・戻るリンク=${backLink}`
        );
      },
    },
    {
      id: 'error-shown-iff-haserror',
      description: 'エラーメッセージは contract.hasError=true のときだけ描画される',
      check: ({ root, contract }) => {
        const errorShown = Boolean(root.querySelector('p.text-red-600'));
        const expectError = contract.hasError === 'true';
        // invalid 状態の invalid_link も赤文字 p だが、その状態は hasError=false で
        // 評価しないよう state=form の fixture のみがこの分岐に乗る点に注意。
        if (contract.state !== 'form') return true;
        return (
          errorShown === expectError ||
          `state=form で error 表示=${errorShown} だが contract.hasError="${contract.hasError}"`
        );
      },
    },
    {
      id: 'invalid-link-shows-message',
      description: 'invalid 状態では無効リンクメッセージを表示する',
      onlyFixtures: ['invalid-link'],
      check: ({ root, contract }) =>
        (contract.state === 'invalid' &&
          Boolean(root.textContent?.includes('無効なリセットリンク'))) ||
        `expected state=invalid & 無効リンク文言, got state=${contract.state}`,
    },
    {
      id: 'form-starts-without-error',
      description: 'フォーム初期表示はエラー無し（hasError=false）',
      onlyFixtures: ['form'],
      check: ({ contract }) =>
        (contract.state === 'form' && contract.hasError === 'false') ||
        `expected state=form & hasError=false, got state=${contract.state}, hasError=${contract.hasError}`,
    },
    {
      id: 'mismatch-shows-error',
      description: '不一致送信後は hasError=true で error_mismatch を表示',
      onlyFixtures: ['mismatch'],
      check: ({ root, contract }) => {
        const mismatchShown = Boolean(root.textContent?.includes('パスワードが一致しません'));
        return (
          (contract.hasError === 'true' && mismatchShown) ||
          `expected hasError=true & 不一致文言, got hasError=${contract.hasError}, shown=${mismatchShown}`
        );
      },
    },
  ],
});
