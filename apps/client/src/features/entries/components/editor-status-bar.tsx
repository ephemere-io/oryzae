'use client';

interface EditorStatusBarProps {
  status: 'editing' | 'saved' | 'saving';
  charCount: number;
}

export function EditorStatusBar({ status, charCount }: EditorStatusBarProps) {
  const statusLabel = {
    editing: 'EDITING',
    saved: 'SAVED',
    saving: 'SAVING...',
  }[status];

  return (
    <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-1.5 text-xs text-zinc-400 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            status === 'saved'
              ? 'bg-emerald-500'
              : status === 'saving'
                ? 'bg-amber-500'
                : 'bg-zinc-400'
          }`}
        />
        <span>{statusLabel}</span>
      </div>
      <div className="flex justify-center">
        <div className="h-1 w-24 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className="h-full rounded-full bg-zinc-400 transition-all duration-300"
            style={{ width: `${Math.min(100, (charCount / 2000) * 100)}%` }}
          />
        </div>
      </div>
      <span>{charCount} CHARS</span>
    </div>
  );
}
