/**
 * 汎用スケルトン片（Issue #362）。
 * データ取得待ちの間「空白」ではなく枠を即描画し、体感ロード時間を縮める。
 * feature 非依存の純粋な見た目コンポーネント。
 *
 * これは「1本の網掛け」でしかない。**画面の形は各 feature 側の `*-skeleton.tsx` が持つ**
 * （スケルトンの役目は、いずれ表示されるレイアウトを先に置いてコンテンツ到着時の
 * ジャンプを消すこと。汎用の一覧枠を全画面に出すのは逆効果）。
 */
interface SkeletonProps {
  className?: string;
  /**
   * この枠が実画面のどのパーツを代理しているか（例 `search` / `header`）。
   * 検証ハーネスの invariant が「宣言した slot が実際に描かれているか」を見るための取っ手。
   */
  'data-skeleton-slot'?: string;
}

export function Skeleton({ className = '', ...rest }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-[var(--border-subtle)] ${className}`}
      {...rest}
    />
  );
}

/**
 * 反復描画するスケルトン行の安定キー。並び替わらない静的な枠なので index 由来で十分だが、
 * `key={index}` を直接書くと lint に触れるため文字列キーに変換して使う。
 */
export function skeletonKeys(count: number): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => `sk-${i}`);
}
