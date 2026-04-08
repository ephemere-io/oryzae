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
      {/* Float animation keyframes */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(var(--base-rotate, 0deg)); }
          50% { transform: translateY(-6px) rotate(calc(var(--base-rotate, 0deg) + 1deg)); }
        }
      `}</style>

      {/* Zoom backdrop */}
      {zoomedId && (
        <button
          type="button"
          onClick={closeZoom}
          className="absolute inset-0 z-[45] bg-[rgba(250,248,244,0.75)]"
          aria-label="ズームを閉じる"
        />
      )}

      {/* Central jar illustration — larger, matching reference */}
      <div className="absolute top-1/2 left-1/2 z-[2] -translate-x-1/2 -translate-y-[55%]">
        <svg
          aria-hidden="true"
          width="380"
          height="520"
          viewBox="0 0 200 280"
          fill="none"
          opacity="0.25"
        >
          {/* Lid */}
          <rect x="70" y="8" width="60" height="14" rx="4" fill="#c9a96e" opacity="0.4" />
          {/* Neck */}
          <path d="M75 22 L75 48 Q75 58 65 63" stroke="#c9a96e" strokeWidth="1" fill="none" />
          <path d="M125 22 L125 48 Q125 58 135 63" stroke="#c9a96e" strokeWidth="1" fill="none" />
          {/* Body */}
          <path
            d="M55 63 Q38 100 38 160 Q38 252 100 268 Q162 252 162 160 Q162 100 145 63"
            stroke="#c9a96e"
            strokeWidth="1.5"
            fill="rgba(200,180,140,0.04)"
          />
          {/* Liquid */}
          <path d="M48 140 Q48 252 100 264 Q152 252 152 140" fill="rgba(90,184,90,0.06)" />
          {/* Floating text with animation class */}
          <text x="75" y="155" fontSize="9" fill="#999" opacity="0.5">
            発酵
          </text>
          <text x="105" y="180" fontSize="7" fill="#999" opacity="0.4">
            記憶
          </text>
          <text x="85" y="210" fontSize="8" fill="#999" opacity="0.35">
            問い
          </text>
          <text x="95" y="240" fontSize="6" fill="#999" opacity="0.25">
            時間
          </text>
          <text x="110" y="160" fontSize="5" fill="#999" opacity="0.2">
            沈黙
          </text>
          <text x="70" y="195" fontSize="6" fill="#999" opacity="0.3">
            変容
          </text>
        </svg>
      </div>

      {/* Connection lines — quadratic bezier curves */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{ opacity: zoomedId ? 0 : 1, transition: 'opacity 0.5s' }}
      >
        {questions.slice(0, 3).map((q, i) => {
          const pos = CIRCLE_POSITIONS[i];
          const endX = pos.right ? 82 : pos.left ? 18 : 50;
          const endY = pos.top ? 25 : pos.bottom ? 78 : 50;
          const cpX = (50 + endX) / 2 + (i === 0 ? 10 : i === 1 ? 5 : -10);
          const cpY = (45 + endY) / 2 + (i === 0 ? -10 : i === 1 ? 10 : 0);
          return (
            <path
              key={q.id}
              d={`M 50% 45% Q ${cpX}% ${cpY}% ${endX}% ${endY}%`}
              stroke="#d97706"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.25"
              fill="none"
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
        <div className="absolute bottom-8 left-1/2 z-[10] flex -translate-x-1/2 flex-col items-center gap-1.5">
          <span
            className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--date-color)]"
            style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
          >
            現在の問い
          </span>
          {questions.slice(0, 3).map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setZoomedId(q.id)}
              className="rounded-full border-[1.5px] border-[#8b2020] bg-[#8b2020] px-5 py-1.5 text-xs text-white transition-colors hover:bg-[#6b1515]"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              {q.currentText}
            </button>
          ))}
          {questions.length < 3 && (
            <button
              type="button"
              className="mt-1 rounded-full border border-[var(--accent)] px-4 py-1 text-[11px] text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-white"
              style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
            >
              ＋ 問いを追加する
            </button>
          )}
        </div>
      )}

      {/* Detail pane */}
      <DetailPane
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
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
        <div className="flex justify-center">
          <div className="h-0.5 w-16 overflow-hidden rounded-full bg-[rgba(0,0,0,0.06)]">
            <div className="h-full w-0 rounded-full bg-[var(--accent)]" />
          </div>
        </div>
        <span style={{ fontFamily: 'Inter, sans-serif' }}>FERMENTING</span>
      </div>
    </div>
  );
}
