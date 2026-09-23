'use client';

import { createContext, type ReactNode, useContext } from 'react';

/**
 * 画面の左上に置く「戻る」の行き先（context の器のみ）。
 *
 * 行き先を決めるのは `(protected)/layout.tsx`、置くのは各画面（ヘッダーの先頭に
 * `components/ui/back-link` を差す）。lib はドメインを知らないので、値は行き先と
 * 文言と記号だけで持つ（「書斎」という語も絵もここには出てこない）。
 *
 * **null は「戻る先が無い」。** 書斎そのもの、書斎が無効でサイドバーが道を持っている間、
 * provider の外（孤立検証・テスト）がこれにあたり、`BackLink` は何も描かない。
 */
interface BackLinkTarget {
  href: string;
  /** 見える名前。行き先の名前だけを書く（「書斎」）。 */
  label: string;
  /** 読み上げの名前。動作まで言う（「書斎に戻る」）。 */
  ariaLabel: string;
  /** 名前の後ろに添える行き先の記号（書斎の絵）。読み上げには出さない。 */
  icon?: ReactNode;
}

const BackLinkContext = createContext<BackLinkTarget | null>(null);

export const BackLinkProvider = BackLinkContext.Provider;

export function useBackLink(): BackLinkTarget | null {
  return useContext(BackLinkContext);
}
