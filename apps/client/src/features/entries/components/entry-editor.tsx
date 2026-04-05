'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorStatusBar } from '@/features/entries/components/editor-status-bar';
import { QuestionLinker } from '@/features/entries/components/question-linker';
import { useSaveEntry } from '@/features/entries/hooks/use-entry';
import type { ApiClient } from '@/lib/api';

interface AuthState {
  accessToken: string;
}

interface QuestionOption {
  id: string;
  currentText: string | null;
}

interface EntryEditorProps {
  entryId?: string;
  initialContent?: string;
  api: ApiClient | null;
  auth: AuthState | null;
  activeQuestions?: QuestionOption[];
  initialLinkedIds?: string[];
  onLinkQuestion?: (entryId: string, questionId: string) => Promise<void>;
  onUnlinkQuestion?: (entryId: string, questionId: string) => Promise<void>;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const dayName = days[date.getDay()];
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${d} — ${dayName}曜日 ${hh}:${mm} · ${hh}:${mm}`;
}

export function EntryEditor({
  entryId,
  initialContent = '',
  api,
  auth,
  activeQuestions = [],
  initialLinkedIds = [],
  onLinkQuestion,
  onUnlinkQuestion,
}: EntryEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [fontSize, setFontSize] = useState(18);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState<'editing' | 'saved' | 'saving'>('editing');
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set(initialLinkedIds));
  const [dateStr, setDateStr] = useState(() => formatDate(new Date()));
  const { save, saving, error } = useSaveEntry(api, auth);
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => setDateStr(formatDate(new Date())), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (saving) setStatus('saving');
  }, [saving]);

  const initialContentStable = initialContent;
  useEffect(() => {
    setContent(initialContentStable);
  }, [initialContentStable]);

  const prevLinkedRef = useRef(initialLinkedIds);
  if (initialLinkedIds.join(',') !== prevLinkedRef.current.join(',')) {
    prevLinkedRef.current = initialLinkedIds;
    setLinkedIds(new Set(initialLinkedIds));
  }

  const handleSave = useCallback(async () => {
    const savedId = await save(content, entryId);
    if (savedId) {
      setStatus('saved');
      // Link new questions for newly created entries
      if (!entryId && onLinkQuestion) {
        for (const qId of linkedIds) {
          await onLinkQuestion(savedId, qId);
        }
      }
      setTimeout(() => setStatus('editing'), 2000);
      if (!entryId) {
        router.push(`/entries/${savedId}`);
      }
    }
  }, [content, entryId, save, linkedIds, onLinkQuestion, router]);

  const handleLink = useCallback(
    async (questionId: string) => {
      setLinkedIds((prev) => new Set(prev).add(questionId));
      if (entryId && onLinkQuestion) {
        await onLinkQuestion(entryId, questionId);
      }
    },
    [entryId, onLinkQuestion],
  );

  const handleUnlink = useCallback(
    async (questionId: string) => {
      setLinkedIds((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
      if (entryId && onUnlinkQuestion) {
        await onUnlinkQuestion(entryId, questionId);
      }
    },
    [entryId, onUnlinkQuestion],
  );

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }

  const charCount = content.length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-zinc-950">
      {/* Top toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title="設定"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title="フルスクリーン"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
              />
            </svg>
          </button>
        </div>

        <span className="text-xs text-zinc-400">{dateStr}</span>

        <button
          type="button"
          onClick={() => router.push('/entries')}
          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          title="一覧に戻る"
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Question linker */}
      <div className="border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <QuestionLinker
          activeQuestions={activeQuestions}
          linkedQuestionIds={linkedIds}
          onLink={handleLink}
          onUnlink={handleUnlink}
        />
      </div>

      {/* Settings panel (collapsible) */}
      {settingsOpen && (
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <label htmlFor="editor-font-size" className="text-xs text-zinc-500">
              文字サイズ
            </label>
            <input
              id="editor-font-size"
              type="range"
              min={14}
              max={36}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-zinc-400">{fontSize}px</span>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Editor area */}
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          if (status === 'saved') setStatus('editing');
        }}
        placeholder="今日のことを書いてみましょう..."
        className="flex-1 resize-none bg-transparent px-6 py-6 leading-relaxed focus:outline-none"
        style={{ fontSize: `${fontSize}px` }}
      />

      {/* Bottom toolbar */}
      <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/entries/new')}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title="新規エントリ"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title="保存"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => router.push('/entries')}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title="一覧"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
              />
            </svg>
          </button>
        </div>

        <button
          type="button"
          disabled
          className="rounded-md p-1.5 text-zinc-300 dark:text-zinc-700"
          title="音声入力（準備中）"
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
            />
          </svg>
        </button>
      </div>

      {/* Status bar */}
      <EditorStatusBar status={status} charCount={charCount} />
    </div>
  );
}
