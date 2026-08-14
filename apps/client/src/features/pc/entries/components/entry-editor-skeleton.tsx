import { verifyAttrs } from '@oryzae/verify';
import { Skeleton, skeletonKeys } from '@/components/ui/skeleton';

/**
 * PC エディタ（EntryEditor）のスケルトン。
 *
 * EntryEditor は一覧とは全く別の形（全面を占める縦4段: ツールバー / 問いリンカ /
 * 執筆エリア / ステータスバー）なので、一覧枠を流用すると読み込み後に画面が総入れ替えになる。
 * 実 DOM と同じ4段・同じ境界線・同じ padding を先に置く。
 *
 * **執筆エリアは意図的に空**にしている。本文の書字方向（縦書き/横書き）は mount 後に
 * localStorage とロケールから確定する（`DEFAULT_SETTINGS.writingMode = 'vertical'`）ため、
 * 向きを決め打ちした偽の行を描くと、確定した瞬間に必ずズレる。新規エントリでは本文が
 * 実際に空なので、余白だけを正しく確保するのが最も近い。
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
 * @param chips 問いリンカに並ぶチップ数の見込み（既存エントリは紐付いた問いのぶんだけ並ぶ）。
 *   0 でも行の高さは変わらない（実 QuestionLinker が入力欄と + ボタンを常に描くため）。
 */
export function EntryEditorSkeleton({ chips = 1 }: { chips?: number }) {
  return (
    <div
      className="absolute inset-0 flex flex-col bg-[var(--bg)]"
      aria-hidden="true"
      {...verifyAttrs({
        unit: 'EntryEditorSkeleton',
        slots: 'toolbar,question-linker,body,status-bar',
        chips,
      })}
    >
      {/* ツールバー（実物: border-b px-4 py-2、左5アイコン / 中央 日付+タイトル / 右5アイコン） */}
      <div
        className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-2"
        data-skeleton-slot="toolbar"
      >
        <ToolbarIconsSkeleton count={5} />
        <div className="flex min-w-0 flex-col items-center gap-0.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-40" />
        </div>
        <ToolbarIconsSkeleton count={5} />
      </div>

      {/* 問いリンカ行（実物: border-b px-4 py-2 / 検索入力 w-44 ＋ + ボタン h-6 w-6 ＋ チップ） */}
      <div
        className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-2"
        data-skeleton-slot="question-linker"
      >
        <Skeleton className="h-[26px] w-44 shrink-0 rounded-full" />
        <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
        {skeletonKeys(chips).map((k) => (
          <Skeleton key={k} className="h-5 w-[120px] shrink-0 rounded-full" />
        ))}
      </div>

      {/* 執筆エリア（実物: min-h-full px-[15%] py-6）。中身は空のまま余白だけ確保する。 */}
      <div className="flex-1 px-[15%] py-6" data-skeleton-slot="body" />

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
