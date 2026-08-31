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
 * SP 変種は無い（board page も pc のみ）ので、DeviceView の既定どおり SP では
 * 「スマホ未対応」表示にフォールバックする＝実ページと同じ挙動。
 */
export function BoardRouteLoading() {
  return (
    <DeviceView
      pc={
        <div className="absolute inset-0">
          <PageLoading />
        </div>
      }
    />
  );
}
