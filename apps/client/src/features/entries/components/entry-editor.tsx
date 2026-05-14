'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type EditorStatus,
  EditorStatusBar,
} from '@/features/entries/components/editor-status-bar';
import { formatEntryDate } from '@/features/entries/components/format-entry-date';
import { LeaveConfirmModal } from '@/features/entries/components/leave-confirm-modal';
import { LinkQuestionNudgeModal } from '@/features/entries/components/link-question-nudge-modal';
import { PickleConfirmModal } from '@/features/entries/components/pickle-confirm-modal';
import { PickleNudgeModal } from '@/features/entries/components/pickle-nudge-modal';
import { QuestionLinker } from '@/features/entries/components/question-linker';
import { QuestionSelectModal } from '@/features/entries/components/question-select-modal';
import { SaveTitleModal } from '@/features/entries/components/save-title-modal';
import { SettingsDrawer } from '@/features/entries/components/settings-drawer';
import { SnippetToolbar } from '@/features/entries/components/snippet-toolbar';
import { StatsPopup } from '@/features/entries/components/stats-popup';
import { UnsavedChangesModal } from '@/features/entries/components/unsaved-changes-modal';
import { useAmpEffect } from '@/features/entries/hooks/use-amp-effect';
import { useAutosaveEntry } from '@/features/entries/hooks/use-autosave-entry';
import { useBrowserNavGuard } from '@/features/entries/hooks/use-browser-nav-guard';
import { useEditorSettings } from '@/features/entries/hooks/use-editor-settings';
import { useSaveEntry } from '@/features/entries/hooks/use-entry';
import { useEraserTrace } from '@/features/entries/hooks/use-eraser-trace';
import { useFocusMode } from '@/features/entries/hooks/use-focus-mode';
import { useGhostEffect } from '@/features/entries/hooks/use-ghost-effect';
import { useLinkQuestionSync } from '@/features/entries/hooks/use-link-question-sync';
import { usePressureBleed } from '@/features/entries/hooks/use-pressure-bleed';
import { useTimeInscription } from '@/features/entries/hooks/use-time-inscription';
import { useUserMe } from '@/features/entries/hooks/use-user-me';
import {
  useVoiceDynamics,
  type VoiceUnavailableReason,
} from '@/features/entries/hooks/use-voice-dynamics';
import type { ApiClient } from '@/lib/api';
import { SIDEBAR_WIDTH, useSidebarVisibility } from '@/lib/sidebar-context';

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

function voiceStatusMessage(
  reason: VoiceUnavailableReason | null,
  t: (key: string) => string,
): string {
  switch (reason) {
    case 'network':
    case 'service-not-allowed':
      return t('voice.error_network');
    case 'not-allowed':
      return t('voice.error_not_allowed');
    case 'unsupported':
      return t('voice.error_unsupported');
    default:
      return '';
  }
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
  const t = useTranslations('editor');
  const locale = useLocale();
  // For existing entries, split first line as title
  const parsed = entryId ? splitTitleBody(initialContent) : { title: '', body: initialContent };
  const [title, setTitle] = useState(initialTitle ?? parsed.title);
  const [content, setContent] = useState(entryId ? parsed.body : initialContent);
  const [savedContent, setSavedContent] = useState(entryId ? parsed.body : initialContent);
  const [settings, updateSettings] = useEditorSettings(locale);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalMode, setSaveModalMode] = useState<'save' | 'pickle'>('save');
  // Issue #316: pickle 時のモーダル分岐 (タイトル有無 × 問い有無)
  const [pickleConfirmOpen, setPickleConfirmOpen] = useState(false);
  const [questionSelectOpen, setQuestionSelectOpen] = useState(false);
  // Issue #316: 保存成功直後に出すガイドモーダル
  const [pickleNudgeOpen, setPickleNudgeOpen] = useState(false);
  const [linkQuestionNudgeOpen, setLinkQuestionNudgeOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [currentEntryId, setCurrentEntryId] = useState<string | undefined>(entryId);
  const [statsOpen, setStatsOpen] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [status, setStatus] = useState<EditorStatus>('editing');
  const isAutosavingRef = useRef(false);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set(initialLinkedIds));
  // Issue #319: autosave で初回エントリが作られた際に、ローカルで紐づけ済みの
  // questionId を DB に永続化する flush ヘルパー。
  const { flushPending: flushPendingLinks } = useLinkQuestionSync({
    linkedIds,
    link: onLinkQuestion,
  });
  const [dateStr, setDateStr] = useState(() => {
    const now = new Date();
    const created = createdAtIso ? new Date(createdAtIso) : now;
    const updated = updatedAtIso ? new Date(updatedAtIso) : now;
    return formatEntryDate(created, updated, t);
  });
  const { save, saving, error } = useSaveEntry(api, auth);
  // Issue #316: 保存成功直後のナッジ表示判定に使う
  const userMe = useUserMe(api);
  const router = useRouter();
  const sidebarWidth = SIDEBAR_WIDTH;
  const editorRef = useRef<HTMLDivElement>(null);
  const ghostLayerRef = useRef<HTMLDivElement>(null);
  const traceCanvasRef = useRef<HTMLCanvasElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const hasUnsavedChanges = content !== savedContent;
  const {
    open: leaveConfirmOpen,
    cancel: cancelLeaveConfirm,
    confirm: confirmLeaveConfirm,
  } = useBrowserNavGuard(hasUnsavedChanges);

  const anyOverlayOpen =
    settingsOpen ||
    saveModalOpen ||
    pickleConfirmOpen ||
    questionSelectOpen ||
    pickleNudgeOpen ||
    linkQuestionNudgeOpen ||
    isEditingTitle ||
    statsOpen ||
    pendingNavPath !== null ||
    leaveConfirmOpen;
  const uiVisible = useFocusMode({
    enabled: settings.focusModeEnabled,
    forceVisible: anyOverlayOpen,
    editorRef,
  });
  const fadeClass = `transition-opacity duration-300 ${
    uiVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
  }`;

  const { setHidden: setSidebarHidden } = useSidebarVisibility();
  useEffect(() => {
    setSidebarHidden(!uiVisible);
    return () => setSidebarHidden(false);
  }, [uiVisible, setSidebarHidden]);

  useGhostEffect(editorRef, ghostLayerRef, settings);
  useAmpEffect(settings.ampEnabled);
  useTimeInscription(editorRef, settings);
  useEraserTrace(editorRef, traceCanvasRef, settings.eraserTraceEnabled, settings.fontSize);
  usePressureBleed(
    editorRef,
    settings.timeInscriptionEnabled && settings.timeInscriptionMode === 'pressureBleed',
  );
  const voiceState = useVoiceDynamics(editorRef, voiceActive);

  useEffect(() => {
    if (voiceState.unavailable && voiceActive) {
      setVoiceActive(false);
    }
  }, [voiceState.unavailable, voiceActive]);

  useEffect(() => {
    // For new entries (no createdAt), update the clock every minute
    if (!createdAtIso) {
      const timer = setInterval(() => {
        const now = new Date();
        setDateStr(formatEntryDate(now, now, t));
      }, 60_000);
      return () => clearInterval(timer);
    }
  }, [createdAtIso, t]);

  useEffect(() => {
    if (saving) setStatus(isAutosavingRef.current ? 'autosaving' : 'saving');
  }, [saving]);

  // Track scroll position of editor to show/hide end-side fade overlay
  useEffect(() => {
    const el = editorRef.current;
    if (!el || settings.writingMode !== 'vertical') {
      setFadeLeft(false);
      return;
    }
    function updateFade() {
      if (!el) return;
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const maxScroll = scrollWidth - clientWidth;
      // vertical-rl: scrollLeft=0 at start (rightmost/beginning), goes negative when scrolled left
      // End-side fade: show when not scrolled all the way to the end
      setFadeLeft(maxScroll > 5 && Math.abs(scrollLeft) < maxScroll - 5);
    }
    updateFade();
    el.addEventListener('scroll', updateFade);
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
      // Issue #316: ナッジ判定用に、保存"前"のフラグスナップショットを取る
      const prevHasPickled = userMe.data?.hasPickled ?? null;
      const prevHasLinked = userMe.data?.hasLinkedQuestion ?? null;
      const onboardingCompleted = userMe.data?.onboardingCompleted ?? false;
      const linkedCountBeforeSave = linkedIds.size;
      const justPickled = options.fermentationEnabled === true;

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
        setPickleConfirmOpen(false);
        setQuestionSelectOpen(false);
        setIsEditingTitle(false);
        setStatus('saved');
        const created = createdAtIso ? new Date(createdAtIso) : new Date();
        setDateStr(formatEntryDate(created, new Date(), t));
        if (isNew && onLinkQuestion) {
          for (const qId of linkedIds) {
            await onLinkQuestion(savedId, qId);
          }
        }
        setTimeout(() => setStatus('editing'), 2000);
        onSaveComplete?.(savedId, finalContent);

        // Issue #316: ガイドモーダル判定 (オンボーディング完了後のみ)。
        // 漬け込み遷移が走るケース (= 漬け込み成功) はナッジ不要、遷移先で完結。
        if (onboardingCompleted && !justPickled) {
          if (
            prevHasPickled === false &&
            linkedCountBeforeSave > 0 &&
            !sessionStorage.getItem('oryzae:nudge:pickle:shown')
          ) {
            sessionStorage.setItem('oryzae:nudge:pickle:shown', '1');
            setPickleNudgeOpen(true);
          } else if (
            prevHasLinked === false &&
            linkedCountBeforeSave === 0 &&
            !sessionStorage.getItem('oryzae:nudge:link:shown')
          ) {
            sessionStorage.setItem('oryzae:nudge:link:shown', '1');
            setLinkQuestionNudgeOpen(true);
          }
        }
        // 状態が変わった可能性があるので user-me を refetch (次回判定の精度向上)
        userMe.refresh();

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
      t,
      userMe,
    ],
  );

  const handleSaveClick = useCallback(() => {
    if (!content.trim()) return;
    // For new entries with no inline title yet, prompt via modal; otherwise save directly.
    if (!entryId && !title.trim()) {
      setSaveModalMode('save');
      setSaveModalOpen(true);
    } else {
      handleSaveWithTitle(title);
    }
  }, [content, entryId, handleSaveWithTitle, title]);

  // Issue #316: 漬け込む を押した時、エントリの状態 (タイトル有無 × 問い有無) で
  // 表示するモーダルを 4 通りに分岐する:
  //   - title あり × 問いあり → PickleConfirmModal (確認のみ)
  //   - title なし × 問いあり → 既存 SaveTitleModal (タイトル編集付き)
  //   - title あり × 問いなし → QuestionSelectModal (問い選択 → pickle)
  //   - title なし × 問いなし → QuestionSelectModal (問い選択、本文先頭行を title として採用)
  const handlePickleClick = useCallback(() => {
    if (!content.trim()) return;
    const hasTitle = title.trim().length > 0;
    const hasQuestion = linkedIds.size > 0;

    if (hasQuestion && hasTitle) {
      setPickleConfirmOpen(true);
    } else if (hasQuestion && !hasTitle) {
      setSaveModalMode('pickle');
      setSaveModalOpen(true);
    } else {
      // hasQuestion === false (title 有無に関わらず) → まず問いを決めてもらう
      setQuestionSelectOpen(true);
    }
  }, [content, title, linkedIds]);

  // タイトルあり×問いありケース: 漬け込み確認モーダルからの実行
  const handlePickleConfirm = useCallback(() => {
    handleSaveWithTitle(title, { fermentationEnabled: true });
  }, [handleSaveWithTitle, title]);

  // タイトルあり/なし × 問いなしケース: 問いを選択 (or 新規作成) してから漬け込む
  const handleQuestionSelectAndPickle = useCallback(
    async (args: { existingId: string | null; newQuestionText: string | null }) => {
      let questionId = args.existingId;
      // 新規問い作成 (POST /api/v1/questions)
      if (!questionId && args.newQuestionText && api) {
        const res = await api.fetch('/api/v1/questions', {
          method: 'POST',
          body: JSON.stringify({ string: args.newQuestionText }),
        });
        if (res.ok) {
          const data = (await res.json()) as { id?: string };
          questionId = data.id ?? null;
        }
      }
      if (!questionId) return;

      // ローカル state に追加 (新規エントリの場合は handleSaveWithTitle 内で
      // server side のリンクが行われる)
      const nextLinked = new Set(linkedIds);
      nextLinked.add(questionId);
      setLinkedIds(nextLinked);

      // 既存エントリの場合は即座にサーバ側でリンクする
      const targetId = currentEntryId ?? entryId;
      if (targetId && onLinkQuestion) {
        await onLinkQuestion(targetId, questionId);
      }

      setQuestionSelectOpen(false);
      // 漬け込みを実行 (タイトル未設定なら本文先頭行が title として後から解釈される)
      handleSaveWithTitle(title, { fermentationEnabled: true });
    },
    [api, linkedIds, currentEntryId, entryId, onLinkQuestion, handleSaveWithTitle, title],
  );

  const startTitleEdit = useCallback(() => {
    setDraftTitle(title);
    setIsEditingTitle(true);
  }, [title]);

  const cancelTitleEdit = useCallback(() => {
    setIsEditingTitle(false);
    setDraftTitle('');
  }, []);

  const commitTitleEdit = useCallback(() => {
    const trimmed = draftTitle.trim();
    const targetId = currentEntryId ?? entryId;
    if (targetId) {
      if (trimmed !== title) {
        handleSaveWithTitle(trimmed);
      } else {
        setIsEditingTitle(false);
      }
    } else {
      setTitle(trimmed);
      setIsEditingTitle(false);
    }
  }, [draftTitle, currentEntryId, entryId, handleSaveWithTitle, title]);

  useEffect(() => {
    if (isEditingTitle) {
      const t = setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [isEditingTitle]);

  const handleAutosaved = useCallback(
    async (newId: string, savedBody: string) => {
      // Track the id locally so subsequent autosaves PUT instead of POST.
      // URL stays the same — the 新規エントリ button and browser refresh
      // continue to behave as if the user is still composing.
      const wasNew = currentEntryId !== newId;
      if (wasNew) setCurrentEntryId(newId);
      setSavedContent(savedBody);
      setStatus('saved');
      isAutosavingRef.current = false;
      setTimeout(() => setStatus('editing'), 2000);

      // Issue #319: autosave が手動保存より先にエントリを作成すると、
      // handleSaveWithTitle の `isNew` 分岐がスキップされ question link が
      // DB に永続化されないバグを修正。サーバー側 link は upsert で冪等。
      if (wasNew) {
        await flushPendingLinks(newId);
      }
    },
    [currentEntryId, flushPendingLinks],
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
    if (!entryId && !title.trim()) {
      setSaveModalMode('save');
      setSaveModalOpen(true);
    } else {
      handleSaveWithTitle(title);
      if (pendingNavPath) {
        const path = pendingNavPath;
        setPendingNavPath(null);
        setTimeout(() => router.push(path), 300);
      }
    }
  }, [entryId, handleSaveWithTitle, pendingNavPath, router, title]);

  const handleUnsavedDiscard = useCallback(() => {
    const path = pendingNavPath;
    setPendingNavPath(null);
    if (path) router.push(path);
  }, [pendingNavPath, router]);

  const handleLink = useCallback(
    async (questionId: string) => {
      setLinkedIds((prev) => new Set(prev).add(questionId));
      // Issue #319: autosave 後は currentEntryId が確定するので、
      // それを優先して使う（entryId は props で新規ページでは undefined）。
      const targetId = currentEntryId ?? entryId;
      if (targetId && onLinkQuestion) {
        await onLinkQuestion(targetId, questionId);
      }
    },
    [currentEntryId, entryId, onLinkQuestion],
  );

  const handleUnlink = useCallback(
    async (questionId: string) => {
      setLinkedIds((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
      // Issue #319: handleLink と同じく autosave 後は currentEntryId を優先.
      const targetId = currentEntryId ?? entryId;
      if (targetId && onUnlinkQuestion) {
        await onUnlinkQuestion(targetId, questionId);
      }
    },
    [currentEntryId, entryId, onUnlinkQuestion],
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
      <div
        className={`flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-2 ${fadeClass}`}
      >
        <div className="flex items-center gap-2">
          {/* New entry */}
          <button
            type="button"
            onClick={() => guardedNavigate('/entries/new')}
            className="rounded-md p-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]"
            data-tooltip={t('toolbar.new_entry')}
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
          {/* Save */}
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={saving || !content.trim()}
            className="rounded-md p-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)] disabled:opacity-30"
            data-tooltip={t('toolbar.save')}
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
          {/* Pickle */}
          <button
            type="button"
            onClick={handlePickleClick}
            disabled={saving || !content.trim()}
            className="rounded-md p-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)] disabled:opacity-30"
            data-tooltip={t('toolbar.pickle')}
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
          {/* List */}
          <button
            type="button"
            onClick={() => guardedNavigate('/entries')}
            className="rounded-md p-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]"
            data-tooltip={t('toolbar.list')}
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
          {/* Stats */}
          <button
            type="button"
            onClick={() => setStatsOpen((v) => !v)}
            className="rounded-md p-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]"
            data-tooltip={t('toolbar.stats')}
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

        {/* Date + inline title (title sits directly under the date) */}
        <div className="flex min-w-0 flex-col items-center gap-0.5">
          <span className="text-xs text-zinc-400">{dateStr}</span>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                // IME 変換確定の Enter / Escape は無視する（日本語入力途中で確定されてしまう不具合の対策）
                if (e.nativeEvent.isComposing) return;
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitTitleEdit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelTitleEdit();
                }
              }}
              onBlur={commitTitleEdit}
              maxLength={100}
              placeholder={t('title.placeholder')}
              className="w-[240px] max-w-full border-none bg-transparent text-center text-sm text-[var(--fg)] outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={startTitleEdit}
              className="max-w-full cursor-pointer truncate border-none bg-transparent text-sm transition-colors hover:text-[var(--fg)]"
              style={{ color: title ? 'var(--fg)' : 'var(--date-color)' }}
            >
              {title || t('title.add')}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {voiceState.unavailable && (
            <span
              className="text-xs text-red-500"
              role="status"
              data-testid="voice-unavailable-notice"
            >
              {voiceStatusMessage(voiceState.reason, t)}
            </span>
          )}
          {/* Voice input */}
          <button
            type="button"
            onClick={() => setVoiceActive((v) => !v)}
            className={`rounded-md p-1.5 transition-all ${
              voiceActive
                ? 'text-red-500'
                : 'text-[var(--date-color)] hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]'
            }`}
            data-tooltip={voiceActive ? t('toolbar.voice_stop') : t('toolbar.voice')}
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
          {/* Settings */}
          <button
            type="button"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="rounded-md p-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]"
            data-tooltip={t('toolbar.settings')}
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
          {/* Writing direction toggle */}
          <button
            type="button"
            onClick={() =>
              updateSettings({
                writingMode: settings.writingMode === 'vertical' ? 'horizontal' : 'vertical',
              })
            }
            className="rounded-md p-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]"
            data-tooltip={
              settings.writingMode === 'vertical'
                ? t('toolbar.writing_horizontal')
                : t('toolbar.writing_vertical')
            }
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
            data-tooltip={
              settings.fontFamily === 'serif' ? t('toolbar.font_sans') : t('toolbar.font_serif')
            }
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
          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-md p-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]"
            data-tooltip={t('toolbar.fullscreen')}
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
      </div>

      {/* Question linker */}
      <div className={`border-b border-[var(--border-subtle)] px-4 py-2 ${fadeClass}`}>
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

      {/* Editor area — outer wrapper (no overflow) holds fade overlay; inner div scrolls */}
      <div className="relative flex-1">
        {/* End-side fade for vertical mode — appears only when content is clipped at the end */}
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
        <div
          className={`absolute inset-0 ${settings.writingMode === 'vertical' ? 'overflow-x-auto overflow-y-hidden' : 'overflow-auto'}`}
        >
          {/* Snippet selection toolbar */}
          <SnippetToolbar editorRef={editorRef} api={api} />

          {/* Eraser trace canvas */}
          <canvas ref={traceCanvasRef} className="pointer-events-none absolute inset-0 z-[1]" />

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => {
              // innerText を使う理由: contentEditable で Enter キー押下時に
              // ブラウザが挿入する <br> や <div> を改行として読み取るため。
              // textContent はこれらを無視し、改行が保存されない。
              const text = editorRef.current?.innerText ?? '';
              setContent(text);
              if (status === 'saved') setStatus('editing');
            }}
            onPaste={(e) => {
              e.preventDefault();
              const text = e.clipboardData.getData('text/plain');
              if (!text) return;
              document.execCommand('insertText', false, text);
              // execCommand の input イベントが React の onInput にバブルしない
              // 場合があるため、paste 後に明示的に state を同期する（autosave が
              // content 変化を検知できるようにするため）
              const updated = editorRef.current?.innerText ?? '';
              setContent(updated);
              if (status === 'saved') setStatus('editing');
            }}
            data-placeholder={t('placeholder')}
            className={`whitespace-pre-wrap bg-transparent focus:outline-none empty:before:text-zinc-400 empty:before:content-[attr(data-placeholder)] ${settings.writingMode === 'vertical' ? `absolute inset-0 after:block after:content-[''] after:w-[50vw]` : 'min-h-full px-[15%] py-6'}`}
            style={{
              ...(settings.writingMode === 'vertical'
                ? {
                    left: '6%',
                    top: '4%',
                    width: '79%',
                    height: '86%',
                    position: 'absolute',
                    overflowX: 'auto',
                  }
                : {}),
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
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

      {/* Stats popup */}
      <StatsPopup
        open={statsOpen}
        charCount={charCount}
        content={content}
        onClose={() => setStatsOpen(false)}
      />

      {/* Status bar */}
      <div className={fadeClass}>
        <EditorStatusBar status={status} charCount={charCount} />
      </div>

      {/* Save title modal — shared between 保存する and 漬け込む */}
      <SaveTitleModal
        open={saveModalOpen}
        initialTitle={title}
        saving={saving}
        heading={
          saveModalMode === 'pickle' ? t('save_modal.heading_pickle') : t('save_modal.heading_save')
        }
        submitLabel={
          saveModalMode === 'pickle' ? t('save_modal.submit_pickle') : t('save_modal.submit_save')
        }
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

      {/* Unsaved changes modal */}
      <UnsavedChangesModal
        open={pendingNavPath !== null && !saveModalOpen}
        onSave={handleUnsavedSave}
        onDiscard={handleUnsavedDiscard}
        onClose={() => setPendingNavPath(null)}
      />

      {/* Browser back/forward confirmation */}
      <LeaveConfirmModal
        open={leaveConfirmOpen}
        onCancel={cancelLeaveConfirm}
        onConfirm={confirmLeaveConfirm}
      />

      {/* Issue #316: タイトルあり × 問いあり 用の漬け込み確認モーダル */}
      <PickleConfirmModal
        open={pickleConfirmOpen}
        saving={saving}
        title={title}
        linkedQuestionTexts={activeQuestions
          .filter((q) => linkedIds.has(q.id) && q.currentText)
          .map((q) => q.currentText as string)}
        onConfirm={handlePickleConfirm}
        onClose={() => setPickleConfirmOpen(false)}
      />

      {/* Issue #316: 問い未紐付エントリを漬け込む際の問い選択モーダル */}
      <QuestionSelectModal
        open={questionSelectOpen}
        saving={saving}
        activeQuestions={activeQuestions}
        linkedQuestionIds={linkedIds}
        onConfirm={handleQuestionSelectAndPickle}
        onClose={() => setQuestionSelectOpen(false)}
      />

      {/* Issue #316: 保存後ガイド (まだ漬け込んでいない使用者向け) */}
      <PickleNudgeModal open={pickleNudgeOpen} onClose={() => setPickleNudgeOpen(false)} />

      {/* Issue #316: 保存後ガイド (まだ問いを紐付けていない使用者向け) */}
      <LinkQuestionNudgeModal
        open={linkQuestionNudgeOpen}
        onClose={() => setLinkQuestionNudgeOpen(false)}
      />
    </div>
  );
}
