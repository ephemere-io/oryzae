'use client';

import { DeviceView } from '@/components/device-view';
import { PageLoading } from '@/components/ui/page-loading';

/**
 * `/board` のロード表示。
 *
 * ボードは方眼の上に紙片が散らばる**キャンバス**で、カードの位置・大きさ・枚数は
 * サーバー保存のレイアウト依存。つまり枠を先に置いても位置が当たらず、予告にならない。
 * BoardView 本体がデータ取得中に出すローダーと同じ `PageLoading` を出して、
 * 「枠 → ローダー → 本体」と表示が二度変わるのを防ぐ。
 *
 * SP も同じ理由で `PageLoading`。SP のボードは盤面を開いた時に一度フィットさせるので、
 * 位置の予告はいっそう当たらない。
 */
export function BoardRouteLoading() {
  const loading = (
    <div className="absolute inset-0">
      <PageLoading />
    </div>
  );
  return <DeviceView pc={loading} sp={loading} />;
}
