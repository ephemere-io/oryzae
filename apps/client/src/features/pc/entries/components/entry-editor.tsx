'use client';

import type { EditorEffectsState } from '@oryzae/shared';
import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type EditorStatus,
  EditorStatusBar,
} from '@/features/pc/entries/components/editor-status-bar';
import { FermentationDisplayPromptModal } from '@/features/pc/entries/components/fermentation-display-prompt-modal';
import { FermentationSidebar } from '@/features/pc/entries/components/fermentation-sidebar';
import { LeaveConfirmModal } from '@/features/pc/entries/components/leave-confirm-modal';
import { LinkQuestionNudgeModal } from '@/features/pc/entries/components/link-question-nudge-modal';
import { PickleConfirmModal } from '@/features/pc/entries/components/pickle-confirm-modal';
import { PickleNudgeModal } from '@/features/pc/entries/components/pickle-nudge-modal';
import { QuestionChip } from '@/features/pc/entries/components/question-chip';
import { QuestionSelectModal } from '@/features/pc/entries/components/question-select-modal';
import { SaveTitleModal } from '@/features/pc/entries/components/save-title-modal';
import { SettingsDrawer } from '@/features/pc/entries/components/settings-drawer';
import { SnippetToolbar } from '@/features/pc/entries/components/snippet-toolbar';
import { StatsPopup } from '@/features/pc/entries/components/stats-popup';
import { UnsavedChangesModal } from '@/features/pc/entries/components/unsaved-changes-modal';
import { useAmpEffect } from '@/features/pc/entries/hooks/use-amp-effect';
import { useBrowserNavGuard } from '@/features/pc/entries/hooks/use-browser-nav-guard';
import { useEditorSettings } from '@/features/pc/entries/hooks/use-editor-settings';
import { useEraserTrace } from '@/features/pc/entries/hooks/use-eraser-trace';
import { useFocusMode } from '@/features/pc/entries/hooks/use-focus-mode';
import { useGhostEffect } from '@/features/pc/entries/hooks/use-ghost-effect';
import { useLinkQuestionSync } from '@/features/pc/entries/hooks/use-link-question-sync';
import { usePressureBleed } from '@/features/pc/entries/hooks/use-pressure-bleed';
import { useSaveTransition } from '@/features/pc/entries/hooks/use-save-transition';
import { useTimeInscription } from '@/features/pc/entries/hooks/use-time-inscription';
import { useTypewriterScroll } from '@/features/pc/entries/hooks/use-typewriter-scroll';
import { useVoiceDynamics } from '@/features/pc/entries/hooks/use-voice-dynamics';
import type { VoiceUnavailableReason } from '@/features/pc/entries/types';
import {
  loadCachedEffects,
  saveCachedEffects,
} from '@/features/pc/entries/utils/editor-effects-cache';
import {
  applyTextSpansToEditor,
  extractEditorEffects,
} from '@/features/pc/entries/utils/editor-effects-codec';
import { formatEntryDate } from '@/features/pc/entries/utils/format-entry-date';
import { useAutosaveEntry } from '@/features/shared/entries/hooks/use-autosave-entry';
import { useSaveEntry } from '@/features/shared/entries/hooks/use-entry';
import { useFermentationForQuestion } from '@/features/shared/fermentation/hooks/use-fermentation-for-question';
import { useCreateQuestion } from '@/features/shared/questions/hooks/use-create-question';
import { useUserMe } from '@/features/shared/user/hooks/use-user-me';
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
  /**
   * Persisted visual effects loaded from the server (or warm cache).
   * Drives initial canvas traces + DOM eblock/v-block restoration.
   * Issue #332 — see docs/editor-effects-persistence.md.
   */
  initialEffects?: EditorEffectsState | null;
  createdAt?: string;
  updatedAt?: string;
  api: ApiClient | null;
  auth: AuthState | null;
  activeQuestions?: QuestionOption[];
  initialLinkedIds?: string[];
  onLinkQuestion?: (entryId: string, questionId: string) => Promise<void>;
  onUnlinkQuestion?: (entryId: string, questionId: string) => Promise<void>;
  onSaveComplete?: (entryId: string, content: string) => void;
  /**
   * 「瓶に漬ける」演出の完了後に呼ばれる（遷移先の決定は呼び出し側）。
   * 演出そのもの（useSaveTransition）は PC 固有なのでこのコンポーネント内に閉じる
   * — page から端末固有 hook を呼ぶと SP でも実行されてしまうため（Issue #490）。
   */
  onPickled?: () => void;
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
  initialEffects = null,
  createdAt: createdAtIso,
  updatedAt: updatedAtIso,
  api,
  auth,
  activeQuestions = [],
  initialLinkedIds = [],
  onLinkQuestion,
  onUnlinkQuestion,
  onSaveComplete,
  onPickled,
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
  // Issue #360: ステータスバーが「いつ保存されたか」を語り続けるための基準時刻。
  // 保存ボタンを廃した（原則2）ので、保存が起きている事実はこの帯だけが伝える。
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const isAutosavingRef = useRef(false);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set(initialLinkedIds));
  // Issue #319: autosave で初回エントリが作られた際に、ローカルで紐づけ済みの
  // questionId を DB に永続化する flush ヘルパー。
  const { flushPending: flushPendingLinks } = useLinkQuestionSync({
    linkedIds,
    link: onLinkQuestion,
  });

  // Issue #329 → #466: 新規エントリで紐付けた問いに発酵結果がある場合の表示制御。
  // 本文に重ねるフローティング表示をやめ、右のサイドバーに集約した。
  // 既存エントリでは表示しない (執筆中の判断材料として使うため新規限定)。
  const isNewEntry = !entryId;
  const firstLinkedQuestionId = isNewEntry ? Array.from(linkedIds)[0] : undefined;
  const { detail: fermentationOverlayDetail } = useFermentationForQuestion(
    api,
    firstLinkedQuestionId,
  );
  const [fermentSidebarOpen, setFermentSidebarOpen] = useState(false);
  const [overlayPromptOpen, setOverlayPromptOpen] = useState(false);
  const promptedForQuestionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!fermentationOverlayDetail) {
      setFermentSidebarOpen(false);
      setOverlayPromptOpen(false);
      promptedForQuestionRef.current = null;
      return;
    }
    if (promptedForQuestionRef.current === fermentationOverlayDetail.questionId) return;
    promptedForQuestionRef.current = fermentationOverlayDetail.questionId;
    if (settings.fermentationOverlayPreference === 'always') {
      setFermentSidebarOpen(true);
      setOverlayPromptOpen(false);
    } else if (settings.fermentationOverlayPreference === 'never') {
      setFermentSidebarOpen(false);
      setOverlayPromptOpen(false);
    } else {
      setOverlayPromptOpen(true);
    }
  }, [fermentationOverlayDetail, settings.fermentationOverlayPreference]);
  const handleOverlayPromptChoose = useCallback(
    (display: boolean, remember: boolean) => {
      setFermentSidebarOpen(display);
      setOverlayPromptOpen(false);
      if (remember) {
        updateSettings({ fermentationOverlayPreference: display ? 'always' : 'never' });
      }
    },
    [updateSettings],
  );
  const toggleFermentSidebar = useCallback(() => {
    setFermentSidebarOpen((v) => !v);
  }, []);
  const [dateStr, setDateStr] = useState(() => {
    const now = new Date();
    const created = createdAtIso ? new Date(createdAtIso) : now;
    const updated = updatedAtIso ? new Date(updatedAtIso) : now;
    return formatEntryDate(created, updated, t);
  });
  const { save, saving, error } = useSaveEntry(api, auth);
  const createQuestion = useCreateQuestion(api);
  const runSaveTransition = useSaveTransition();
  // Issue #316: 保存成功直後のナッジ表示判定に使う
  const userMe = useUserMe(api);
  const router = useRouter();
  const sidebarWidth = SIDEBAR_WIDTH;
  const editorRef = useRef<HTMLDivElement>(null);
  // 横書きでスクロールする外枠（縦書きでは editor 自身がスクローラ）。Issue #364。
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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
    leaveConfirmOpen ||
    overlayPromptOpen;
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

  // Resolve persisted effects. The server value (passed via prop) is SSoT;
  // the localStorage cache only fills the gap until the server reply arrives —
  // and is updated immediately on each save so subsequent reloads feel instant.
  const cachedInitialEffects = useRef<EditorEffectsState | null>(null);
  if (cachedInitialEffects.current === null) {
    cachedInitialEffects.current = loadCachedEffects(entryId);
  }
  const effectiveInitialEffects: EditorEffectsState | null =
    initialEffects ?? cachedInitialEffects.current ?? null;

  useGhostEffect(editorRef, ghostLayerRef, settings);
  useAmpEffect(settings.ampEnabled);
  useTimeInscription(editorRef, settings);
  const { getTracesSnapshot } = useEraserTrace(
    editorRef,
    traceCanvasRef,
    settings.eraserTraceEnabled,
    settings.fontSize,
    effectiveInitialEffects?.eraserTraces,
  );
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
    // ResizeObserver はブラウザでは常に存在するが、SSR/テスト(jsdom)には無いため防御する。
    // 既存の getSpeechRecognitionConstructor / AudioContext と同じく、未定義環境では no-op。
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateFade);
      ro.observe(el);
    }
    return () => {
      el.removeEventListener('scroll', updateFade);
      ro?.disconnect();
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: effectiveInitialEffects is hydrated once per entry-switch; we intentionally don't rerun on its identity changing during the editing session
  useEffect(() => {
    if (entryId) {
      const p = splitTitleBody(initialContentStable);
      setTitle(p.title);
      setContent(p.body);
      setSavedContent(p.body);
      if (editorRef.current && p.body) {
        editorRef.current.textContent = p.body;
        if (effectiveInitialEffects?.textSpans?.length) {
          applyTextSpansToEditor(editorRef.current, effectiveInitialEffects.textSpans);
        }
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

      // Issue #332: スナップショットを取って effects を save payload に同梱する。
      // editor DOM が存在しなければ null（既存値を維持）を送る。
      const effectsSnapshot = editorRef.current
        ? extractEditorEffects(editorRef.current, getTracesSnapshot())
        : null;

      const saveOptions: {
        fermentationEnabled?: boolean;
        effects?: EditorEffectsState | null;
      } = {};
      if (options.fermentationEnabled !== undefined) {
        saveOptions.fermentationEnabled = options.fermentationEnabled;
      }
      if (editorRef.current) {
        saveOptions.effects = effectsSnapshot;
      }

      const savedId = await save(
        finalContent,
        targetId,
        Object.keys(saveOptions).length > 0 ? saveOptions : undefined,
      );
      if (savedId) {
        // localStorage warm cache を即時更新（次回オープン時の遅延ゼロ表示用）
        saveCachedEffects(savedId, effectsSnapshot);
        setTitle(newTitle.trim());
        setSavedContent(content);
        setCurrentEntryId(savedId);
        setSaveModalOpen(false);
        setPickleConfirmOpen(false);
        setQuestionSelectOpen(false);
        setIsEditingTitle(false);
        setStatus('saved');
        setLastSavedAt(Date.now());
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

        if (options.fermentationEnabled && onPickled && editorRef.current && finalContent.trim()) {
          await runSaveTransition(finalContent, editorRef.current);
          onPickled();
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
      onPickled,
      runSaveTransition,
      createdAtIso,
      t,
      userMe,
      getTracesSnapshot,
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
      if (!questionId && args.newQuestionText) {
        questionId = await createQuestion(args.newQuestionText);
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
    [
      createQuestion,
      linkedIds,
      currentEntryId,
      entryId,
      onLinkQuestion,
      handleSaveWithTitle,
      title,
    ],
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
      setLastSavedAt(Date.now());
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

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }, []);

  // Issue #311: 執筆がノッている間、手をキーボードから離さずに済むようにする。
  // ⌘S は「保存」だが、保存ボタンを廃した（原則2）今は「いま確定させる」操作にあたる。
  // ⌘F はブラウザのページ内検索を奪うが、エディタ内での検索より漬け込みのほうが要る。
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        handleSaveClick();
      } else if (key === 'f') {
        e.preventDefault();
        handlePickleClick();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveClick, handlePickleClick]);

  useTypewriterScroll({
    editorRef,
    scrollContainerRef,
    writingMode: settings.writingMode,
    enabled: true,
  });

  const charCount = content.length;
  // 縦書きは行が右から左へ伸びるので、本文の「末尾側」＝左。一次アクションは末尾側に置く。
  const dockSideClass = settings.writingMode === 'vertical' ? 'left-8' : 'right-8';

  return (
    <div
      className="fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-[var(--bg)] transition-[left] duration-200 ease-linear"
      style={{ left: sidebarWidth }}
      {...verifyAttrs({
        unit: 'EntryEditor',
        hasEntry: !!entryId,
        hasBody: content.trim().length > 0,
        settingsOpen,
        statsOpen,
        saveModalOpen,
        questionSelectOpen,
      })}
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
            aria-label={t('toolbar.new_entry')}
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
          {/* Issue #314 / #356: 「保存」ボタンはここから消えた。保存は常に自動で、
              人が押すボタンは「漬け込む」だけ（本文側のドックにある）。保存が起きている事実は
              下部ステータスバーが語る。⌘S は「いま確定させる」操作として残している。 */}
          {/* List */}
          <button
            type="button"
            onClick={() => guardedNavigate('/entries')}
            className="rounded-md p-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]"
            data-tooltip={t('toolbar.list')}
            aria-label={t('toolbar.list')}
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
          {/* 執筆統計はステータスバーの文字数から開く（帯に意味を持たせる #360）。 */}
        </div>

        {/* 中央: このエントリーの身元（日付 → タイトル → 問い）。Issue #228 */}
        <div className="flex min-w-0 flex-col items-center gap-1">
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
              aria-label={t('title.placeholder')}
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
          {/* Issue #228 #365: 専用行を廃して、問いを身元カラムの一部にする。 */}
          <QuestionChip
            activeQuestions={activeQuestions}
            linkedQuestionIds={linkedIds}
            onLink={handleLink}
            onUnlink={handleUnlink}
          />
        </div>

        {/* 右: 表示の切り替え。書字方向・書体・全画面は設定ドロワーに収納した（#356）。 */}
        <div className="flex items-center gap-2">
          {/* Issue #329 → #466: 発酵結果はサイドバーに集約。結果があるときだけ開閉ボタンを出す。 */}
          {fermentationOverlayDetail && (
            <button
              type="button"
              onClick={toggleFermentSidebar}
              aria-pressed={fermentSidebarOpen}
              className={`rounded-md p-1.5 transition-all hover:bg-[var(--toolbar-hover)] ${
                fermentSidebarOpen
                  ? 'text-emerald-600'
                  : 'text-[var(--date-color)] hover:text-[var(--fg)]'
              }`}
              data-tooltip={
                fermentSidebarOpen
                  ? t('toolbar.fermentation_sidebar_hide')
                  : t('toolbar.fermentation_sidebar_show')
              }
              aria-label={
                fermentSidebarOpen
                  ? t('toolbar.fermentation_sidebar_hide')
                  : t('toolbar.fermentation_sidebar_show')
              }
              data-testid="fermentation-sidebar-toggle"
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
                  d="M9 3.75v3.75M15 3.75v3.75M7.5 7.5h9a1.5 1.5 0 0 1 1.5 1.5v9a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V9a1.5 1.5 0 0 1 1.5-1.5Zm1.5 5.25h6m-6 3h4.5"
                />
              </svg>
            </button>
          )}
          {/* Settings */}
          <button
            type="button"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="rounded-md p-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]"
            data-tooltip={t('toolbar.settings')}
            aria-label={t('toolbar.settings')}
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
        </div>
      </div>

      {/* Settings drawer */}
      <SettingsDrawer
        open={settingsOpen}
        settings={settings}
        onChange={updateSettings}
        onClose={() => setSettingsOpen(false)}
        onToggleFullscreen={toggleFullscreen}
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

      {/* 本文と発酵サイドバーを横に並べる（Issue #466）。本文の上には何も重ねない。 */}
      <div className="flex min-h-0 flex-1">
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
            ref={scrollContainerRef}
            className={`absolute inset-0 ${settings.writingMode === 'vertical' ? 'overflow-x-auto overflow-y-hidden' : 'overflow-auto'}`}
          >
            {/* Snippet selection toolbar */}
            <SnippetToolbar editorRef={editorRef} api={api} />

            {/* Eraser trace canvas — position/size set by useEraserTrace to overlay the editor box exactly */}
            <canvas ref={traceCanvasRef} className="pointer-events-none absolute z-[1]" />

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
              // Issue #207: 縦書きと同じく横書きにも末尾へ半画面ぶんの余白を置く。
              // 最後の行が画面の下端に貼りついたままにならず、キャレットが中央に留まれる（#364）。
              className={`whitespace-pre-wrap bg-transparent focus:outline-none empty:before:text-zinc-400 empty:before:content-[attr(data-placeholder)] ${settings.writingMode === 'vertical' ? `absolute inset-0 after:block after:content-[''] after:w-[50vw]` : `min-h-full px-[15%] py-6 after:block after:content-[''] after:h-[50vh]`}`}
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

          {/* 入力（音声）と一次アクション（漬け込む）のドック。
            Issue #356: ツールバーに埋もれた「漬け込む」を、本文の末尾側に置いた
            唯一の一次アクションへ昇格させる。書く道具（音声）も紙の近くに置く。
            縦書きは行が右→左なので末尾側＝左（dockSideClass）。 */}
          <div
            className={`pointer-events-none absolute bottom-6 z-[20] flex items-center gap-3 ${dockSideClass} ${fadeClass}`}
          >
            {voiceState.unavailable && (
              <span
                className="pointer-events-auto rounded bg-[var(--bg)] px-2 py-1 text-xs text-red-500 shadow"
                role="status"
                data-testid="voice-unavailable-notice"
              >
                {voiceStatusMessage(voiceState.reason, t)}
              </span>
            )}
            <button
              type="button"
              onClick={() => setVoiceActive((v) => !v)}
              className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg)] shadow-sm transition-all ${
                voiceActive ? 'text-red-500' : 'text-[var(--date-color)] hover:text-[var(--fg)]'
              }`}
              data-tooltip={voiceActive ? t('toolbar.voice_stop') : t('toolbar.voice')}
              aria-label={voiceActive ? t('toolbar.voice_stop') : t('toolbar.voice')}
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
            <button
              type="button"
              onClick={handlePickleClick}
              disabled={saving || !content.trim()}
              data-testid="pickle-primary-action"
              className="pointer-events-auto flex items-center gap-2 rounded-full px-5 py-2.5 text-sm text-white shadow-lg transition-opacity disabled:cursor-default disabled:opacity-30"
              style={{ background: 'var(--ob-jar-warm)', fontFamily: 'var(--ob-font-sans)' }}
              aria-label={t('toolbar.pickle')}
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.6}
              >
                <path d="M9 3h6M8 7h8l-.6 11a2 2 0 0 1-2 1.9H10.6a2 2 0 0 1-2-1.9L8 7Z" />
                <path d="M8.4 12c1.5-.8 2.6-.8 3.6 0s2.1.8 3.6 0" strokeOpacity=".55" />
              </svg>
              {t('toolbar.pickle')}
            </button>
          </div>
        </div>

        {/* Issue #466: 発酵結果は本文に重ねず、右のサイドバーに集約する。 */}
        {fermentSidebarOpen && fermentationOverlayDetail && (
          <FermentationSidebar
            detail={fermentationOverlayDetail}
            onClose={() => setFermentSidebarOpen(false)}
          />
        )}
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
        <EditorStatusBar
          status={status}
          charCount={charCount}
          lastSavedAt={lastSavedAt}
          onCharCountClick={() => setStatsOpen((v) => !v)}
        />
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
        linkedQuestionTexts={activeQuestions.flatMap((q) =>
          linkedIds.has(q.id) && q.currentText ? [q.currentText] : [],
        )}
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

      {/* Issue #329: 発酵結果フローティング表示の確認モーダル */}
      <FermentationDisplayPromptModal
        open={overlayPromptOpen}
        onChoose={handleOverlayPromptChoose}
        onClose={() => setOverlayPromptOpen(false)}
      />
    </div>
  );
}
