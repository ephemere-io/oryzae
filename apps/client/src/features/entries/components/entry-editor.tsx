'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type EditorStatus,
  EditorStatusBar,
} from '@/features/entries/components/editor-status-bar';
import { QuestionLinker } from '@/features/entries/components/question-linker';
import { SaveTitleModal } from '@/features/entries/components/save-title-modal';
import {
  DEFAULT_SETTINGS,
  type EditorSettings,
  SettingsDrawer,
} from '@/features/entries/components/settings-drawer';
import { SnippetToolbar } from '@/features/entries/components/snippet-toolbar';
import { StatsPopup } from '@/features/entries/components/stats-popup';
import { UnsavedChangesModal } from '@/features/entries/components/unsaved-changes-modal';
import { useAmpEffect } from '@/features/entries/hooks/use-amp-effect';
import { useAutosaveEntry } from '@/features/entries/hooks/use-autosave-entry';
import { useSaveEntry } from '@/features/entries/hooks/use-entry';
import { useEraserTrace } from '@/features/entries/hooks/use-eraser-trace';
import { useGhostEffect } from '@/features/entries/hooks/use-ghost-effect';
import { usePressureBleed } from '@/features/entries/hooks/use-pressure-bleed';
import { useTimeInscription } from '@/features/entries/hooks/use-time-inscription';
import { useVoiceDynamics } from '@/features/entries/hooks/use-voice-dynamics';
import type { ApiClient } from '@/lib/api';
import { SIDEBAR_WIDTH } from '@/lib/sidebar-context';

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
  initialTitle?: string;
  createdAt?: string;
  updatedAt?: string;
  api: ApiClient | null;
  auth: AuthState | null;
  activeQuestions?: QuestionOption[];
  initialLinkedIds?: string[];
  onLinkQuestion?: (entryId: string, questionId: string) => Promise<void>;
  onUnlinkQuestion?: (entryId: string, questionId: string) => Promise<void>;
  onSaveComplete?: (entryId: string, content: string) => void;
  onSaveTransition?: (text: string, editorEl: HTMLElement) => Promise<void>;
}

function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatDateStr(created: Date, updated: Date): string {
  const y = created.getFullYear();
  const m = created.getMonth() + 1;
  const d = created.getDate();
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const dayName = days[created.getDay()];
  return `${y}.${m}.${d} — ${dayName}曜日 ${formatTime(created)} · ${formatTime(updated)}`;
}

/** Extract title (first line) and body from stored content */
function splitTitleBody(raw: string): { title: string; body: string } {
  const idx = raw.indexOf('\n');
  if (idx === -1) return { title: '', body: raw };
  return { title: raw.substring(0, idx), body: raw.substring(idx + 1) };
}

export function EntryEditor({
  entryId,
  initialContent = '',
  initialTitle,
  createdAt: createdAtIso,
  updatedAt: updatedAtIso,
  api,
  auth,
  activeQuestions = [],
  initialLinkedIds = [],
  onLinkQuestion,
  onUnlinkQuestion,
  onSaveComplete,
  onSaveTransition,
}: EntryEditorProps) {
  // For existing entries, split first line as title
  const parsed = entryId ? splitTitleBody(initialContent) : { title: '', body: initialContent };
  const [title, setTitle] = useState(initialTitle ?? parsed.title);
  const [content, setContent] = useState(entryId ? parsed.body : initialContent);
  const [savedContent, setSavedContent] = useState(entryId ? parsed.body : initialContent);
  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalMode, setSaveModalMode] = useState<'save' | 'pickle'>('save');
  const [titleEditModalOpen, setTitleEditModalOpen] = useState(false);
  const [currentEntryId, setCurrentEntryId] = useState<string | undefined>(entryId);
  const [statsOpen, setStatsOpen] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(false);

  function updateSettings(patch: Partial<EditorSettings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }
  const [status, setStatus] = useState<EditorStatus>('editing');
  const isAutosavingRef = useRef(false);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set(initialLinkedIds));
  const [dateStr, setDateStr] = useState(() => {
    const now = new Date();
    const created = createdAtIso ? new Date(createdAtIso) : now;
    const updated = updatedAtIso ? new Date(updatedAtIso) : now;
    return formatDateStr(created, updated);
  });
  const { save, saving, error } = useSaveEntry(api, auth);
  const router = useRouter();
  const sidebarWidth = SIDEBAR_WIDTH;
  const editorRef = useRef<HTMLDivElement>(null);
  const ghostLayerRef = useRef<HTMLDivElement>(null);
  const traceCanvasRef = useRef<HTMLCanvasElement>(null);

  const hasUnsavedChanges = content !== savedContent;

  useGhostEffect(editorRef, ghostLayerRef, settings);
  useAmpEffect(settings.ampEnabled);
  useTimeInscription(editorRef, settings);
  useEraserTrace(editorRef, traceCanvasRef, settings.eraserTraceEnabled, settings.fontSize);
  usePressureBleed(
    editorRef,
    settings.timeInscriptionEnabled && settings.timeInscriptionMode === 'pressureBleed',
  );
  useVoiceDynamics(editorRef, voiceActive);

  useEffect(() => {
    // For new entries (no createdAt), update the clock every minute
    if (!createdAtIso) {
      const timer = setInterval(() => {
        const now = new Date();
        setDateStr(formatDateStr(now, now));
      }, 60_000);
      return () => clearInterval(timer);
    }
  }, [createdAtIso]);

  useEffect(() => {
    if (saving) setStatus(isAutosavingRef.current ? 'autosaving' : 'saving');
  }, [saving]);

  // Track scroll position of editor to show/hide fade overlays
  useEffect(() => {
    const el = editorRef.current;
    if (!el || settings.writingMode !== 'vertical') {
      setFadeLeft(false);
      setFadeRight(false);
      return;
    }
    function updateFade() {
      if (!el) return;
      const { scrollLeft, scrollWidth, clientWidth } = el;
      // vertical-rl: scrollLeft is 0 at start (rightmost), negative when scrolled left
      const maxScroll = scrollWidth - clientWidth;
      // vertical-rl: scrollLeft=0 at start (rightmost/beginning), goes negative when scrolled left
      // Right fade (beginning clipped): show when scrolled away from start
      setFadeRight(Math.abs(scrollLeft) > 5);
      // Left fade (end clipped): show when not scrolled all the way to the left
      setFadeLeft(maxScroll > 5 && Math.abs(scrollLeft) < maxScroll - 5);
    }
    updateFade();
    el.addEventListener('scroll', updateFade);
    // Also update on content change via ResizeObserver
    const ro = new ResizeObserver(updateFade);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateFade);
      ro.disconnect();
    };
  }, [settings.writingMode]);

  // Warn before browser close with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  const initialContentStable = initialContent;
  useEffect(() => {
    if (entryId) {
      const p = splitTitleBody(initialContentStable);
      setTitle(p.title);
      setContent(p.body);
      setSavedContent(p.body);
      if (editorRef.current && p.body) {
        editorRef.current.textContent = p.body;
      }
    } else {
      setContent(initialContentStable);
      setSavedContent(initialContentStable);
      if (editorRef.current && initialContentStable) {
        editorRef.current.textContent = initialContentStable;
      }
    }
  }, [initialContentStable, entryId]);

  const prevLinkedRef = useRef(initialLinkedIds);
  if (initialLinkedIds.join(',') !== prevLinkedRef.current.join(',')) {
    prevLinkedRef.current = initialLinkedIds;
    setLinkedIds(new Set(initialLinkedIds));
  }

  const handleSaveWithTitle = useCallback(
    async (newTitle: string, options: { fermentationEnabled?: boolean } = {}) => {
      // Combine title + body into content for storage
      const finalContent = newTitle.trim() ? `${newTitle.trim()}\n${content}` : content;
      const targetId = currentEntryId ?? entryId;
      const isNew = !targetId;

      const savedId = await save(
        finalContent,
        targetId,
        options.fermentationEnabled !== undefined
          ? { fermentationEnabled: options.fermentationEnabled }
          : undefined,
      );
      if (savedId) {
        setTitle(newTitle.trim());
        setSavedContent(content);
        setCurrentEntryId(savedId);
        setSaveModalOpen(false);
        setTitleEditModalOpen(false);
        setStatus('saved');
        const created = createdAtIso ? new Date(createdAtIso) : new Date();
        setDateStr(formatDateStr(created, new Date()));
        if (isNew && onLinkQuestion) {
          for (const qId of linkedIds) {
            await onLinkQuestion(savedId, qId);
          }
        }
        setTimeout(() => setStatus('editing'), 2000);
        onSaveComplete?.(savedId, finalContent);
        if (
          options.fermentationEnabled &&
          onSaveTransition &&
          editorRef.current &&
          finalContent.trim()
        ) {
          await onSaveTransition(finalContent, editorRef.current);
        } else if (isNew) {
          router.push(`/entries/${savedId}`);
        }
      }
    },
    [
      content,
      currentEntryId,
      entryId,
      save,
      linkedIds,
      onLinkQuestion,
      router,
      onSaveComplete,
      onSaveTransition,
      createdAtIso,
    ],
  );

  const handleSaveClick = useCallback(() => {
    if (!content.trim()) return;
    setSaveModalMode('save');
    setSaveModalOpen(true);
  }, [content]);

  const handlePickleClick = useCallback(() => {
    if (!content.trim()) return;
    setSaveModalMode('pickle');
    setSaveModalOpen(true);
  }, [content]);

  const handleAutosaved = useCallback(
    (newId: string, savedBody: string) => {
      // Track the id locally so subsequent autosaves PUT instead of POST.
      // URL stays the same — the 新規エントリ button and browser refresh
      // continue to behave as if the user is still composing.
      if (currentEntryId !== newId) setCurrentEntryId(newId);
      setSavedContent(savedBody);
      setStatus('saved');
      isAutosavingRef.current = false;
      setTimeout(() => setStatus('editing'), 2000);
    },
    [currentEntryId],
  );

  const autoSave = useCallback(
    (contentToSave: string, id?: string) => {
      isAutosavingRef.current = true;
      return save(contentToSave, id);
    },
    [save],
  );

  useAutosaveEntry({
    title,
    body: content,
    entryId: currentEntryId,
    enabled: !!api,
    save: autoSave,
    onSaved: handleAutosaved,
  });

  /** Navigate with unsaved-changes guard */
  const guardedNavigate = useCallback(
    (path: string) => {
      if (hasUnsavedChanges) {
        setPendingNavPath(path);
      } else {
        router.push(path);
      }
    },
    [hasUnsavedChanges, router],
  );

  const handleUnsavedSave = useCallback(() => {
    setSaveModalMode('save');
    setSaveModalOpen(true);
  }, []);

  const handleUnsavedDiscard = useCallback(() => {
    const path = pendingNavPath;
    setPendingNavPath(null);
    if (path) router.push(path);
  }, [pendingNavPath, router]);

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
    <div
      className="fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-[var(--bg)] transition-[left] duration-200 ease-linear"
      style={{ left: sidebarWidth }}
    >
      {/* Top toolbar */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="rounded-md p-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]"
            data-tooltip="設定"
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
            className="rounded-md p-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]"
            data-tooltip="フルスクリーン"
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

        {/* Date display — always show date in toolbar */}
        <span className="text-xs text-zinc-400">{dateStr}</span>

        <div className="flex items-center gap-2">
          {/* Writing direction toggle */}
          <button
            type="button"
            onClick={() =>
              updateSettings({
                writingMode: settings.writingMode === 'vertical' ? 'horizontal' : 'vertical',
              })
            }
            className="rounded-md p-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]"
            data-tooltip={settings.writingMode === 'vertical' ? '横書きに切替' : '縦書きに切替'}
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
          {/* Font toggle */}
          <button
            type="button"
            onClick={() =>
              updateSettings({
                fontFamily: settings.fontFamily === 'serif' ? 'sans' : 'serif',
              })
            }
            className="rounded-md p-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]"
            data-tooltip={settings.fontFamily === 'serif' ? 'ゴシックに切替' : '明朝に切替'}
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="currentColor"
              stroke="none"
              viewBox="0 0 24 24"
            >
              <text
                x="12"
                y="17"
                textAnchor="middle"
                fontSize="16"
                fontWeight="600"
                fontFamily="serif"
              >
                T
              </text>
            </svg>
          </button>
        </div>
      </div>

      {/* Question linker */}
      <div className="border-b border-[var(--border-subtle)] px-4 py-2">
        <QuestionLinker
          activeQuestions={activeQuestions}
          linkedQuestionIds={linkedIds}
          onLink={handleLink}
          onUnlink={handleUnlink}
        />
      </div>

      {/* Settings drawer */}
      <SettingsDrawer
        open={settingsOpen}
        settings={settings}
        onChange={updateSettings}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Error display */}
      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Ghost layer — must be above editor (z-50) */}
      <div
        ref={ghostLayerRef}
        className="pointer-events-none fixed top-0 right-0 bottom-0 z-[51] overflow-hidden transition-[left] duration-200 ease-linear"
        style={{ left: sidebarWidth }}
      />

      {/* Editor area — outer wrapper (no overflow) holds fade overlays; inner div scrolls */}
      <div className="relative flex-1">
        {/* Fade overlays for vertical mode — appear only when content is clipped */}
        {settings.writingMode === 'vertical' && fadeLeft && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-[10] transition-opacity duration-300"
            style={{
              left: 0,
              width: '18%',
              background: 'linear-gradient(to right, var(--bg), transparent)',
            }}
          />
        )}
        {settings.writingMode === 'vertical' && fadeRight && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-[10] transition-opacity duration-300"
            style={{
              right: '15%',
              width: '12%',
              background: 'linear-gradient(to left, var(--bg), transparent)',
            }}
          />
        )}
        <div
          className={`absolute inset-0 ${settings.writingMode === 'vertical' ? 'overflow-x-auto overflow-y-hidden' : 'overflow-auto'}`}
        >
          {/* Snippet selection toolbar */}
          <SnippetToolbar editorRef={editorRef} api={api} />

          {/* Eraser trace canvas */}
          <canvas ref={traceCanvasRef} className="pointer-events-none absolute inset-0 z-[1]" />

          {/* Title display (right side in vertical mode) — only when title is set */}
          {settings.writingMode === 'vertical' && title && (
            <button
              type="button"
              onClick={() => setTitleEditModalOpen(true)}
              className="absolute z-[2] cursor-pointer border-none bg-transparent"
              style={{
                right: '8%',
                top: '50%',
                transform: 'translateY(-50%)',
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                fontSize: '1.4em',
                letterSpacing: '0.15em',
                color: 'var(--fg)',
                opacity: 0.35,
                maxHeight: '70%',
                overflow: 'hidden',
                fontFamily:
                  settings.fontFamily === 'serif'
                    ? "'Noto Serif JP', serif"
                    : "'Noto Sans JP', sans-serif",
              }}
            >
              {title}
            </button>
          )}

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => {
              const text = editorRef.current?.textContent ?? '';
              setContent(text);
              if (status === 'saved') setStatus('editing');
            }}
            onPaste={(e) => {
              e.preventDefault();
              const text = e.clipboardData.getData('text/plain');
              if (!text) return;
              document.execCommand('insertText', false, text);
            }}
            data-placeholder="今日は何を感じましたか？"
            className={`whitespace-pre-wrap bg-transparent leading-relaxed focus:outline-none empty:before:text-zinc-400 empty:before:content-[attr(data-placeholder)] ${settings.writingMode === 'vertical' ? 'absolute inset-0' : 'min-h-full px-[15%] py-6'}`}
            style={{
              ...(settings.writingMode === 'vertical'
                ? {
                    left: '6%',
                    top: '4%',
                    width: '79%',
                    height: '92%',
                    position: 'absolute',
                    overflowX: 'auto',
                  }
                : {}),
              fontSize: `${settings.fontSize}px`,
              writingMode: settings.writingMode === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
              textOrientation: settings.writingMode === 'vertical' ? 'mixed' : undefined,
              fontFamily:
                settings.fontFamily === 'serif'
                  ? "'Noto Serif JP', serif"
                  : "'Noto Sans JP', sans-serif",
            }}
          />
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => guardedNavigate('/entries/new')}
            className="rounded-md p-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]"
            data-tooltip="新規エントリ"
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
            onClick={handleSaveClick}
            disabled={saving || !content.trim()}
            className="rounded-md p-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)] disabled:opacity-30"
            data-tooltip="保存する"
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
            onClick={handlePickleClick}
            disabled={saving || !content.trim()}
            className="rounded-md p-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)] disabled:opacity-30"
            data-tooltip="漬け込む"
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
                d="M6 4.5h12M7.5 4.5v-2a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v2M5 8.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-11Z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 11v5M12 11v5M15 11v5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => guardedNavigate('/entries')}
            className="rounded-md p-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]"
            data-tooltip="一覧"
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

        {/* Center: mic */}
        <button
          type="button"
          onClick={() => setVoiceActive((v) => !v)}
          className={`rounded-md p-1.5 transition-all ${
            voiceActive
              ? 'text-red-500'
              : 'text-[var(--date-color)] hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]'
          }`}
          data-tooltip={voiceActive ? '音声入力停止' : '音声入力'}
        >
          <svg
            aria-hidden="true"
            className={`h-5 w-5 ${voiceActive ? 'animate-pulse' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
          </svg>
        </button>

        {/* Right: stats */}
        <button
          type="button"
          onClick={() => setStatsOpen((v) => !v)}
          className="rounded-md p-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]"
          data-tooltip="執筆統計"
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="currentColor"
            stroke="none"
            viewBox="0 0 24 24"
          >
            <rect x="4" y="14" width="4" height="7" />
            <rect x="10" y="10" width="4" height="11" />
            <rect x="16" y="3" width="4" height="18" />
          </svg>
        </button>
      </div>

      {/* Stats popup */}
      <StatsPopup
        open={statsOpen}
        charCount={charCount}
        content={content}
        onClose={() => setStatsOpen(false)}
      />

      {/* Status bar */}
      <EditorStatusBar status={status} charCount={charCount} />

      {/* Save title modal — shared between 保存する and 漬け込む */}
      <SaveTitleModal
        open={saveModalOpen}
        initialTitle={title}
        saving={saving}
        heading={saveModalMode === 'pickle' ? 'エントリを瓶に漬け込む' : 'エントリを保存'}
        submitLabel={saveModalMode === 'pickle' ? '漬け込む' : '保存'}
        onSave={(t) => {
          handleSaveWithTitle(t, saveModalMode === 'pickle' ? { fermentationEnabled: true } : {});
          if (pendingNavPath) {
            const path = pendingNavPath;
            setPendingNavPath(null);
            setTimeout(() => router.push(path), 300);
          }
        }}
        onClose={() => {
          setSaveModalOpen(false);
          setPendingNavPath(null);
        }}
      />

      {/* Title edit modal (existing entry) */}
      <SaveTitleModal
        open={titleEditModalOpen}
        initialTitle={title}
        saving={saving}
        onSave={handleSaveWithTitle}
        onClose={() => setTitleEditModalOpen(false)}
      />

      {/* Unsaved changes modal */}
      <UnsavedChangesModal
        open={pendingNavPath !== null && !saveModalOpen}
        onSave={handleUnsavedSave}
        onDiscard={handleUnsavedDiscard}
        onClose={() => setPendingNavPath(null)}
      />
    </div>
  );
}
