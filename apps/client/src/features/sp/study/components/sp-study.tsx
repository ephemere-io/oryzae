'use client';

// verify-exempt: 構図の定数を渡すだけの入口。中身は features/shared/study が検証済み。

import { StudyHome } from '@/features/shared/study/components/study-home';
import { SP_LAYOUT } from '@/features/shared/study/layout';

/**
 * SP の書斎。机と正対したクオータートップ（仰角およそ 52°）。
 *
 * ボトムナビを書斎ホームでは描かなくなったので、下端のキャプションを出せる
 * （競合していた 64px が空いた）。
 */
export function SpStudy() {
  return <StudyHome layout={SP_LAYOUT} showCaption />;
}
