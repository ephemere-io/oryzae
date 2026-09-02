/**
 * SignupForm の検証スペック（A 移植・auth）。
 * ニックネーム／メール／パスワード／確認の4入力＋サインアップ送信フォーム。props を取らず
 * 内部 state と useAuth / useSignupAvailability に依存する。
 *
 * 注入できる api seam は無い。useSignupAvailability はマウント時に
 * `fetch('/api/v1/auth/signup/availability')` を撃つが、jsdom（Node）では相対 URL が即 reject し
 * hook 内 try/catch が握る → availability=null のまま。useAuth は localStorage にトークンが
 * 無ければ fetch せず early-return する（fresh jsdom は空）。よって描画は availability=null・
 * 未認証で安定し、フォーム本体を孤立検証できる。
 *
 * 送信本体（signup → router.push）は注入できる api seam が無く、submit すると Node の実 fetch が
 * 走る（flaky/hang）ため対象外（forgot-password-form と同型）。よって loading / emailSent /
 * capacityReached は到達せず定数になるため契約に載せない（sp-entry-editor が saving/pickled を
 * 除外したのと同型）。純レンダリングで実際に変化するのは各入力の非空と「パスワード不一致エラー」
 * だけなので、契約は hasNickname / hasEmail / hasPassword / hasConfirm / hasError に絞る。
 *
 * パスワード不一致の probe は fetch を撃たない: handleSubmit は password !== passwordConfirm の
 * とき setError して return する（setLoading(true) と signup() の前）。全欄を埋めて submit を
 * 押すとエラー経路だけが走り、ネットワークもナビゲーションも発生しない。
 *
 * useTranslations（auth.signup / auth.error）と next/link・useRouter 依存のため
 * withVerifyProviders（NextIntlClientProvider＋AppRouter no-op mock）で包む。
 * 各 input は <label> 内包で既にラベル付きだが、明示 aria-label（t(...) 流用）を付け、確認欄を
 * 個別セレクトできるようにした（既存の見た目・振る舞いは不変）。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SignupForm } from './signup-form';

type Props = Record<string, never>;

// 確認欄の aria-label（ja.json の auth.signup.confirm_label）。act で確認欄を個別に選ぶため。
const CONFIRM_LABEL = 'パスワード確認';

registerUnit<Props>({
  id: 'SignupForm',
  title: 'SignupForm',
  description:
    'サインアップフォーム（ニックネーム／メール／パスワード／確認の入力・パスワード不一致検証）。',
  kind: 'component',
  render: () => withVerifyProviders(<SignupForm />),
  fixtures: [
    {
      id: 'empty',
      description: '初期状態（全欄が空・エラー無し）',
      props: {},
    },
    {
      id: 'filled',
      description: '全欄に入力すると各 has* が true になる（パスワード一致・エラー無し）',
      props: {},
      act: async (ctx) => {
        await ctx.type('input[type="text"]', 'my_nickname');
        await ctx.type('input[type="email"]', 'user@example.com');
        await ctx.type('input[type="password"]', 'secret123');
        await ctx.type(`input[aria-label="${CONFIRM_LABEL}"]`, 'secret123');
        await ctx.wait(16);
      },
    },
    {
      id: 'password-mismatch',
      probe: true,
      description:
        'Probe: パスワードと確認が不一致のまま送信するとエラーになる（fetch もナビゲーションも発生しない）',
      props: {},
      act: async (ctx) => {
        await ctx.type('input[type="text"]', 'my_nickname');
        await ctx.type('input[type="email"]', 'user@example.com');
        await ctx.type('input[type="password"]', 'secret123');
        await ctx.type(`input[aria-label="${CONFIRM_LABEL}"]`, 'different456');
        await ctx.click('button[type="submit"]');
        await ctx.wait(16);
      },
    },
    {
      id: 'type-then-clear',
      probe: true,
      description: 'Probe: メールを入力後に全消去すると hasEmail=false に戻る（入力対称性）',
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
      id: 'structure-four-inputs-and-submit',
      description: '4つの入力（text/email/password×2）と名前付き送信ボタンが常に存在する',
      check: ({ root }) => {
        const text = root.querySelector('input[type="text"]');
        const email = root.querySelector('input[type="email"]');
        const passwords = root.querySelectorAll('input[type="password"]');
        const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]');
        const named = (submit?.textContent ?? '').trim().length > 0;
        return (
          (Boolean(text) && Boolean(email) && passwords.length === 2 && Boolean(submit) && named) ||
          `text=${Boolean(text)}, email=${Boolean(email)}, passwords=${passwords.length}, submit=${Boolean(submit)}, named=${named}`
        );
      },
    },
    {
      id: 'has-fields-reflect-inputs',
      description: '各 has* 契約が対応する input の非空を反映する',
      check: ({ root, contract }) => {
        const text = root.querySelector<HTMLInputElement>('input[type="text"]');
        const email = root.querySelector<HTMLInputElement>('input[type="email"]');
        const passwords = root.querySelectorAll<HTMLInputElement>('input[type="password"]');
        const pw = passwords[0]?.value ?? '';
        const confirm = passwords[1]?.value ?? '';
        const expect = {
          hasNickname: String((text?.value ?? '').length > 0),
          hasEmail: String((email?.value ?? '').length > 0),
          hasPassword: String(pw.length > 0),
          hasConfirm: String(confirm.length > 0),
        };
        return (
          (contract.hasNickname === expect.hasNickname &&
            contract.hasEmail === expect.hasEmail &&
            contract.hasPassword === expect.hasPassword &&
            contract.hasConfirm === expect.hasConfirm) ||
          `contract(${contract.hasNickname},${contract.hasEmail},${contract.hasPassword},${contract.hasConfirm}) vs inputs(${expect.hasNickname},${expect.hasEmail},${expect.hasPassword},${expect.hasConfirm})`
        );
      },
    },
    {
      id: 'error-banner-iff-has-error',
      description: 'エラー文言（赤バナー）は hasError=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasBanner = Boolean(root.querySelector('p.text-red-600'));
        const expectError = contract.hasError === 'true';
        return (
          hasBanner === expectError ||
          `error banner present=${hasBanner} だが contract.hasError="${contract.hasError}"`
        );
      },
    },
    {
      id: 'default-empty',
      description: '初期状態は全 has* が false・エラー無し',
      onlyFixtures: ['empty'],
      check: ({ contract }) =>
        (contract.hasNickname === 'false' &&
          contract.hasEmail === 'false' &&
          contract.hasPassword === 'false' &&
          contract.hasConfirm === 'false' &&
          contract.hasError === 'false') ||
        `expected all-empty, got nick=${contract.hasNickname}, email=${contract.hasEmail}, pw=${contract.hasPassword}, confirm=${contract.hasConfirm}, err=${contract.hasError}`,
    },
    {
      id: 'filled-all-true-no-error',
      description: '全欄入力後は各 has* が true・パスワード一致でエラー無し',
      onlyFixtures: ['filled'],
      check: ({ contract }) =>
        (contract.hasNickname === 'true' &&
          contract.hasEmail === 'true' &&
          contract.hasPassword === 'true' &&
          contract.hasConfirm === 'true' &&
          contract.hasError === 'false') ||
        `expected all-true & no-error, got nick=${contract.hasNickname}, email=${contract.hasEmail}, pw=${contract.hasPassword}, confirm=${contract.hasConfirm}, err=${contract.hasError}`,
    },
    {
      id: 'mismatch-shows-error',
      description: 'パスワード不一致送信後は hasError=true（不一致メッセージ表示）',
      onlyFixtures: ['password-mismatch'],
      check: ({ root, contract }) => {
        const shown = Boolean(root.textContent?.includes('パスワードが一致しません'));
        return (
          (contract.hasError === 'true' && shown) ||
          `expected hasError=true & mismatch text, got hasError=${contract.hasError}, shown=${shown}`
        );
      },
    },
    {
      id: 'clear-resets-email',
      description: '入力後に全消去すると hasEmail=false に戻る（入力対称性）',
      onlyFixtures: ['type-then-clear'],
      check: ({ contract }) =>
        contract.hasEmail === 'false' ||
        `expected hasEmail=false after clear, got "${contract.hasEmail}"`,
    },
  ],
});
