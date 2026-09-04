'use client';

// verify-exempt: 構図の定数を渡すだけの入口。中身は features/shared/study が検証済み。

import { StudyHome } from '@/features/shared/study/components/study-home';
import { PC_LAYOUT } from '@/features/shared/study/layout';

/**
 * PC の書斎。俯瞰（仰角およそ 18°）から机と壁を見る構図。
 *
 * 端末と構図の対応づけはここが持つ。`features/shared/study` は端末を知らない。
 */
export function PcStudy() {
  return <StudyHome layout={PC_LAYOUT} showCaption />;
}
