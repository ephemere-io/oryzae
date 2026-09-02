/**
 * 読み込み中のプレースホルダ。
 *
 * 素の "Loading..." だと、待ち時間が数秒あるだけで固まったように見える。実際の
 * レイアウトと同じ形の箱を出しておくと、何が出てくるかが先に伝わり、描画が
 * 差し替わったときも位置が動かない。
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ''}`} />;
}
