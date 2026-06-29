import { Skeleton } from './skeleton';

// 静的な枠なので並び替わらない。index key を避けるため固定キーを使う。
const ROW_KEYS = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'];

/**
 * 一覧系画面のローディング表示（Issue #363）。データ取得中に「空白」ではなく行の枠を出し、
 * 空白→ポップのカタつき（体感のガタガタ）を防ぐ。`ul/li` は使わない（一覧本体の DOM 契約と
 * 区別するため・div で組む）。feature 非依存の純粋な見た目コンポーネント。
 */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex-1 overflow-hidden px-5" aria-hidden="true">
      {ROW_KEYS.slice(0, rows).map((k) => (
        <div key={k} className="border-b border-[color-mix(in_srgb,var(--fg)_6%,transparent)] py-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/4" />
        </div>
      ))}
    </div>
  );
}
