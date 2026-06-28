/**
 * 検証ハーネス用のプロバイダ土台。
 *
 * `*.verify.tsx` の `render` でコンポーネントをこれで包むと、孤立レンダリング時にも
 * i18n（next-intl）が供給され、`useTranslations` を使う部品（client の大半）が
 * クラッシュせず検証できる。既存の vitest テストと同じ `NextIntlClientProvider` + ja.json。
 *
 * 配置が lib/ なのは dep-cruise の lib-independence（lib は features/app/components を
 * import 不可）に適合するため。i18n の import は許可されている。features/*.verify.tsx は
 * lib/ を import 可。
 *
 * router（next/navigation）やデータ取得フックに依存する部品は別途（router shim / props
 * 化 / モック）で対応する。まずは i18n を供給する最小の土台。
 */

import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import jaMessages from '@/i18n/messages/ja.json';

export function withVerifyProviders(node: ReactNode) {
  return (
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      {node}
    </NextIntlClientProvider>
  );
}
