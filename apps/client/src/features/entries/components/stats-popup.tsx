'use client';

interface StatsPopupProps {
  open: boolean;
  charCount: number;
  content: string;
  onClose: () => void;
}

function countLines(text: string): number {
  if (!text) return 0;
  return text.split('\n').filter((l) => l.trim().length > 0).length;
}

function estimateReadingTime(charCount: number): string {
  // Average Japanese reading speed: ~400-600 chars/min
  const minutes = charCount / 500;
  if (minutes < 1) return '1分未満';
  return `約${Math.ceil(minutes)}分`;
}

export function StatsPopup({ open, charCount, content, onClose }: StatsPopupProps) {
  if (!open) return null;

  const lines = countLines(content);
  const readingTime = estimateReadingTime(charCount);

  return (
    <div
      className="absolute bottom-12 right-4 z-[100] rounded-lg shadow-lg"
      style={{
        backgroundColor: 'var(--bg)',
        border: '1px solid var(--border-subtle)',
        padding: '16px 20px',
        minWidth: 200,
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-semibold" style={{ color: 'var(--fg)' }}>
          執筆統計
        </h4>
        <button
          type="button"
          onClick={onClose}
          className="text-xs"
          style={{ color: 'var(--date-color)' }}
        >
          ✕
        </button>
      </div>
      <div className="space-y-2 text-xs" style={{ color: 'var(--date-color)' }}>
        <div className="flex justify-between">
          <span>文字数</span>
          <span style={{ color: 'var(--fg)' }}>{charCount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>行数</span>
          <span style={{ color: 'var(--fg)' }}>{lines}</span>
        </div>
        <div className="flex justify-between">
          <span>読了時間</span>
          <span style={{ color: 'var(--fg)' }}>{readingTime}</span>
        </div>
      </div>
    </div>
  );
}
