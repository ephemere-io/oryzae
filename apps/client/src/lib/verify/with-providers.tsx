/**
 * 検証ハーネス用のプロバイダ土台。
 *
 * `*.verify.tsx` の `render` でコンポーネントをこれで包むと、孤立レンダリング時にも
 * i18n（next-intl）と Next App Router の context が供給され、`useTranslations` /
 * `useRouter` / `usePathname` / `useSearchParams` を使う部品がクラッシュせず検証できる。
 *
 * - i18n: 既存 vitest テストと同じ `NextIntlClientProvider` + ja.json。
 * - router: vitest(jsdom) には Next ランタイムが無く useRouter が throw するため、
 *   AppRouterContext 等に no-op の mock を供給する。ブラウザの /verify dashboard・replay では
 *   本物の Router が外側に居るが、ここで内側に no-op を被せることで replay 中の実ナビゲーション
 *   も防げる（副作用なし）。
 * - auth: useAuth は AuthProvider 配下でないと throw する（#363 で Context 化）。孤立検証では
 *   fetch を走らせたくないので、未ログイン・loading=false の no-op 値を内側に供給する
 *   （router シムと同じ発想。実 AuthProvider は restoreSession で /auth/me を叩くため使わない）。
 *
 * 配置が lib/ なのは dep-cruise の lib-independence に適合するため（i18n / 外部パッケージの
 * import は許可。features/*.verify.tsx は lib/ を import 可）。
 *
 * データ取得フック依存は各 spec 側で `api=null` seam 等で no-op にする。孤立検証に乗らない
 * 部品（ページ級合成・OAuth 等）はコンポーネント先頭に `// verify-exempt: <理由>` を記載する。
 */

import {
  AppRouterContext,
  type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {
  PathnameContext,
  SearchParamsContext,
} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import jaMessages from '@/i18n/messages/ja.json';
import { AuthContext, type AuthContextValue } from '@/lib/auth-context';

const noop = () => {};
const noopRouter: AppRouterInstance = {
  back: noop,
  forward: noop,
  refresh: noop,
  push: noop,
  replace: noop,
  prefetch: noop,
};

// 孤立検証用の未ログイン認証状態。loading=false で settled、login/signup/logout は no-op。
const noopAuth: AuthContextValue = {
  auth: null,
  api: null,
  loading: false,
  login: async () => null,
  signup: async () => null,
  logout: noop,
};

export function withVerifyProviders(node: ReactNode) {
  return (
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      <AuthContext.Provider value={noopAuth}>
        <AppRouterContext.Provider value={noopRouter}>
          <PathnameContext.Provider value="/verify">
            <SearchParamsContext.Provider value={new URLSearchParams()}>
              {node}
            </SearchParamsContext.Provider>
          </PathnameContext.Provider>
        </AppRouterContext.Provider>
      </AuthContext.Provider>
    </NextIntlClientProvider>
  );
}
