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

const noop = () => {};
const noopRouter: AppRouterInstance = {
  back: noop,
  forward: noop,
  refresh: noop,
  push: noop,
  replace: noop,
  prefetch: noop,
};

export function withVerifyProviders(node: ReactNode) {
  return (
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      <AppRouterContext.Provider value={noopRouter}>
        <PathnameContext.Provider value="/verify">
          <SearchParamsContext.Provider value={new URLSearchParams()}>
            {node}
          </SearchParamsContext.Provider>
        </PathnameContext.Provider>
      </AppRouterContext.Provider>
    </NextIntlClientProvider>
  );
}
