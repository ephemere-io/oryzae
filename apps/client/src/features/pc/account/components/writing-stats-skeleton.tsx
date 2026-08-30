import { verifyAttrs } from '@oryzae/verify';
import { Skeleton, skeletonKeys } from '@/components/ui/skeleton';

/**
 * 統計セクション（WritingStats）のスケルトン。
 *
 * 直したかった不具合: 読み込み中は `if (loading) return null` で**高さゼロ**だったため、
 * データが届いた瞬間にブロックまるごと出現し、下のセクションがまとめて押し下げられていた
 * （スクロール中だと「急に画面が増える」ように見える）。
 *
 * 幸いこの画面は**寸法が全部決まっている**ので、枠で正確に場所取りできる:
 *  - サマリーカードは6枚固定（streak / 総エントリ / 総文字数 / 発酵 / 週 / 月）
 *  - 月次推移はサーバーが必ず12ヶ月分返す（user-me.ts の `for (let i = 11; i >= 0; i--)`）
 *
 * 「問いごとのエントリ数」だけは件数が可変（0件なら節ごと出ない）なので枠を置かない。
 * ここは最後の節で高さも小さく、大半のズレは上の2つを確保すれば消える。
 */

/** StatCard 1枚（実物: rounded-lg p-4 ＋ 1px 罫 = 82px）。 */
function StatCardSkeleton() {
  return (
    <div className="rounded-lg p-4" style={{ border: '1px solid var(--border-subtle)' }}>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="mt-1 h-7 w-16" />
    </div>
  );
}

export function WritingStatsSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-hidden="true"
      {...verifyAttrs({ unit: 'WritingStatsSkeleton', slots: 'cards,monthly-trend', cards: 6 })}
    >
      {/* サマリーカード（実物: grid grid-cols-3 gap-3 に6枚） */}
      <div className="grid grid-cols-3 gap-3" data-skeleton-slot="cards">
        {skeletonKeys(6).map((k) => (
          <StatCardSkeleton key={k} />
        ))}
      </div>

      {/* 月次推移（実物: 見出し mb-3 ＋ gap-1 の12行、各行は h-4 のバー） */}
      <div data-skeleton-slot="monthly-trend">
        <Skeleton className="mb-3 h-4 w-28" />
        <div className="flex flex-col gap-1">
          {skeletonKeys(12).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <Skeleton className="h-4 w-14 shrink-0" />
              <Skeleton className="h-4 flex-1 rounded-sm" />
              <Skeleton className="h-4 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
