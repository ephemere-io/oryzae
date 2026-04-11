'use client';

interface BoardControlsProps {
  onAddSnippet: () => void;
}

export function BoardControls({ onAddSnippet }: BoardControlsProps) {
  return (
    <div
      className="absolute right-6 top-5 z-10 flex items-center gap-2"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      <span
        className="rounded px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider"
        style={{
          backgroundColor: 'var(--accent)',
          color: '#fff',
        }}
      >
        Daily
      </span>
      <button
        type="button"
        onClick={onAddSnippet}
        className="flex items-center gap-1.5 rounded border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors hover:bg-[var(--toolbar-hover)]"
        style={{
          borderColor: 'var(--border-subtle)',
          color: 'var(--date-color)',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        ✦ Snippet
      </button>
    </div>
  );
}
