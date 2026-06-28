/**
 * SpAccountPage の検証スペック（A 移植・SP スライス）。
 * SP 版アカウント画面。データは props（user/onLogout）で完全注入され、render 経路に
 * router(next/navigation) もデータ取得フックも無いため孤立検証できる。i18n（account.*）
 * 依存なので withVerifyProviders（NextIntlClientProvider）で包む。
 *
 * 契約は root の hasAvatar（アバター画像 / イニシャル span の分岐）だけを公表する。
 * theme トグルと言語 select は ThemeProvider 不在（既定 context = noop）/ server action のため
 * 孤立状態では観測可能な変化が起きない → 状態変化を assert する fixture は作らない。
 * 孤立検証できる実挙動は (1) hasAvatar 分岐 (2) NicknameField の編集トグル
 * (3) ニックネーム変更保存時、トークン無しで「ログインが必要です」を出して fetch せず止まる経路。
 *
 * 保存エラー probe: getAccessToken() は jsdom で localStorage 未設定 → null を返し、
 * handleSave は createApiClient.fetch に到達する前に profile.error_login_required を表示して return する。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpAccountPage } from './sp-account-page';

interface Props {
  user: {
    id: string;
    email: string;
    nickname: string | null;
    avatarUrl: string | null;
    name: string | null;
    providers: string[];
  };
  onLogout: () => void;
}

const noop = () => {};

const baseUser = {
  id: 'u-12345',
  email: 'taro@example.com',
  nickname: 'たろう',
  avatarUrl: null,
  name: null,
  providers: ['google'],
};

registerUnit<Props>({
  id: 'SpAccountPage',
  title: 'SpAccountPage',
  description: 'SP 版アカウント画面（プロフィール・ニックネーム編集・設定・ログアウト）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<SpAccountPage {...props} />),
  fixtures: [
    {
      id: 'initials',
      description: 'アバター画像なし → イニシャル span を表示（hasAvatar=false）',
      props: { user: { ...baseUser, avatarUrl: null }, onLogout: noop },
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
      description: '「編集」を押すとニックネームのインライン入力が現れる',
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
        'Probe: ニックネームを変更して保存しても、トークン無しなら fetch せず「ログインが必要です」を表示して止まる',
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
      description: 'contract.hasAvatar が true のときだけ img が描画される（false ならイニシャル）',
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
      id: 'idle-has-no-edit-input',
      description: '初期状態（非編集）はニックネーム入力が描画されない',
      onlyFixtures: ['initials', 'with-avatar'],
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
