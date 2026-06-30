'use client';

import { useSearchParams } from 'next/navigation';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * 保護下ルートの遷移ローディング（Issue #363）。タブ切り替え時の RSC 往復中、
 * loading.tsx が無いと旧画面が固まって「ローディングが出ない・カタカタする」ため、
 * ここで即座にヘッダ＋一覧スケルトンを出す。レイアウト（シェル・ボトムナビ）は持続し、
 * ページ枠だけがこのフォールバックに差し替わる。
 *
 * 例外: 漬け込み（/jar?justPickled=1）への遷移はそれ自体が専用の演出アニメで覆われるため、
 * スケルトンを出すと演出に重なって途切れて見える。この遷移のときだけ何も描画しない
 * （演出アニメ側に遷移表現を委ねる）。マーカーは漬け込み専用の既存クエリを再利用する。
 */
export default function Loading() {
  const params = useSearchParams();
  if (params.get('justPickled')) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6 pb-3">
        <Skeleton className="h-6 w-32" />
      </div>
      <ListSkeleton />
    </div>
  );
}
