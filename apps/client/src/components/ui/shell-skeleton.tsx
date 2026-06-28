import { Skeleton } from '@/components/ui/skeleton';

/**
 * 画面共通の汎用スケルトン（Issue #362/#363）。
 *
 * 「データ取得待ちの間、空白ではなく枠を即描画する」ための最小の見た目。ヘッダ風の1本＋
 * カード数枚で、一覧/エディタ/瓶 どの画面でも破綻しない中立的な形にしている。
 *
 * 重要（二重フラッシュ防止）: 画面遷移時の待ちには2つの窓がある——
 *   (1) 遷移先 RSC の取得待ち（`(protected)/loading.tsx` の Suspense フォールバック）
 *   (2) マウント後のクライアント側データ取得待ち（各画面の `loading` 分岐）
 * この2つで**同一の**スケルトンを描くことで、遷移→マウント→データ完了 が
 * 「枠（連続）→中身」の1回の切り替えに収まる。別々のスケルトンを使うと
 * 「枠A→枠B→中身」と2回チラついて逆に体感が悪化するため、必ず本コンポーネントに揃える。
 */
export function ShellSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-4 px-5 pt-8">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
