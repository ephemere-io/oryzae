import { ListSkeleton } from '@/components/ui/list-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * 保護下ルートの遷移ローディング（Issue #363）。タブ切り替え時の RSC 往復中、
 * loading.tsx が無いと旧画面が固まって「ローディングが出ない・カタカタする」ため、
 * ここで即座にヘッダ＋一覧スケルトンを出す。レイアウト（シェル・ボトムナビ）は持続し、
 * ページ枠だけがこのフォールバックに差し替わる。
 */
export default function Loading() {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6 pb-3">
        <Skeleton className="h-6 w-32" />
      </div>
      <ListSkeleton />
    </div>
  );
}
