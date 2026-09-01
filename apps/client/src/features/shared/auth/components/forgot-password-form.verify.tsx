/**
 * ForgotPasswordForm の検証スペック（A 移植・auth）。
 * パスワード再設定メールを送るフォーム。props を取らず内部 state のみで描画する。
 *
 * 送信ハンドラは `createApiClient().fetch('/api/v1/auth/reset-password', ...)` を直接呼ぶが、
 * 注入できる api seam が無い。jsdom マトリクスで submit すると Node の実 fetch が外向き通信を
 * 走らせる（flaky/hang）。よって submit は意図的に対象外とし（act でボタンを押さない）、
 * sent / error / loading は到達しない。これら定数になる状態は契約に載せない
 * （sp-entry-editor が saving/pickled を除外したのと同型）。
 *
 * 純レンダリングで実際に変化するのは「メール欄に文字があるか」だけなので、契約は hasEmail のみ。
 * useTranslations（auth.forgot_password）と next/link 依存のため withVerifyProviders で包む。
 * a11y はメール input が <label> 内包・送信ボタンがテキストを持つため既にラベル付き（追加不要）。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { ForgotPasswordForm } from './forgot-password-form';

type Props = Record<string, never>;

registerUnit<Props>({
  id: 'ForgotPasswordForm',
  title: 'ForgotPasswordForm',
  description: 'パスワード再設定メール送信フォーム（メール入力＋送信・ログインへ戻る導線）。',
  kind: 'component',
  render: () => withVerifyProviders(<ForgotPasswordForm />),
  fixtures: [
    {
      id: 'empty',
      description: '初期状態（メール欄が空・hasEmail=false）',
      props: {},
    },
    {
      id: 'typed',
      description: 'メールを入力すると hasEmail=true になる',
      props: {},
      act: async (ctx) => {
        await ctx.type('input[type="email"]', 'user@example.com');
        await ctx.wait(16);
      },
    },
    {
      id: 'type-then-clear',
      probe: true,
      description: 'Probe: 入力後に全消去すると hasEmail=false に戻る（入力対称性）',
      props: {},
      act: async (ctx) => {
        await ctx.type('input[type="email"]', 'user@example.com');
        await ctx.wait(16);
        await ctx.type('input[type="email"]', '');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'hasemail-reflects-input',
      description: 'contract.hasEmail がメール input の非空を反映する',
      check: ({ root, contract }) => {
        const input = root.querySelector<HTMLInputElement>('input[type="email"]');
        const actuallyHasEmail = (input?.value ?? '').length > 0;
        return (
          contract.hasEmail === String(actuallyHasEmail) ||
          `contract.hasEmail="${contract.hasEmail}" だが input.value="${input?.value}"（hasEmail=${actuallyHasEmail}）`
        );
      },
    },
    {
      id: 'structure-input-and-submit',
      description: 'メール input と名前付き送信ボタンが常に存在する',
      check: ({ root }) => {
        const hasInput = Boolean(root.querySelector('input[type="email"]'));
        const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]');
        const named = (submit?.textContent ?? '').trim().length > 0;
        return (
          (hasInput && Boolean(submit) && named) ||
          `email input present=${hasInput}, submit present=${Boolean(submit)}, named=${named}`
        );
      },
    },
    {
      id: 'default-empty',
      description: '初期状態は hasEmail=false',
      onlyFixtures: ['empty'],
      check: ({ contract }) =>
        contract.hasEmail === 'false' || `expected hasEmail=false, got "${contract.hasEmail}"`,
    },
    {
      id: 'typed-has-email',
      description: 'メール入力後は hasEmail=true',
      onlyFixtures: ['typed'],
      check: ({ contract }) =>
        contract.hasEmail === 'true' ||
        `expected hasEmail=true after typing, got "${contract.hasEmail}"`,
    },
  ],
});
