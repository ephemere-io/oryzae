import { ShellSkeleton } from '@/components/ui/shell-skeleton';

/**
 * 保護ルート共通の遷移ローディング（Issue #362/#363）。
 *
 * App Router は遷移先セグメントの RSC 取得が終わるまで、`loading.tsx` が無いと
 * **古い画面を出したまま固まる**（メニューを押しても“切り替え直後に何も起きない”の正体）。
 * このフォールバックを置くと、クリック直後に Suspense フォールバックとして即描画され、
 * 待っていることが見える。レイアウト（サイドバー / ボトムナビ）は維持され、本コンポーネントは
 * `<main>` 内のコンテンツ領域にだけ出る。
 *
 * マウント後のクライアント側データ取得待ちでも各画面が同じ {@link ShellSkeleton} を出すため、
 * 「遷移待ち → マウント → データ待ち → 中身」が連続した1枚の枠で繋がる（二重フラッシュ防止）。
 */
export default function ProtectedLoading() {
  return <ShellSkeleton />;
}
