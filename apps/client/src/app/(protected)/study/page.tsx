'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DeviceView } from '@/components/device-view';
import { PcStudy } from '@/features/pc/study/components/pc-study';
import { useStudyHome } from '@/features/shared/study/hooks/use-study-home-flag';
import { SpStudy } from '@/features/sp/study/components/sp-study';
import { StudyRouteLoading } from '../_loading/study-route-loading';

/**
 * 書斎ホーム（`docs/oryzae-study/`）。
 *
 * フラグ off のときは従来の入口（`/entries/new`）へ送る。URL を直打ちされても書斎が
 * 漏れないようにするためで、フラグを消せばこのルートごと無効化できる。
 *
 * 送っている間は空を返さずロード表示を出す。`return null` にするとレイアウトが出していた
 * ロード表示が一度消えて真っ白になる（ロード表示 → 真っ白 → 行き先）。
 */
export default function StudyPage() {
  const studyHome = useStudyHome();
  const router = useRouter();

  useEffect(() => {
    if (!studyHome) router.replace('/entries/new');
  }, [studyHome, router]);

  if (!studyHome) return <StudyRouteLoading />;

  // 端末で出し分け（URL は /study のまま）。
  return <DeviceView pc={<PcStudy />} sp={<SpStudy />} />;
}
