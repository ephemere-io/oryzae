'use client';

import type { EditorEffectsState } from '@oryzae/shared';
import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Popover } from '@/components/ui/popover';
import { ICON_SIZE, ICON_STROKE_WIDTH } from '@/components/ui/surface';
import {
  type EditorStatus,
  EditorStatusBar,
} from '@/features/pc/entries/components/editor-status-bar';
import {
  EntryActionPalette,
  type PaletteAction,
} from '@/features/pc/entries/components/entry-action-palette';
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
  // Issue #510: 未保存判定に**タイトルも**含める。本文だけを見ていると、タイトルだけ変えた
  // 状態が「保存済み」に見え、離脱ガードも素通りしてしまう。
  const [savedTitle, setSavedTitle] = useState(
    (entryId ? (initialTitle ?? parsed.title) : '').trim(),
  );
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
  const [currentEntryId, setCurrentEntryId] = useState<string | undefined>(entryId);
  const [statsOpen, setStatsOpen] = useState(false);
  // 問いのドロップダウンは、ヘッダーのチップからもパレットの操作からも開く。
  const [questionChipOpen, setQuestionChipOpen] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
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

  const hasUnsavedChanges = content !== savedContent || title.trim() !== savedTitle;
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
    statsOpen ||
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
      setSavedTitle(p.title.trim());
      if (editorRef.current && p.body) {
        editorRef.current.textContent = p.body;
        if (effectiveInitialEffects?.textSpans?.length) {
          applyTextSpansToEditor(editorRef.current, effectiveInitialEffects.textSpans);
        }
      }
    } else {
      setContent(initialContentStable);
      setSavedContent(initialContentStable);
      setSavedTitle('');
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
        setSavedTitle(newTitle.trim());
        setCurrentEntryId(savedId);
        setSaveModalOpen(false);
        setPickleConfirmOpen(false);
        setQuestionSelectOpen(false);
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

  /**
   * タイトルは常時入力できる。以前は「押すと入力に変わるボタン」だったが、
   * タイトルは入力欄であってボタンではない。押して初めて編集できる形は、
   * 入力欄であることを隠しているだけだった。
   *
   * 本文と同じく、確定は保存に任せる（autosave が content = title\nbody を書く）。
   * 既存エントリでフォーカスを外したときだけ、その場で確定させる。
   */
  const commitTitleEdit = useCallback(() => {
    const trimmed = title.trim();
    if (trimmed === savedTitle) return;
    const targetId = currentEntryId ?? entryId;
    if (targetId) handleSaveWithTitle(trimmed);
  }, [title, savedTitle, currentEntryId, entryId, handleSaveWithTitle]);

  const handleAutosaved = useCallback(
    async (newId: string, savedBody: string, autosavedTitle: string) => {
      // Track the id locally so subsequent autosaves PUT instead of POST.
      // URL stays the same — the 新規エントリ button and browser refresh
      // continue to behave as if the user is still composing.
      const wasNew = currentEntryId !== newId;
      if (wasNew) setCurrentEntryId(newId);
      setSavedContent(savedBody);
      setSavedTitle(autosavedTitle);
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

  // 「保存せずに移動しますか？」の確認は廃止した。
  // 画面内の移動導線（一覧 / 新規エントリ）をサイドバーへ寄せてヘッダーから外したため、
  // このコンポーネントは遷移を握らなくなった。加えて Issue #510 で、タブが隠れたとき・
  // ページを離れるとき・アンマウント時に必ず保存が走るようになったので、
  // 「未保存のまま失う」経路そのものが無い。原則2（保存は常に自動）とも、
  // 移動のたびに保存を尋ねるモーダルは噛み合わない。
  // ブラウザの戻る/進む・タブを閉じる操作は useBrowserNavGuard + LeaveConfirmModal が担う。

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

  // パレットの操作。押せないものは非活性にして、理由はホバーで出す
  // （「あと何字」を常時表示しない代わり）。
  const paletteIcon = (children: React.ReactNode) => (
    <svg
      aria-hidden="true"
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );

  const paletteActions: PaletteAction[] = [
    {
      id: 'question',
      label: t('palette.link_question'),
      icon: paletteIcon(
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.4 9.4a2.6 2.6 0 0 1 4.6 1.6c0 1.7-2.4 2-2.4 3.4" />
          <circle cx="12" cy="17.2" r="0.6" fill="currentColor" stroke="none" />
        </>,
      ),
      onSelect: () => setQuestionChipOpen(true),
    },
    {
      id: 'voice',
      label: voiceActive ? t('toolbar.voice_stop') : t('toolbar.voice'),
      active: voiceActive,
      icon: paletteIcon(
        <>
          <rect x="9" y="2.5" width="6" height="11" rx="3" />
          <path d="M5 11v1a7 7 0 0 0 14 0v-1M12 20v2" />
        </>,
      ),
      onSelect: () => setVoiceActive((v) => !v),
    },
    {
      id: 'pickle',
      label: t('toolbar.pickle'),
      disabledReason: !content.trim() ? t('palette.pickle_needs_body') : undefined,
      icon: paletteIcon(
        <>
          <path d="M9 3h6M8 7h8l-.6 11a2 2 0 0 1-2 1.9H10.6a2 2 0 0 1-2-1.9L8 7Z" />
          <path d="M8.4 12c1.5-.8 2.6-.8 3.6 0s2.1.8 3.6 0" strokeOpacity=".55" />
        </>,
      ),
      onSelect: handlePickleClick,
    },
    {
      id: 'stats',
      label: t('palette.stats'),
      icon: paletteIcon(<path d="M5 20V14M12 20V5M19 20v-9" />),
      onSelect: () => setStatsOpen((v) => !v),
    },
    {
      id: 'fullscreen',
      label: t('toolbar.fullscreen'),
      icon: paletteIcon(<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />),
      onSelect: toggleFullscreen,
    },
  ];

  if (fermentationOverlayDetail) {
    paletteActions.push({
      id: 'fermentation',
      label: fermentSidebarOpen
        ? t('toolbar.fermentation_sidebar_hide')
        : t('toolbar.fermentation_sidebar_show'),
      active: fermentSidebarOpen,
      icon: paletteIcon(
        <>
          <path d="M9 3.75v3.75M15 3.75v3.75M7.5 7.5h9a1.5 1.5 0 0 1 1.5 1.5v9a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V9a1.5 1.5 0 0 1 1.5-1.5Z" />
          <path d="M9 12.75h6M9 15.75h4.5" />
        </>,
      ),
      onSelect: toggleFermentSidebar,
    });
  }

  // 書いている間はパレットも一緒に消す（ヘッダーや処理表示と同じ挙動）。
  // 常に出しておきたい人のために設定で切れる。
  const paletteVisible = settings.paletteAutoHide ? uiVisible : true;

  const isVertical = settings.writingMode === 'vertical';
  // タイトルの置き場。縦書きは本文（left:6% / width:79%）のすぐ右へ縦組みで、
  // 横書きは本文（px-[15%]）の上に、同じ左端から。
  //
  // 縦書きの題は**紙の右肩**に置く。本や原稿用紙と同じで、題は本文の始まりより外側に立つ。
  //
  // 本文は left:6% / width:79%（右端 = 85%）。題を本文にぴったり付けると、
  // 右側だけが大きく空いて題が宙に浮き、かつ本文と一体化して2列に見えてしまう。
  // 右端の余白（6%）を本文の左端と揃え、題と本文のあいだに 5% の間を取る。
  const titleBoxClass = isVertical
    ? 'absolute top-[4%] right-[6%] h-[86%] w-[6%] min-w-[3rem]'
    : 'absolute top-6 left-[15%] w-[70%]';
  // 横書きではタイトルが本文の真上に重なるので、本文側に**タイトルの実高さぶん**の
  // 上余白を空ける。文字サイズは設定で変わるため固定値では足りず、その都度計算する。
  //
  // 題と本文の**大きさの差**をはっきりつける（1.15 倍では差が読めず、ただの1行に見えた）。
  // 縦書きは題が本文の隣に立つので差が効く。横書きは見出しとして上に載るのでもう少し強く。
  const titleFontSize = Math.round(settings.fontSize * (isVertical ? 1.45 : 1.6));
  const titleReservedPx = Math.round(titleFontSize * 1.4) + 40;
  const titleTextStyle: React.CSSProperties = {
    fontSize: `${titleFontSize}px`,
    lineHeight: 1.4,
    fontFamily:
      settings.fontFamily === 'serif' ? "'Noto Serif JP', serif" : "'Noto Sans JP', sans-serif",
    writingMode: isVertical ? 'vertical-rl' : 'horizontal-tb',
    textOrientation: isVertical ? 'mixed' : undefined,
  };

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
      {/* ヘッダー。**区切り線は引かない**（Notion のように、紙とヘッダーを線で切らない）。
          左＝問い、右＝アクションコーナー ＋ 日付 ＋ 設定。
          「一覧」「新規エントリ」はサイドバーのメニューと重複するので置かない。 */}
      <div className={`flex items-center justify-between gap-6 px-6 py-4 ${fadeClass}`}>
        {/* 左: 問いを結ぶ。旧「新規エントリ」「一覧」があった位置。 */}
        <div className="flex min-w-0 items-center">
          <QuestionChip
            activeQuestions={activeQuestions}
            linkedQuestionIds={linkedIds}
            onLink={handleLink}
            onUnlink={handleUnlink}
            open={questionChipOpen}
            onOpenChange={setQuestionChipOpen}
          />
        </div>

        {/* 右: 日付 → 設定だけ。**操作はここに置かない**（フローティングのパレットへ移した）。 */}
        <div className="flex shrink-0 items-center gap-3">
          {/* 日付は設定ボタンのすぐ左に、小さく。 */}
          <span className="shrink-0 text-[12px] text-[var(--date-color)]">{dateStr}</span>

          {/* 設定。押すと真下にパネルが開く（背景は暗転しない・外側クリックで閉じる）。 */}
          <Popover
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            ariaLabel={t('settings.heading')}
            panelClassName="w-[19rem]"
            trigger={(triggerProps) => (
              <button
                type="button"
                {...triggerProps}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--date-color)] transition-colors hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]"
                data-tooltip={t('toolbar.settings')}
                aria-label={t('toolbar.settings')}
              >
                <svg
                  aria-hidden="true"
                  width={ICON_SIZE}
                  height={ICON_SIZE}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={ICON_STROKE_WIDTH}
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
            )}
          >
            <SettingsDrawer settings={settings} onChange={updateSettings} />
          </Popover>
        </div>
      </div>

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

      {/* 本文と発酵サイドバーを横に並べる（Issue #466）。本文の上には何も重ねない。
          Issue #350 は「基本 UI が透明化するのに発酵要素だけ残る」問題で、main では
          フローティング表示を fadeClass で包むことで直していた。ここでは表示先が
          サイドバーに変わっただけなので、同じ設定（focusModeFadesFermentation）を
          サイドバー側に適用して意図をそのまま引き継ぐ。 */}
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
            {/* タイトル。ヘッダーの小さな行から、本文の書き出しの隣へ移した。
                縦書きなら本文の右に空いている余白へ縦組みで、横書きなら本文の上へ。
                本文と同じ書体で、本文より一回り大きく置く。 */}
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                // IME 変換確定の Enter は無視する（日本語入力の途中で確定されてしまう）。
                if (e.nativeEvent.isComposing) return;
                if (e.key === 'Enter') {
                  e.preventDefault();
                  editorRef.current?.focus();
                }
              }}
              onBlur={commitTitleEdit}
              maxLength={100}
              placeholder={t('title.placeholder')}
              aria-label={t('title.placeholder')}
              className={`z-[12] border-none bg-transparent text-[var(--fg)] outline-none placeholder:text-[var(--date-color)] ${titleBoxClass}`}
              style={titleTextStyle}
            />

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
              className={`whitespace-pre-wrap bg-transparent focus:outline-none empty:before:text-zinc-400 empty:before:content-[attr(data-placeholder)] ${settings.writingMode === 'vertical' ? `absolute inset-0 after:block after:content-[''] after:w-[50vw]` : `min-h-full px-[15%] pb-6 after:block after:content-[''] after:h-[50vh]`}`}
              style={{
                // 横書きはタイトルが上に重なるので、その高さぶんを空ける（縦書きは横に並ぶので不要）。
                ...(settings.writingMode === 'vertical'
                  ? {}
                  : { paddingTop: `${titleReservedPx}px` }),
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

          {/* 音声入力が使えない環境の告知。ボタン自体はヘッダーのアクションコーナーへ移した。 */}
          {voiceState.unavailable && (
            <div className={`absolute right-6 bottom-6 z-[20] ${fadeClass}`}>
              <span
                className="rounded bg-[var(--bg)] px-2 py-1 text-xs text-red-500 shadow"
                role="status"
                data-testid="voice-unavailable-notice"
              >
                {voiceStatusMessage(voiceState.reason, t)}
              </span>
            </div>
          )}
        </div>

        {/* Issue #466: 発酵結果は本文に重ねず、右のサイドバーに集約する。
            Issue #350: フォーカスモードで基本 UI が消えるとき、発酵結果だけ残ると浮くので
            一緒に薄くする。切りたい人のために設定で外せる。 */}
        {fermentSidebarOpen && fermentationOverlayDetail && (
          <div className={settings.focusModeFadesFermentation ? fadeClass : undefined}>
            <FermentationSidebar
              detail={fermentationOverlayDetail}
              onClose={() => setFermentSidebarOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Stats popup */}
      <StatsPopup
        open={statsOpen}
        charCount={charCount}
        content={content}
        onClose={() => setStatsOpen(false)}
      />

      {/* 操作はすべてここに集める（問いを結ぶ・写真・音声・漬け込む・発酵・全画面）。
          本文に被らせないやり方は「場所を空ける」ではなく「振る舞い」で解く:
          書いている間は uiVisible が false になって一緒に消え、掴んで動かせ、畳める。 */}
      <EntryActionPalette actions={paletteActions} visible={paletteVisible} />

      {/* Status bar */}
      <div className={fadeClass}>
        <EditorStatusBar status={status} lastSavedAt={lastSavedAt} />
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
        }}
        onClose={() => setSaveModalOpen(false)}
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
