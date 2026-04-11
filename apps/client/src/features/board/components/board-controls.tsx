'use client';

interface BoardControlsProps {
  viewType: 'daily' | 'weekly';
  onViewTypeChange: (viewType: 'daily' | 'weekly') => void;
  onAddSnippet: () => void;
  onAddPhoto: () => void;
}

const btnBase =
  'rounded-full px-3 py-1 text-[9px] font-medium uppercase tracking-[0.15em] transition-colors';

export function BoardControls({
  viewType,
  onViewTypeChange,
  onAddSnippet,
  onAddPhoto,
}: BoardControlsProps) {
  return (
    <div
      className="absolute right-6 top-5 z-10 flex items-center gap-2"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      <button
        type="button"
        onClick={() => onViewTypeChange('daily')}
        className={btnBase}
        style={
          viewType === 'daily'
            ? { backgroundColor: 'var(--accent)', color: '#fff' }
            : {
                border: '1px solid var(--border-subtle)',
                color: 'var(--date-color)',
                backgroundColor: 'transparent',
              }
        }
      >
        Daily
      </button>
      <button
        type="button"
        onClick={() => onViewTypeChange('weekly')}
        className={btnBase}
        style={
          viewType === 'weekly'
            ? { backgroundColor: 'var(--accent)', color: '#fff' }
            : {
                border: '1px solid var(--border-subtle)',
                color: 'var(--date-color)',
                backgroundColor: 'transparent',
              }
        }
      >
        Weekly
      </button>
      <button
        type="button"
        onClick={onAddSnippet}
        className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[9px] font-medium uppercase tracking-[0.15em] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        style={{
          borderColor: 'var(--border-subtle)',
          color: 'var(--date-color)',
        }}
      >
        ✦ Snippet
      </button>
      <button
        type="button"
        onClick={onAddPhoto}
        className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[9px] font-medium uppercase tracking-[0.15em] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        style={{
          borderColor: 'var(--border-subtle)',
          color: 'var(--date-color)',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ verticalAlign: '-2px' }}
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        Photo
      </button>
    </div>
  );
}
