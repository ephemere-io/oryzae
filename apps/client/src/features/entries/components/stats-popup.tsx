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
  const minutes = charCount / 500;
  if (minutes < 1) return '1分未満';
  return `約${Math.ceil(minutes)}分`;
}

function countParagraphs(text: string): number {
  if (!text) return 0;
  return text.split('\n\n').filter((p) => p.trim().length > 0).length;
}

interface StatCardProps {
  label: string;
  value: string | number;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div
      className="rounded-lg"
      style={{
        backgroundColor: 'var(--toolbar-hover)',
        border: '1px solid var(--border-subtle)',
        padding: '14px 16px',
      }}
    >
      <div className="mb-1.5 text-xs" style={{ color: 'var(--date-color)' }}>
        {label}
      </div>
      <div className="text-[22px] font-semibold" style={{ color: 'var(--fg)' }}>
        {value}
      </div>
    </div>
  );
}

export function StatsPopup({ open, charCount, content, onClose }: StatsPopupProps) {
  if (!open) return null;

  const lines = countLines(content);
  const paragraphs = countParagraphs(content);
  const readingTime = estimateReadingTime(charCount);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[300]"
        style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
        role="presentation"
      />
      {/* Dialog */}
      <div
        role="dialog"
        aria-label="執筆統計"
        className="fixed z-[301] w-[90%] max-w-[520px] overflow-y-auto rounded-xl shadow-lg"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'var(--bg)',
          padding: '28px 32px',
          maxHeight: '80vh',
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
            執筆統計
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-sm transition-colors hover:bg-[var(--toolbar-hover)]"
            style={{ color: 'var(--date-color)' }}
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="文字数" value={charCount.toLocaleString()} />
          <StatCard label="行数" value={lines} />
          <StatCard label="段落数" value={paragraphs} />
          <StatCard label="読了時間" value={readingTime} />
        </div>
      </div>
    </>
  );
}
