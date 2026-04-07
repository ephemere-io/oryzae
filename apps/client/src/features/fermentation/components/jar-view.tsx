'use client';

import { useState } from 'react';
import { DetailPane } from '@/features/fermentation/components/detail-pane';
import { QuestionCircle } from '@/features/fermentation/components/question-circle';
import { useFermentationForQuestion } from '@/features/fermentation/hooks/use-fermentation-results';
import type { ApiClient } from '@/lib/api';

interface QuestionData {
  id: string;
  currentText: string | null;
}

interface JarViewProps {
  api: ApiClient | null;
  authLoading: boolean;
  questions: QuestionData[];
}

const CIRCLE_POSITIONS = [
  { top: '10%', right: '5%' },
  { bottom: '15%', right: '10%' },
  { top: '30%', left: '5%' },
];

function QuestionCircleWithData({
  question,
  api,
  position,
  zoomedId,
  onZoom,
  onElementClick,
}: {
  question: QuestionData;
  api: ApiClient | null;
  position: React.CSSProperties;
  zoomedId: string | null;
  onZoom: (id: string | null) => void;
  onElementClick: (
    questionText: string,
    type: 'keyword' | 'snippet' | 'letter',
    data: Record<string, string>,
  ) => void;
}) {
  const { detail } = useFermentationForQuestion(api, question.id);
  const isZoomed = zoomedId === question.id;
  const isHidden = zoomedId !== null && !isZoomed;

  return (
    <div
      className={`transition-opacity duration-500 ${isHidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      <QuestionCircle
        questionText={question.currentText ?? ''}
        detail={detail}
        zoomed={isZoomed}
        onClick={() => onZoom(question.id)}
        onElementClick={(type, data) => onElementClick(question.currentText ?? '', type, data)}
        style={isZoomed ? {} : position}
      />
    </div>
  );
}

export function JarView({ api, authLoading, questions }: JarViewProps) {
  const [zoomedId, setZoomedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState<'keyword' | 'snippet' | 'letter' | null>(null);
  const [detailData, setDetailData] = useState<Record<string, string> | null>(null);
  const [detailQuestion, setDetailQuestion] = useState('');

  function handleElementClick(
    questionText: string,
    type: 'keyword' | 'snippet' | 'letter',
    data: Record<string, string>,
  ) {
    setDetailQuestion(questionText);
    setDetailType(type);
    setDetailData(data);
    setDetailOpen(true);
  }

  function closeDetail() {
    setDetailOpen(false);
  }

  function closeZoom() {
    setDetailOpen(false);
    setZoomedId(null);
  }

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--date-color)]">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Zoom backdrop */}
      {zoomedId && (
        <button
          type="button"
          onClick={closeZoom}
          className="absolute inset-0 z-[45] bg-[var(--bg)] opacity-75"
          aria-label="ズームを閉じる"
        />
      )}

      {/* Central jar illustration (simplified CSS version) */}
      <div className="absolute top-1/2 left-1/2 z-[2] -translate-x-1/2 -translate-y-[55%]">
        <svg
          aria-hidden="true"
          width="200"
          height="280"
          viewBox="0 0 200 280"
          fill="none"
          opacity="0.3"
        >
          {/* Lid */}
          <rect x="70" y="10" width="60" height="15" rx="4" fill="#c9a96e" opacity="0.4" />
          {/* Neck */}
          <path
            d="M75 25 L75 50 Q75 60 65 65 L65 65"
            stroke="#c9a96e"
            strokeWidth="1"
            fill="none"
          />
          <path
            d="M125 25 L125 50 Q125 60 135 65 L135 65"
            stroke="#c9a96e"
            strokeWidth="1"
            fill="none"
          />
          {/* Body */}
          <path
            d="M55 65 Q40 100 40 160 Q40 250 100 265 Q160 250 160 160 Q160 100 145 65"
            stroke="#c9a96e"
            strokeWidth="1.5"
            fill="rgba(200,180,140,0.05)"
          />
          {/* Liquid */}
          <path d="M50 140 Q50 250 100 260 Q150 250 150 140" fill="rgba(90,184,90,0.08)" />
          {/* Floating text */}
          <text x="80" y="160" fontSize="8" fill="#999" opacity="0.5">
            発酵
          </text>
          <text x="100" y="190" fontSize="6" fill="#999" opacity="0.4">
            記憶
          </text>
          <text x="90" y="220" fontSize="7" fill="#999" opacity="0.3">
            問い
          </text>
        </svg>
      </div>

      {/* Connection lines */}
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]">
        {questions.slice(0, 3).map((q, i) => {
          const pos = CIRCLE_POSITIONS[i];
          const cx = pos.right ? '85%' : pos.left ? '15%' : '50%';
          const cy = pos.top ?? pos.bottom ?? '50%';
          return (
            <line
              key={q.id}
              x1="50%"
              y1="45%"
              x2={cx}
              y2={cy}
              stroke="#d97706"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.2"
            />
          );
        })}
      </svg>

      {/* Question circles */}
      {questions.slice(0, 3).map((q, i) => (
        <QuestionCircleWithData
          key={q.id}
          question={q}
          api={api}
          position={CIRCLE_POSITIONS[i]}
          zoomedId={zoomedId}
          onZoom={setZoomedId}
          onElementClick={handleElementClick}
        />
      ))}

      {/* Question list (bottom center) */}
      {!zoomedId && (
        <div className="absolute bottom-6 left-1/2 z-[10] flex -translate-x-1/2 flex-col items-center gap-1">
          <span
            className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--date-color)]"
            style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
          >
            現在の問い
          </span>
          {questions.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setZoomedId(q.id)}
              className="rounded-full border border-[#8b2020] bg-[#8b2020] px-4 py-1.5 text-xs text-white transition-colors hover:bg-[#6b1515]"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              {q.currentText}
            </button>
          ))}
        </div>
      )}

      {/* Detail pane */}
      <DetailPane
        open={detailOpen}
        onClose={closeDetail}
        questionText={detailQuestion}
        type={detailType}
        data={detailData}
      />

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg)] px-4 py-1.5 text-xs text-[var(--date-color)]">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--date-color)] opacity-30" />
          <span style={{ fontFamily: 'Inter, sans-serif' }}>FERMENTING</span>
        </div>
        <span style={{ fontFamily: 'Inter, sans-serif' }}>FERMENTING</span>
      </div>
    </div>
  );
}
