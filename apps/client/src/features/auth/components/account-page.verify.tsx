/**
 * AccountPage の検証スペック（PC 版アカウント画面）。
 * データは props（user/onLogout）で完全注入される。render 経路に残る依存は孤立検証可能:
 * - i18n（account.* / stats.* / auth.error.*）→ withVerifyProviders（NextIntlClientProvider）。
 * - next/link（useRouter 等）→ withVerifyProviders が AppRouter/Pathname/SearchParams を供給。
 * - useTheme()（theme-context）→ createContext の既定値（light / noop）を持つため Provider 不在でも crash しない。
 * - <WritingStats /> の useUserStats() → getAccessToken() が jsdom で null（token 未設定）→ early-return で
 *   fetch せず loading=true のまま → WritingStats は null を返す（描画ゼロ・fetch ゼロ）。
 * よって render は fetch を一切起こさず純レンダリングになり、props だけで孤立検証できる。
 *
 * 公表する契約は PC 固有の実状態のみ: hasAvatar（アバター img / イニシャル span の分岐）と
 * isOAuthOnly（providers が email を含まない＝メール/パスワード変更を出さない分岐）。
 * theme トグル・言語 select は Provider 不在 / server action のため孤立状態では観測可能な
 * 変化が起きない → 状態変化を assert する fixture は作らない（SP 版と同方針）。
 *
 * 保存エラー probe: getAccessToken() は jsdom で null を返すため、ニックネームを変更して保存しても
 * updateProfile が createApiClient.fetch に到達する前に profile.error_login_required を表示して
 * return する（fetch ゼロ）。draft===value だと handleSave が即 return するので、別の値を入力する。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { AccountPage } from './account-page';

interface User {
  id: string;
  email: string;
  nickname: string | null;
  avatarUrl: string | null;
  name: string | null;
  providers: string[];
}

interface Props {
  user: User;
  onLogout: () => void;
}

const noop = () => {};

const baseUser: User = {
  id: 'u-12345',
  email: 'taro@example.com',
  nickname: 'たろう',
  avatarUrl: null,
  name: null,
  providers: ['email'],
};

registerUnit<Props>({
  id: 'AccountPage',
  title: 'AccountPage',
  description:
    'PC 版アカウント画面（プロフィール・ニックネーム編集・メール/パスワード変更・統計・設定・ログアウト）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<AccountPage {...props} />),
  fixtures: [
    {
      id: 'email-user',
      description:
        'email プロバイダのユーザー → パスワード変更セクションあり（isOAuthOnly=false・hasAvatar=false）',
      props: { user: { ...baseUser, providers: ['email'] }, onLogout: noop },
    },
    {
      id: 'oauth-only',
      description: 'OAuth のみ（providers=google）→ パスワード変更を出さない（isOAuthOnly=true）',
      props: { user: { ...baseUser, providers: ['google'] }, onLogout: noop },
    },
    {
      id: 'with-avatar',
      description: 'アバター画像あり → img を表示（hasAvatar=true）',
      props: {
        user: { ...baseUser, avatarUrl: 'https://example.com/avatar.png' },
        onLogout: noop,
      },
    },
    {
      id: 'editing-nickname',
      description: 'ニックネームの「編集」を押すとインライン入力（aria-label 付き）が現れる',
      props: { user: { ...baseUser }, onLogout: noop },
      act: async (ctx) => {
        await ctx.click('button');
        await ctx.wait(16);
      },
    },
    {
      id: 'save-without-token',
      probe: true,
      description:
        'Probe: ニックネームを別の値に変えて保存しても、トークン無しなら fetch せず「ログインが必要です」を表示して止まる',
      props: { user: { ...baseUser }, onLogout: noop },
      act: async (ctx) => {
        await ctx.click('button');
        await ctx.wait(16);
        await ctx.type('input[aria-label="ニックネーム"]', 'じろう');
        await ctx.wait(16);
        await ctx.click('button');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'has-avatar-matches-img',
      description:
        'contract.hasAvatar が true のときだけ img が描画される（false ならイニシャル span）',
      check: ({ root, contract }) => {
        const hasImg = Boolean(root.querySelector('img'));
        const claimed = contract.hasAvatar === 'true';
        return (
          hasImg === claimed ||
          `hasAvatar 契約不一致: contract.hasAvatar=${contract.hasAvatar}, img描画=${hasImg}`
        );
      },
    },
    {
      id: 'oauth-only-hides-password',
      description:
        'isOAuthOnly=true のときはパスワード変更セクション（「パスワード」ラベル）を描画しない',
      check: ({ root, contract }) => {
        const hasPassword = Boolean(root.textContent?.includes('パスワード'));
        const claimedOAuth = contract.isOAuthOnly === 'true';
        return (
          hasPassword === !claimedOAuth ||
          `isOAuthOnly 契約不一致: contract.isOAuthOnly=${contract.isOAuthOnly}, パスワード欄描画=${hasPassword}`
        );
      },
    },
    {
      id: 'identity-rendered',
      description: 'メールアドレスとユーザーIDが必ず描画される',
      check: ({ root, props }) => {
        const text = root.textContent ?? '';
        if (!text.includes(props.user.email)) {
          return `メールアドレス "${props.user.email}" が描画されていない`;
        }
        return text.includes(props.user.id) || `ユーザーID "${props.user.id}" が描画されていない`;
      },
    },
    {
      id: 'logout-button-present',
      description: 'ログアウトボタンが必ず描画される（type=button・赤字）',
      check: ({ root }) =>
        Boolean(root.querySelector('button.text-red-500')) || 'ログアウトボタンが見つからない',
    },
    {
      id: 'idle-has-no-nickname-input',
      description: '初期状態（非編集）はニックネーム入力が描画されない',
      onlyFixtures: ['email-user', 'oauth-only', 'with-avatar'],
      check: ({ root }) =>
        root.querySelector('input[aria-label="ニックネーム"]') === null ||
        '非編集状態なのにニックネーム入力が描画されている',
    },
    {
      id: 'edit-reveals-input',
      description: '編集クリック後はニックネーム入力（aria-label 付き）が描画される',
      onlyFixtures: ['editing-nickname'],
      check: ({ root }) =>
        Boolean(root.querySelector('input[aria-label="ニックネーム"]')) ||
        '編集クリック後にニックネーム入力が現れていない',
    },
    {
      id: 'save-without-token-shows-error',
      description: 'トークン無しの保存はログイン必須エラーを表示し fetch しない',
      onlyFixtures: ['save-without-token'],
      check: ({ root }) =>
        Boolean(root.textContent?.includes('ログインが必要です')) ||
        '保存エラー（ログインが必要です）が表示されていない',
    },
  ],
});
