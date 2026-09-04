'use client';

// verify-exempt: 構図の定数を渡すだけの入口。中身は features/shared/study が検証済み。

import { StudyHome } from '@/features/shared/study/components/study-home';
import { SP_LAYOUT } from '@/features/shared/study/layout';

/**
 * SP の書斎。机と正対したクオータートップ（仰角およそ 52°）。
 *
 * 下端のキャプションは出さない。SP シェルには 64px のボトムナビが常時あり、
 * そこへ「書斎 / STUDY / 状態」を重ねると縦の余白が足りない
 * （docs/oryzae-study/60-implementation-notes.md §6）。
 */
export function SpStudy() {
  return <StudyHome layout={SP_LAYOUT} showCaption={false} />;
}
