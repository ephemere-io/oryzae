/**
 * 汎用 error ステート（Issue #357）。データ取得失敗時に表示する共通コンポーネント。
 * onRetry を渡すと再試行ボタンを出す。文言は呼び出し側が i18n で解決して渡す。
 */
export function ErrorState({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div data-testid="error-state" className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-sm text-[var(--accent)]">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-[var(--border-subtle)] px-5 py-1.5 text-sm text-[var(--date-color)] transition-colors hover:bg-[var(--hover-wash)]"
        >
          {retryLabel ?? 'Retry'}
        </button>
      )}
    </div>
  );
}
