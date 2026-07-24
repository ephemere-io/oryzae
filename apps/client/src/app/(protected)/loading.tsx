'use client';

import { useSearchParams } from 'next/navigation';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { useDevice } from '@/lib/use-device';

/**
 * 保護下ルートの遷移ローディング（Issue #363）。タブ切り替え時の RSC 往復中、
 * loading.tsx が無いと旧画面が固まって「ローディングが出ない・カタカタする」ため、
 * ここで即座にスケルトンを出す。レイアウト（シェル・サイドバー/ボトムナビ）は持続し、
 * ページ枠だけがこのフォールバックに差し替わる。
 *
 * 端末でスケルトンの枠を出し分ける（PC/SP でページの実レイアウトが異なるため）。
 * 旧実装は SP 形（全幅・左 px-5）固定だったので、PC では中央寄せの本体と位置がズレ、
 * 本体読込時にスケルトンと全く違う位置へ DOM がジャンプしていた。
 *  - PC: 一覧ページと同じ中央枠（max-w-[680px] px-6 pt-10）＋ヘッダ行＋フィルタ/検索
 *        プレースホルダ＋カード型行。ページ mount 後に出る EntryList のスケルトン段階
 *        （ヘッダ→問いフィルタ→検索→EntryListSkeleton）と枠・縦順・行の形を揃え、
 *        横位置だけでなく縦位置も継ぎ目なくする。
 *        （questions は max-w-[800px]・board/jar は全幅キャンバスのため厳密一致はしないが、
 *          いずれも中央寄せ近似で旧実装より良く、報告されたのは一覧のズレ。）
 *  - SP: 全画面・全幅の一覧スケルトン（各 SP 画面と同形）。
 *
 * 例外: 漬け込み（/jar?justPickled=1）への遷移はそれ自体が専用の演出アニメで覆われるため、
 * スケルトンを出すと演出に重なって途切れて見える。この遷移のときだけ何も描画しない
 * （演出アニメ側に遷移表現を委ねる）。マーカーは漬け込み専用の既存クエリを再利用する。
 */
const PC_ROW_KEYS = ['r1', 'r2', 'r3', 'r4', 'r5'];

export default function Loading() {
  const params = useSearchParams();
  const device = useDevice();
  if (params.get('justPickled')) return null;

  if (device === 'pc') {
    return (
      <div className="flex min-h-full flex-col">
        <div className="mx-auto w-full max-w-[680px] flex-1 px-6 pt-10 pb-20" aria-hidden="true">
          {/* ヘッダ行（一覧ページの「All Entries / + New Entry」と同じ高さ・配置） */}
          <div className="mb-8 flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
          {/* 問いフィルタ行（EntryList: ラベル＋select, mb-3）。本体 mount 後に
              フィルタ＋検索が挿入されると下のカード行が縦にずれるのを防ぐ。 */}
          <div className="mb-3 flex items-center gap-2">
            <Skeleton className="h-3 w-12 shrink-0" />
            <Skeleton className="h-10 flex-1 rounded-lg" />
          </div>
          {/* 検索バー（EntryList: search input, mb-4・常時表示） */}
          <Skeleton className="mb-4 h-[42px] w-full rounded-lg" />
          {/* カード型行（EntryListSkeleton と同形: 日付行＋本文2行・gap-8 pt-6） */}
          <div className="flex flex-col gap-8 pt-6">
            {PC_ROW_KEYS.map((k) => (
              <div key={k} className="flex flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // SP（device === 'sp'）と保険の null フォールバック: 全画面・全幅の一覧スケルトン。
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6 pb-3">
        <Skeleton className="h-6 w-32" />
      </div>
      <ListSkeleton />
    </div>
  );
}
