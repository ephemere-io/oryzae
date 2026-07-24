/**
 * LoginForm の検証スペック（A 移植・認証フォーム）。
 * useRouter / useTranslations / useAuth を使うが、いずれも render 時には fetch せず crash も
 * しない: withVerifyProviders が AppRouter/Pathname/SearchParams と i18n を供給し、useAuth は
 * localStorage にトークンが無い jsdom では restoreSession が即 early-return する（fetch ゼロ・
 * posthog 未呼び出し）。よって props 不要で孤立描画でき covered。
 *
 * 公表する契約は実際に変化しうる状態のみ: filled（識別子＋パスワード両方が入力済み）/ loading
 * （送信中）/ hasError（エラー文表示中）。filled は act の type で false→true に遷移させて検証
 * する。loading / hasError は submit を踏まないと立たない（submit→login→相対 URL fetch は
 * jsdom で reject し handleSubmit に try/catch が無いため fixture では決して click しない）。
 * その分 invariant を双条件にして「false 枝でも嘘を捕まえる」検査にしている。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { LoginForm } from './login-form';

type Props = Record<string, never>;

registerUnit<Props>({
  id: 'LoginForm',
  title: 'LoginForm',
  description: 'メール/ニックネーム + パスワードのログインフォーム（Google ログイン併設）。',
  kind: 'component',
  render: () => withVerifyProviders(<LoginForm />),
  fixtures: [
    {
      id: 'empty',
      description: '初期状態（両フィールド空・エラー無し・送信ボタン押下可）',
      props: {},
    },
    {
      id: 'filled',
      description: '識別子とパスワードを入力すると filled=true になる',
      props: {},
      act: async (ctx) => {
        await ctx.type('input[type="text"]', 'tester@example.com');
        await ctx.type('input[type="password"]', 'hunter2');
        await ctx.wait(16);
      },
    },
    {
      id: 'identifier-only',
      probe: true,
      description: 'Probe: 識別子だけ入力（パスワード空）では filled=false のまま',
      props: {},
      act: async (ctx) => {
        await ctx.type('input[type="text"]', 'tester@example.com');
        await ctx.wait(16);
      },
    },
    {
      id: 'whitespace-identifier',
      probe: true,
      description: 'Probe: 識別子が空白のみだと（trim 後空で）filled=false 扱い',
      props: {},
      act: async (ctx) => {
        await ctx.type('input[type="text"]', '     ');
        await ctx.type('input[type="password"]', 'hunter2');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'filled-reflects-inputs',
      description: 'contract.filled が「識別子(trim) と パスワード が両方非空」を反映する',
      check: ({ root, contract }) => {
        const id = root.querySelector<HTMLInputElement>('input[type="text"]');
        const pw = root.querySelector<HTMLInputElement>('input[type="password"]');
        const actuallyFilled = (id?.value ?? '').trim().length > 0 && (pw?.value ?? '').length > 0;
        return (
          contract.filled === String(actuallyFilled) ||
          `contract.filled="${contract.filled}" だが id="${id?.value}" pw.len=${pw?.value?.length}（filled=${actuallyFilled}）`
        );
      },
    },
    {
      id: 'error-present-iff-haserror',
      description: 'エラー文（赤背景の <p>）は hasError=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasErrorEl = Boolean(root.querySelector('p.text-red-600'));
        const expectError = contract.hasError === 'true';
        return (
          hasErrorEl === expectError ||
          `error present=${hasErrorEl} だが contract.hasError="${contract.hasError}"`
        );
      },
    },
    {
      id: 'submit-disabled-iff-loading',
      description: '送信ボタンの disabled は loading=true のときだけ立つ',
      check: ({ root, contract }) => {
        const btn = root.querySelector<HTMLButtonElement>('button[type="submit"]');
        const expectLoading = contract.loading === 'true';
        return (
          (btn?.disabled ?? false) === expectLoading ||
          `submit disabled=${btn?.disabled} だが contract.loading="${contract.loading}"`
        );
      },
    },
    {
      id: 'empty-default-collapsed',
      description: '初期状態は filled=false・loading=false・hasError=false',
      onlyFixtures: ['empty'],
      check: ({ contract }) =>
        (contract.filled === 'false' &&
          contract.loading === 'false' &&
          contract.hasError === 'false') ||
        `expected all false, got filled=${contract.filled}, loading=${contract.loading}, hasError=${contract.hasError}`,
    },
    {
      id: 'filled-after-typing-both',
      description: '両フィールド入力後は filled=true',
      onlyFixtures: ['filled'],
      check: ({ contract }) =>
        contract.filled === 'true' ||
        `expected filled=true after typing both, got "${contract.filled}"`,
    },
    {
      id: 'identifier-only-stays-unfilled',
      description: '識別子だけでは filled=false（パスワード未入力）',
      onlyFixtures: ['identifier-only'],
      check: ({ contract }) =>
        contract.filled === 'false' ||
        `expected filled=false with identifier only, got "${contract.filled}"`,
    },
  ],
});
