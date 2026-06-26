/**
 * 汎用スケルトン（Issue #362）。
 * データ取得待ちの間「空白」ではなく枠を即描画し、体感ロード時間を縮める。
 * feature 非依存の純粋な見た目コンポーネント。
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-[var(--border-subtle)] ${className}`}
    />
  );
}
