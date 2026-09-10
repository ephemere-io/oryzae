'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DeviceView } from '@/components/device-view';
import { PcStudy } from '@/features/pc/study/components/pc-study';
import { useStudyHome } from '@/features/shared/study/hooks/use-study-home-flag';
import { SpStudy } from '@/features/sp/study/components/sp-study';
import { StudyRouteLoading } from './_loading/study-route-loading';

/**
 * ルート（`/`）＝書斎ホーム（`docs/oryzae-study/`）。
 *
 * 以前は `/` が振り分けだけのゲート（`HomeGate`）で、書斎は `/study` にあった。
 * 「`/study` に行かなくてもいい、ルート自体が書斎になればいい」（オーナーの判断）。
 * 古い `/study` は `/` へ転送する（`next.config.ts`）。
 *
 * `/` がやっていた振り分けは次のように引き継いでいる:
 *  - メールのリンクの hash（トークン・期限切れ）… 保護レイアウトの `useRootHashHandoff`。
 *    **ログインへ送る判断より先に読む**（後に回すと hash ごと捨てられる）
 *  - 未ログイン → `/login` … 保護レイアウト
 *  - 書斎を止めている（`NEXT_PUBLIC_STUDY_HOME=off` / `?study=off`）… ここで `/entries/new` へ
 *
 * **`resolved` を待ってから送ること。** `?study=off` の手動切替はブラウザにしか無く、
 * 初回レンダーでは読めない。
 *
 * 送っている間は空を返さずロード表示を出す（`return null` にすると、レイアウトが出していた
 * ロード表示が一度消えて真っ白が挟まる）。
 */
export default function StudyHomePage() {
  const { enabled: studyHome, resolved } = useStudyHome();
  const router = useRouter();

  useEffect(() => {
    if (resolved && !studyHome) router.replace('/entries/new');
  }, [resolved, studyHome, router]);

  if (!studyHome) return <StudyRouteLoading />;

  // 端末で出し分け（URL は / のまま）。
  return <DeviceView pc={<PcStudy />} sp={<SpStudy />} />;
}
