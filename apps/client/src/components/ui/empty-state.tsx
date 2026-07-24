/**
 * 汎用 empty ステート（Issue #357）。データが 0 件のときに表示する共通コンポーネント。
 * 文言は呼び出し側が i18n で解決して渡す（components/ui は feature/i18n 非依存）。
 */
export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div data-testid="empty-state" className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-sm text-[var(--date-color)]">{message}</p>
      {action}
    </div>
  );
}
