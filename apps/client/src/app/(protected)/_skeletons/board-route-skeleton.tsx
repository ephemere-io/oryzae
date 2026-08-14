'use client';

import { DeviceView } from '@/components/device-view';
import { BoardViewSkeleton } from '@/features/pc/board/components/board-view-skeleton';

/**
 * `/board` のロード枠。SP 変種は無い（board page も pc のみ）ので、DeviceView の
 * 既定どおり SP では「スマホ未対応」表示にフォールバックする＝実ページと同じ挙動。
 * ここで一覧枠を出すと、SP では未対応表示に、PC では盤面に置き換わって二重に嘘になる。
 */
export function BoardRouteSkeleton() {
  return <DeviceView pc={<BoardViewSkeleton />} />;
}
