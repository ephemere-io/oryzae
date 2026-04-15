'use client';

import { useRouter } from 'next/navigation';

interface DetailPaneProps {
  open: boolean;
  onClose: () => void;
  questionId: string;
  questionText: string;
  type: 'keyword' | 'snippet' | 'letter' | null;
  data: {
    keyword?: string;
    description?: string;
    originalText?: string;
    sourceDate?: string;
    selectionReason?: string;
    bodyText?: string;
  } | null;
}

const HEADERS: Record<string, string> = {
  keyword: 'Yeast が生成したキーワード',
  snippet: 'Oryzae が切り取った文章',
  letter: 'Lab からの手紙',
};

export function DetailPane({
  open,
  onClose,
  questionId,
  questionText,
  type,
  data,
}: DetailPaneProps) {
  const router = useRouter();

  function handleWriteEntry() {
    router.push(`/entries/new?questionId=${questionId}`);
  }

  return (
    <div
      className="fixed top-0 z-[60] flex h-full w-[400px] flex-col border-l border-[rgba(139,115,85,0.2)] bg-[#faf8f5] transition-[right] duration-700"
      style={{
        right: open ? 0 : -400,
        backdropFilter: 'blur(12px)',
        fontFamily: "'Noto Serif JP', serif",
      }}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-lg text-[#6b5c4a] hover:bg-[rgba(139,115,85,0.1)]"
      >
        ×
      </button>

      {/* Question */}
      <div className="shrink-0 px-8 pt-8 pb-3 text-sm font-medium text-[#4a3f35]">
        {questionText}
      </div>

      {/* Header */}
      <div className="shrink-0 border-b border-[rgba(139,115,85,0.1)] px-8 pb-5 text-[22px] font-medium text-[#4a3f35]">
        {type ? HEADERS[type] : ''}
      </div>

      {/* Body — scrollable */}
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6 text-sm leading-[2.0] text-[#4a3f35]">
        {type === 'keyword' && data && (
          <>
            <h3 className="mb-3 text-lg font-medium text-[var(--accent)]">{data.keyword}</h3>
            <p>{data.description}</p>
          </>
        )}
        {type === 'snippet' && data && (
          <>
            <blockquote className="mb-4 text-base font-medium leading-relaxed">
              「{data.originalText}」
            </blockquote>
            <p className="mb-4 text-xs text-[var(--date-color)]">出典: {data.sourceDate}</p>
            <p>{data.selectionReason}</p>
          </>
        )}
        {type === 'letter' && data && <div className="whitespace-pre-wrap">{data.bodyText}</div>}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[rgba(139,115,85,0.1)] px-8 py-6">
        <button
          type="button"
          onClick={handleWriteEntry}
          className="w-full rounded-lg border border-[var(--accent)] px-4 py-3 text-sm text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-white"
        >
          この問いのエントリを書く
        </button>
      </div>
    </div>
  );
}
