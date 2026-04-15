'use client';

import { useState } from 'react';

interface QuestionOption {
  id: string;
  currentText: string | null;
}

interface QuestionLinkerProps {
  activeQuestions: QuestionOption[];
  linkedQuestionIds: Set<string>;
  onLink: (questionId: string) => void;
  onUnlink: (questionId: string) => void;
}

export function QuestionLinker({
  activeQuestions,
  linkedQuestionIds,
  onLink,
  onUnlink,
}: QuestionLinkerProps) {
  const [selected, setSelected] = useState('');

  const available = activeQuestions.filter((q) => !linkedQuestionIds.has(q.id));
  const linked = activeQuestions.filter((q) => linkedQuestionIds.has(q.id));

  function handleLink() {
    if (!selected) return;
    onLink(selected);
    setSelected('');
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      <div className="flex shrink-0 items-center gap-1.5">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-44 rounded-full border border-zinc-300 bg-transparent px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700"
        >
          <option value="">問いを紐づける…</option>
          {available.map((q) => (
            <option key={q.id} value={q.id}>
              {q.currentText}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleLink}
          disabled={!selected}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 text-xs text-emerald-500 hover:bg-emerald-50 disabled:opacity-30 dark:hover:bg-emerald-950"
        >
          +
        </button>
      </div>

      {linked.length > 0 && (
        <div className="flex min-w-0 items-center gap-1">
          {linked.map((q) => (
            <span
              key={q.id}
              className="inline-flex max-w-[140px] shrink-0 items-center gap-0.5 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              <span className="truncate">{q.currentText}</span>
              <button
                type="button"
                onClick={() => onUnlink(q.id)}
                className="ml-0.5 shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
