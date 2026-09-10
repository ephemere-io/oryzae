import { verifyAttrs } from '@oryzae/verify';
import { PageLoading } from '@/components/ui/page-loading';
import { Skeleton, skeletonKeys } from '@/components/ui/skeleton';

/**
 * PC エディタ（EntryEditor）のスケルトン。
 *
 * EntryEditor は一覧とは全く別の形（全面を占める縦4段: ツールバー / 問いリンカ /
 * 執筆エリア / ステータスバー）なので、一覧枠を流用すると読み込み後に画面が総入れ替えになる。
 * 実 DOM と同じ4段・同じ境界線・同じ padding を先に置く。
 *
 * **執筆エリアに行の枠は置かない**。本文の書字方向（縦書き/横書き）は mount 後に
 * localStorage とロケールから確定する（`DEFAULT_SETTINGS.writingMode = 'vertical'`）ため、
 * 向きを決め打ちした偽の行を描くと、確定した瞬間に必ずズレる。代わりに:
 *  - 新規（`/entries/new`）… 待つコンテンツが無く本文は実際に空なので、余白だけ確保する
 *  - 既存（`/entries/[id]`）… 本文は取得待ちだが形を予告できないので `PageLoading` を1つ出す
 */

/** ツールバーのアイコンボタン（実物: p-1.5 + h-5 w-5 の svg = 32px 角）。 */
function ToolbarIconsSkeleton({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2">
      {skeletonKeys(count).map((k) => (
        <Skeleton key={k} className="h-8 w-8 rounded-md" />
      ))}
    </div>
  );
}

/**
 * @param chips 実 DOM の問いチップは常に1つ（結ばれている問いを出す）。Issue #228 で
 *   専用行を畳んだので、この値は中央カラムに置くチップ枠の数として使う。
 * @param bodyLoading 本文の取得を待っているか（既存エントリを開くときだけ true）。
 */
export function EntryEditorSkeleton({
  chips = 1,
  bodyLoading = false,
}: {
  chips?: number;
  bodyLoading?: boolean;
}) {
  return (
    <div
      className="absolute inset-0 flex flex-col bg-[var(--bg)]"
      aria-hidden="true"
      {...verifyAttrs({
        unit: 'EntryEditorSkeleton',
        slots: 'toolbar,body,status-bar',
        chips,
        bodyLoading,
      })}
    >
      {/* ヘッダー（実物: px-4 py-2、**区切り線なし**。左=問いチップ /
          右=アクション3つ＋日付＋設定）。タイトルは本文側へ移った。 */}
      <div
        className="flex items-center justify-between gap-4 px-4 py-2"
        // 席は実物と同じだけ空ける。実物のヘッダーは「書斎へ戻る」マークの席
        // （`--study-back-inset`）を読むので、枠だけ読まないとマークがチップの枠に
        // 重なり、実物に変わった瞬間に左の並びが横へずれる。
        style={{ paddingLeft: 'max(1rem, var(--study-back-inset, 0px))' }}
        data-skeleton-slot="toolbar"
      >
        <div className="flex items-center">
          {skeletonKeys(chips).map((k) => (
            <Skeleton key={k} className="h-[22px] w-[160px] rounded-full" />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ToolbarIconsSkeleton count={3} />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      {/* 執筆エリア（実物: min-h-full px-[15%] py-6）。中身は空のまま余白だけ確保する。 */}
      <div className="relative flex-1 px-[15%] py-6" data-skeleton-slot="body">
        {bodyLoading && <PageLoading />}
      </div>

      {/* ステータスバー（実物: border-t px-4 py-1.5 text-xs、左=保存状態 / 中央=バー / 右=文字数） */}
      <div
        className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-1.5"
        data-skeleton-slot="status-bar"
      >
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-1 w-24 rounded-full" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
