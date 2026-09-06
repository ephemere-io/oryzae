'use client';

import type { EditorEffectsState } from '@oryzae/shared';
import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Popover } from '@/components/ui/popover';
import {
  CONTROL_FONT,
  ICON_SIZE,
  ICON_STROKE_WIDTH,
  paletteScale,
  SHELL_INSET,
  SHELL_ROW_HEIGHT,
} from '@/components/ui/surface';
import {
  type EditorStatus,
  EditorStatusBar,
} from '@/features/pc/entries/components/editor-status-bar';
import {
  EntryActionPalette,
  type PaletteAction,
} from '@/features/pc/entries/components/entry-action-palette';
import {
  FermentationSidebar,
  type SidebarQuestion,
} from '@/features/pc/entries/components/fermentation-sidebar';
import { LeaveConfirmModal } from '@/features/pc/entries/components/leave-confirm-modal';
import { LinkQuestionNudgeModal } from '@/features/pc/entries/components/link-question-nudge-modal';
import { PickleConfirmModal } from '@/features/pc/entries/components/pickle-confirm-modal';
import { PickleNudgeModal } from '@/features/pc/entries/components/pickle-nudge-modal';
import { QuestionChip } from '@/features/pc/entries/components/question-chip';
import { QuestionSelectModal } from '@/features/pc/entries/components/question-select-modal';
import { SaveTitleModal } from '@/features/pc/entries/components/save-title-modal';
import { SettingsDrawer } from '@/features/pc/entries/components/settings-drawer';
import { SnippetToolbar } from '@/features/pc/entries/components/snippet-toolbar';
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
import { caretRangeFromPoint } from '@/features/pc/entries/utils/caret-from-point';
import {
  loadCachedEffects,
  saveCachedEffects,
} from '@/features/pc/entries/utils/editor-effects-cache';
import {
  applyTextSpansToEditor,
  extractEditorEffects,
} from '@/features/pc/entries/utils/editor-effects-codec';
import { formatEntryDate } from '@/features/pc/entries/utils/format-entry-date';
import { measureTitle } from '@/features/pc/entries/utils/title-metrics';
import { useAutosaveEntry } from '@/features/shared/entries/hooks/use-autosave-entry';
import { useSaveEntry } from '@/features/shared/entries/hooks/use-entry';
import { useFermentationForQuestion } from '@/features/shared/fermentation/hooks/use-fermentation-for-question';
import { useCreateQuestion } from '@/features/shared/questions/hooks/use-create-question';
import { useUserMe } from '@/features/shared/user/hooks/use-user-me';
import type { ApiClient } from '@/lib/api';
import { useSidebarVisibility } from '@/lib/sidebar-context';

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

/**
 * 縦書きのとき、題の右にとる余白と、題と本文のあいだの間。
 *
 * 以前は題を右端から 32px に置き、本文の右端は 85%（％指定）だったため、
 * **右の余白 32px に対して題と本文のあいだが 117px** と逆転していた。
 * 紙の右肩に題が乗っているのではなく、題だけが宙に浮いて見える。
 * 両方を px で持ち、本文の右端をここから逆算する。
 */
const TITLE_RIGHT_MARGIN = 64;

/** 横書きの題の上に取る余白。題は上端から置き、この分だけ内側へ下げる。 */
/**
 * 紙の上端から1行目（＝題）までの余白。
 *
 * 横書きの題は**紙の1行目**なので、上に載る帯ではなく本文と同じ流れの中にある。
 * 書き出しの前に息を置くための余白。
 *
 * ヘッダーがすでに 78px（上下の余白 + 行の高さ）を使っているので、ここに大きな数字を
 * 置くと題が紙の真ん中まで落ちる。ヘッダーと題は**同じ紙の上端**にあるものとして扱う。
 */
const PAGE_TOP_INSET = 32;
const TITLE_TO_BODY_GAP = 24;

/**
 * 題の筋（縦書きなら桁、横書きなら行）1本ぶんの太さ。字の何倍か。
 *
 * **箱の太さと行の高さが同じ数字を見る**のが肝要。以前は箱が 1.6 倍・行が 1.4 倍で、
 * その差 0.2 倍 × 筋の数が、そのまま題と本文のあいだの空きになって現れていた
 * （筋が増えるほど広がる＝「長く打つと余白が入る」）。
 *
 * 字の幅ぎりぎり（1.0）にしないのは、日本語入力の変換候補がキャレットの脇に開けず
 * 字へ重なるため。
 */
const TITLE_LINE_BOX = 1.6;

/**
 * 描画の前に測るための effect。
 *
 * 題の箱は**中身を測ってから**決めるので、描かれたあとに測ると1フレーム遅れ、
 * 打つたびに箱が跳ねて見える。SSR では layout effect が使えないので、そこだけ逃がす
 * （エディタは mount 後にしか描かれないため実害は無いが、検証ページは SSR される）。
 */
const useMeasureEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * 題に打てる長さの上限。
 *
 * 制限そのものが目的ではない（一度は外した）。だが**上限が無いと見切れる**——
 * 3筋に収める規則がある以上、字を下限まで落としてもなお入らない長さが必ず存在する。
 * 見切れた題は端的に美しくないので、そこへ辿り着けないようにする。
 *
 * 60 字は「標準的な画面（桁の高さ 588px）で 3 筋に 27px で収まる長さ」。本文と同じ
 * 32px よりは小さくなるが、読める大きさは保てる。題としても十分に長い。
 */
const TITLE_MAX_LENGTH = 60;

/**
 * 残り字数を出し始める距離。
 *
 * 常に出しておくと、書く前から数を意識させることになる（題は書き手のもので、
 * 入力欄のものではない）。**打ち止めが見えてきてから**そっと言う。
 */
const TITLE_REMAINING_THRESHOLD = 15;

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
  const isVertical = settings.writingMode === 'vertical';
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
  const [voiceActive, setVoiceActive] = useState(false);
  const [fadeLeft, setFadeLeft] = useState(false);
  // 末尾側だけでなく**先頭側**も切れる。右がぶつ切りだと「まだ続いている」ことが
  // 伝わらず、いま紙のどこにいるのかを見失う。
  const [fadeRight, setFadeRight] = useState(false);
  // 縦書きの題が使える桁の高さ（実測）。題の字の大きさを字数から決めるのに要る。
  const [editorAreaHeight, setEditorAreaHeight] = useState(0);
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

  // Issue #329 → #466: 紐付けた問いに発酵結果があれば、右のサイドバーに出す。
  //
  // 以前は**新規エントリだけ**に限っていた（執筆中の判断材料という位置づけだった）。
  // だが一覧から既存のエントリを開くと、パレットの発酵ボタンが理由もなく死んだままになる。
  // 書き足すときにも前回の発酵結果は読みたいので、新旧を問わず結んだ問いから引く。
  // 面が見せるのは**問い1つぶん**の発酵。問いは複数結べるので、どれを見るかは面の中で選ぶ。
  // 選んでいた問いを外したときは、残っている先頭へ落とす（外した問いの結果を出したままに
  // しない、が第一。選び直しを促して手を止めるほどのことではない）。
  const linkedQuestionList: SidebarQuestion[] = Array.from(linkedIds).map((id) => ({
    id,
    text:
      activeQuestions.find((q) => q.id === id)?.currentText ??
      t('fermentation_sidebar.question_unnamed'),
  }));
  const [pickedFermentQuestionId, setPickedFermentQuestionId] = useState<string | null>(null);
  const selectedFermentQuestionId =
    pickedFermentQuestionId && linkedIds.has(pickedFermentQuestionId)
      ? pickedFermentQuestionId
      : (Array.from(linkedIds)[0] ?? null);
  const { detail: fermentationOverlayDetail, loading: fermentationLoading } =
    useFermentationForQuestion(api, selectedFermentQuestionId ?? undefined);
  // 発酵結果は**閉じた状態で始まり、パレットの操作でだけ開く**。
  // 以前はエントリーを開いた瞬間に「出しますか？」と訊いていたが、書きに来た人の手を
  // いきなり止める問いだった。出したいときに出せるなら、訊く必要がない。
  const [fermentSidebarOpen, setFermentSidebarOpen] = useState(false);
  useEffect(() => {
    // 問いを外した／別の問いに移ったら、前の発酵結果を出したままにしない。
    if (!fermentationOverlayDetail) setFermentSidebarOpen(false);
  }, [fermentationOverlayDetail]);
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
  const editorRef = useRef<HTMLDivElement>(null);
  // 横書きでスクロールする外枠（縦書きでは editor 自身がスクローラ）。Issue #364。
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const ghostLayerRef = useRef<HTMLDivElement>(null);
  const traceCanvasRef = useRef<HTMLCanvasElement>(null);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);

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
    leaveConfirmOpen;
  const uiVisible = useFocusMode({
    enabled: settings.focusModeEnabled,
    forceVisible: anyOverlayOpen,
    editorRef,
  });
  const fadeClass = `transition-opacity duration-300 ${
    uiVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
  }`;

  // 左端は CSS 変数（--sidebar-width）が配る。掴んで引いている間も再描画が起きない。
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

  // 本文領域の高さを測る（縦書きの題は、この高さに収まる大きさで組む）。
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    function measure() {
      const box = scrollContainerRef.current;
      if (box) setEditorAreaHeight(box.clientHeight);
    }
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Track scroll position of editor to show/hide end-side fade overlay
  useEffect(() => {
    // 縦書きは本文自身がスクローラ、横書きは外枠。**どちらにも掛ける**——
    // 切れている端が見えないと、紙のどこにいるのか分からなくなる。
    const el = isVertical ? editorRef.current : scrollContainerRef.current;
    if (!el) {
      setFadeLeft(false);
      setFadeRight(false);
      return;
    }
    function updateFade() {
      if (!el) return;
      if (isVertical) {
        const { scrollLeft, scrollWidth, clientWidth } = el;
        const maxScroll = scrollWidth - clientWidth;
        // vertical-rl: 先頭（右端）で scrollLeft=0、左へ進むと負。
        // 末尾側（左）は、まだ最後まで来ていないときに掛ける。
        setFadeLeft(maxScroll > 5 && Math.abs(scrollLeft) < maxScroll - 5);
        // 先頭側（右）は、書き出しから離れたときに掛ける。**左だけフェードして右が
        // ぶつ切り**だと、右にまだ続いていることが伝わらない。
        setFadeRight(Math.abs(scrollLeft) > 5);
        return;
      }
      const { scrollTop, scrollHeight, clientHeight } = el;
      const maxScroll = scrollHeight - clientHeight;
      // 横書きは上下。末尾側（下）と先頭側（上）に、縦書きと同じ扱いで掛ける。
      setFadeLeft(maxScroll > 5 && scrollTop < maxScroll - 5);
      setFadeRight(scrollTop > 5);
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
  }, [isVertical]);

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

  /**
   * いま全画面かどうか。**自分で持たず、ブラウザに訊く。**
   *
   * 全画面は押した結果とは限らない——Esc・F11・OS 側の操作でも入るし抜ける。
   * 自前の boolean を持つと、そこで抜けたときにアイコンだけが取り残されて
   * 「戻る道具が見当たらない」状態になる。
   */
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    function sync() {
      setIsFullscreen(document.fullscreenElement !== null);
    }
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      // 拒否されうる（すでに抜けている等）。落とさずに諦める。
      void document.exitFullscreen().catch(() => {});
    } else {
      void document.documentElement.requestFullscreen().catch(() => {});
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

  // 題は**動かさない**。読み進めても消さない。
  //
  // 一度は本文と一緒に流して消していた（「いま文章のどこにいるか分からない」への対応）。
  // だが消してみると、今度は**何のエントリーを書いているのかという大文脈**が失われた。
  // 位置の手がかりは本文の側（末尾の余白・端のフェード）で示せるが、
  // 題は他のどこにも出ていないので、ここから消すと戻る先が無くなる。

  // パレットの操作。押せないものは非活性にして、理由はホバーで出す
  // （「あと何字」を常時表示しない代わり）。
  // アイコンもボタンと一緒に大きくする。ボタンだけ大きくすると、道具が太っただけに見える。
  const paletteIconSize = paletteScale(settings.paletteSize).icon;
  const paletteIcon = (children: React.ReactNode) => (
    <svg
      aria-hidden="true"
      width={paletteIconSize}
      height={paletteIconSize}
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

  // パレットは**本文に対してすることだけ**を持つ（声で書く・漬け込む・広く見る）。
  // 「問いを結ぶ」はここに置かない。エントリーの身元（日付・問い）はヘッダーが持ち、
  // 同じ操作の入口が2か所にあると、どちらが本体か分からなくなる。
  const paletteActions: PaletteAction[] = [
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
      id: 'fullscreen',
      // **同じボタンが逆のことをするなら、見た目も逆にする。** 入るときは外向きの矢、
      // 出るときは内向きの矢。名前も一緒に変える（読み上げも同じ道を通る）。
      label: isFullscreen ? t('toolbar.fullscreen_exit') : t('toolbar.fullscreen'),
      icon: paletteIcon(
        isFullscreen ? (
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        ) : (
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        ),
      ),
      onSelect: toggleFullscreen,
    },
  ];

  // 発酵結果の出し入れは**常にここに置く**。出せるものが無いときだけ非活性にして、
  // 理由をホバーで言う。押せるときだけ現れる作りだと、そもそもこの操作があることに
  // 気づけない（「パレットに発酵の表示切替が無い」と言われた）。
  //
  // 面は問いを紐づけていれば開ける（中身が無ければ「まだ発酵していません」と言う）。
  // 押せないのは、開く先そのものが無いとき＝問いを紐づけていないときだけ。
  const fermentationReason =
    linkedIds.size === 0 ? t('palette.fermentation_needs_question') : undefined;

  paletteActions.push({
    id: 'fermentation',
    label: fermentSidebarOpen
      ? t('toolbar.fermentation_sidebar_hide')
      : t('toolbar.fermentation_sidebar_show'),
    active: fermentSidebarOpen,
    disabledReason: fermentationReason,
    icon: paletteIcon(
      <>
        <path d="M9 3.75v3.75M15 3.75v3.75M7.5 7.5h9a1.5 1.5 0 0 1 1.5 1.5v9a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V9a1.5 1.5 0 0 1 1.5-1.5Z" />
        <path d="M9 12.75h6M9 15.75h4.5" />
      </>,
    ),
    onSelect: toggleFermentSidebar,
  });

  // 書いている間はパレットも一緒に消す（ヘッダーや処理表示と同じ挙動）。
  // 常に出しておきたい人のために設定で切れる。
  const paletteVisible = settings.paletteAutoHide ? uiVisible : true;

  // 横書きの左右余白。**ヘッダーと同じ縦の線**に乗せる（SHELL_INSET の倍）。
  // 以前は px-[15%] で、1512px の画面だと本文の左端が 295px、「問いを結ぶ」の左端が
  // 104px と、同じ画面の中で2本の別の縦線が立っていた。ここを1本に揃える。
  const gutterPx = SHELL_INSET * 2;
  // 縦書きの題が使える桁の高さ。字の大きさを字数から決めるのに要る。
  // 測れないうち（初回描画・jsdom）は画面高からの概算に倒す。
  const titleColumnHeightPx = editorAreaHeight * 0.86;
  // 1行の長さの上限。日本語は 30〜40 字で読みやすさが頭打ちになるので 34 字で切る
  // （文字サイズを上げても行が伸び続けないよう、px ではなく文字数で持つ）。
  const measurePx = settings.fontSize * 34;

  /**
   * 横書きの紙の列。**題と本文が同じ1本の列に乗る**。
   *
   * 左端に寄せていたので、広い画面では右に何も無い帯が残り、紙が左に片寄って見えた。
   * 読む場所は目の正面にあるほうがよいので、余った幅は左右へ等しく配る。
   */
  const horizontalColumnStyle: React.CSSProperties = {
    maxWidth: `${measurePx + gutterPx * 2}px`,
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingLeft: `${gutterPx}px`,
    paddingRight: `${gutterPx}px`,
  };

  // タイトルの置き場。縦書きは本文（left:6% / width:79%）のすぐ右へ縦組みで、
  // 横書きは本文の上に、**本文と同じ左端から**。
  //
  // 縦書きの題は**紙の右肩**に置く。本や原稿用紙と同じで、題は本文の始まりより外側に立つ。
  //
  // 題の右余白と、題と本文のあいだの間は px で持つ（TITLE_RIGHT_MARGIN /
  // TITLE_TO_BODY_GAP）。本文の右端はそこから逆算する。
  // 横書きの題は**上端から**置く（余白は padding で作る）。top を空けると、その隙間を
  // 本文が通り抜けて題の上に文字が覗く。
  const titleBoxClass = isVertical ? 'absolute top-[4%]' : 'block';
  // 横書きではタイトルが本文の真上に重なるので、本文側に**タイトルの実高さぶん**の
  // 上余白を空ける。文字サイズは設定で変わるため固定値では足りず、その都度計算する。
  //
  // 題と本文の**大きさの差**をはっきりつける（1.15 倍では差が読めず、ただの1行に見えた）。
  // 縦書きは題が本文の隣に立つので差が効く。横書きは見出しとして上に載るのでもう少し強く。
  //
  // **長い題ほど小さくする。** 固定倍率だと、長い題が桁からはみ出して見切れた。
  // 箱の長さは「いま見えている文字」で決める。空のときに中身の 0 文字で組むと、
  // **置き文字（「タイトルを入力」）が1文字ぶんの箱に閉じ込められて「タ」しか出ない**。
  const titlePlaceholder = t('title.placeholder');
  const titleLength = Math.max(title.length || titlePlaceholder.length, 1);
  // **縦書きも横書きも同じ規則で組む。** 筋（縦書きなら桁、横書きなら行）を最大3本まで
  // 増やし、それでも入らなければ字を落とす。決めるのは utils/title-metrics。
  // 字数に上限は設けない——題の長さは書き手が決めることで、入力欄が決めることではない。
  //
  // 1筋に使える長さは、縦書きなら桁の高さ、横書きなら1行の幅。
  const titleLineLength = isVertical ? titleColumnHeightPx : measurePx;
  const titleMetrics = measureTitle({
    length: titleLength,
    // 横書きの題は見出しとして本文の上に載るので、一回り大きいところから始める。
    baseFontSize: isVertical ? settings.fontSize : Math.round(settings.fontSize * 1.3),
    lineLength: titleLineLength,
  });
  const titleFontSize = titleMetrics.fontSize;
  const titleLines = titleMetrics.lines;
  const titleLineBoxPx = Math.round(titleFontSize * TITLE_LINE_BOX);

  /**
   * 題が実際に占めた厚み。**予測ではなく測る。**
   *
   * 「1筋に何字入るか」の見積もりは必ずどこかでずれる（半角混じり・約物・書体差）。
   * ずれて筋を1本多く数えると、その1本ぶんが丸ごと題と本文のあいだの空きになって出る。
   * 箱をいったん 0 にして中身の広がりを読めば、折り返しは実物そのものなので
   * ずれようがない——**題がどれだけ長くても、本文との間は常に同じ**になる。
   */
  const [measuredTitleThicknessPx, setMeasuredTitleThicknessPx] = useState(0);
  useMeasureEffect(() => {
    const el = titleInputRef.current;
    if (!el) return;
    if (isVertical) {
      const prev = el.style.width;
      el.style.width = '0px';
      const next = el.scrollWidth;
      el.style.width = prev;
      setMeasuredTitleThicknessPx(next);
      return;
    }
    const prev = el.style.height;
    el.style.height = '0px';
    const next = el.scrollHeight;
    el.style.height = prev;
    setMeasuredTitleThicknessPx(next);
  }, [title, titlePlaceholder, titleFontSize, titleLineLength, isVertical, settings.fontFamily]);

  // 測る前の1回（初回描画）だけ見積もりに倒す。跳ねないよう、同じ係数から出す。
  const titleThicknessPx = measuredTitleThicknessPx || titleLineBoxPx * titleLines;
  // 何筋使ったかも測った厚みから逆算する（見積もりの筋数はここでは使わない）。
  const titleLinesUsed = Math.max(1, Math.round(titleThicknessPx / titleLineBoxPx));
  // **箱は中身に合わせる。** 筋の長さを丸ごと取っていたので、3文字の題でも
  // 画面いっぱいの箱を占めていた。
  //
  // ただし縮めるのは**1筋のあいだだけ**。筋の数で均等に割ると、折り返した瞬間に
  // 長さが半分になって厚みが倍になり、題が飛び跳ねて見える（「急に2行目になる」）。
  // 2筋目に入ったら開いているぶん全部を使う——紙と同じで、1筋目を最後まで書き切ってから
  // 次の筋へ移る。そうすれば折り返しで動くのは厚みだけになる。
  const titleUsedLengthPx =
    titleLinesUsed === 1
      ? Math.min(titleLineLength, titleLength * titleFontSize + Math.round(titleFontSize * 0.6))
      : titleLineLength;
  const titleTextStyle: React.CSSProperties = {
    ...(isVertical
      ? {
          width: `${titleThicknessPx}px`,
          height: `${titleUsedLengthPx}px`,
          right: `${TITLE_RIGHT_MARGIN}px`,
        }
      : {
          // 横書きの題は**行いっぱい**を占める。文字の幅ぶんだけにすると、その横を
          // 本文が同じ高さで流れて見える。
          width: '100%',
          height: `${titleThicknessPx}px`,
          // 流れの中にいるので、下を本文が通らない。地を敷く必要がなくなった。
          background: 'transparent',
        }),
    fontSize: `${titleFontSize}px`,
    // 箱の太さと同じ数字。ずれるとその差が題と本文のあいだの空きになる。
    lineHeight: TITLE_LINE_BOX,
    fontFamily:
      settings.fontFamily === 'serif' ? "'Noto Serif JP', serif" : "'Noto Sans JP', sans-serif",
    writingMode: isVertical ? 'vertical-rl' : 'horizontal-tb',
    textOrientation: isVertical ? 'mixed' : undefined,
  };

  /**
   * 題。**置き場所は書字方向で変わる**。
   *
   * 縦書き … スクローラの外に立てる。本文自身が横スクローラなので、中に入れると
   *          本文と一緒に流れてしまう。紙の右肩に据え置く。
   * 横書き … Notion と同じで、**紙の1行目として本文と一緒に上へ流れる**。
   *          据え置くと、読み進めた先でも題が上を占め続け、そのぶん紙が狭くなる。
   *
   * **textarea であって input ではない。** input は1行しか持てないので、長い題を
   * 折り返せず、縮めるか見切れるかの二択になる。
   */
  // 残りは**上限の手前に来たときだけ**言う。0 になってから初めて打てなくなるより、
  // 近づいていることが先に見えているほうが、書き手は言葉を選び直せる。
  //
  // **題から手が離れたら消す。** 打ち止めが近いことは打っている本人にだけ要る話で、
  // 読み返しているときに残っていると、ただの余計な数字になる。
  const [titleFocused, setTitleFocused] = useState(false);
  const titleRemaining = TITLE_MAX_LENGTH - title.length;
  const showTitleRemaining = titleFocused && titleRemaining <= TITLE_REMAINING_THRESHOLD;
  const titleRemainingLabel = t('title.remaining', { count: titleRemaining });

  const titleField = (
    <textarea
      ref={titleInputRef}
      rows={1}
      // 上限は「3筋に、本文と同じ大きさで収まる長さ」から導く。恣意的な数字では
      // なく**紙が受け取れる量**そのものなので、ここを超えると必ず見切れる。
      maxLength={TITLE_MAX_LENGTH}
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
      onFocus={() => setTitleFocused(true)}
      onBlur={() => {
        setTitleFocused(false);
        commitTitleEdit();
      }}
      placeholder={titlePlaceholder}
      aria-label={t('title.placeholder')}
      className={`z-[12] resize-none overflow-hidden border-none text-[var(--fg)] outline-none placeholder:text-[var(--date-color)] ${titleBoxClass}`}
      style={{ background: 'var(--bg)', ...titleTextStyle }}
    />
  );

  return (
    <div
      className="sidebar-anchored fixed top-0 right-0 bottom-0 z-50 flex bg-[var(--bg)]"
      {...verifyAttrs({
        unit: 'EntryEditor',
        hasEntry: !!entryId,
        hasBody: content.trim().length > 0,
        settingsOpen,
        saveModalOpen,
        questionSelectOpen,
      })}
    >
      {/* 紙の側（ヘッダー + 本文）。発酵の面はこの列の**外**に並べる——中に入れると
          ヘッダーの下からしか始まらず、画面の縦いっぱいに立たない。 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ヘッダー。**区切り線は引かない**（Notion のように、紙とヘッダーを線で切らない）。
          左＝問い、右＝アクションコーナー ＋ 日付 ＋ 設定。
          「一覧」「新規エントリ」はサイドバーのメニューと重複するので置かない。 */}
        <div
          className={`flex items-center justify-between gap-6 ${fadeClass}`}
          style={{
            paddingTop: SHELL_INSET,
            paddingBottom: SHELL_INSET / 2,
            // 左右は本文と同じ縦の線に乗せる（gutterPx）。ヘッダーと本文で
            // 別の数字を使うと、同じ画面に2本の縦線が立つ。
            paddingLeft: gutterPx,
            paddingRight: gutterPx,
          }}
        >
          {/* 左: 問いを結ぶ。行の高さはサイドバーの項目と同じ 48px にして、
            チップの中心が瓶アイコンの中心と同じ線に乗るようにする。 */}
          {/* flex-1 が要る。**基準幅が中身のままだと縮まず**、結ばれた問いが増えたぶん
              そのまま右へはみ出して、日付や設定の下に潜り込む。 */}
          <div className="flex min-w-0 flex-1 items-center" style={{ height: SHELL_ROW_HEIGHT }}>
            <QuestionChip
              activeQuestions={activeQuestions}
              linkedQuestionIds={linkedIds}
              onLink={handleLink}
              onUnlink={handleUnlink}
            />
          </div>

          {/* 右: 日付 → 設定だけ。**操作はここに置かない**（フローティングのパレットへ移した）。 */}
          <div className="flex shrink-0 items-center gap-3" style={{ height: SHELL_ROW_HEIGHT }}>
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
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--date-color)] transition-colors hover:bg-[var(--hover-wash)] hover:text-[var(--fg)]"
                  data-tooltip={t('toolbar.settings')}
                  // 画面の一番上にあるボタンなので、既定の「上に出す」だと窓の外へ切れる。
                  data-tooltip-pos="bottom"
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
          className="sidebar-anchored pointer-events-none fixed top-0 right-0 bottom-0 z-[51] overflow-hidden"
        />

        {/* 本文と発酵サイドバーを横に並べる（Issue #466）。本文の上には何も重ねない。 */}
        <div className="flex min-h-0 flex-1">
          {/* Editor area — outer wrapper (no overflow) holds fade overlay; inner div scrolls */}
          <div className="relative flex-1">
            {/* End-side fade for vertical mode — appears only when content is clipped at the end */}
            {/* 切れている端に掛ける半透明。**両端とも**掛けて、そちらにまだ続いていることを
                伝える（片側だけだと、ぶつ切りの側で場所の感覚を見失う）。
                縦書きは左右、横書きは上下。 */}
            {fadeLeft && (
              <div
                className="pointer-events-none absolute z-[10] transition-opacity duration-300"
                style={
                  isVertical
                    ? {
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '18%',
                        background: 'linear-gradient(to right, var(--bg), transparent)',
                      }
                    : {
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: '14%',
                        background: 'linear-gradient(to top, var(--bg), transparent)',
                      }
                }
              />
            )}
            {fadeRight && (
              <div
                className="pointer-events-none absolute z-[10] transition-opacity duration-300"
                style={
                  isVertical
                    ? {
                        // 本文の右端に合わせて置く。題より内側なので、題は薄くならない。
                        right: `${TITLE_RIGHT_MARGIN + titleThicknessPx + TITLE_TO_BODY_GAP}px`,
                        top: 0,
                        bottom: 0,
                        width: '12%',
                        background: 'linear-gradient(to left, var(--bg), transparent)',
                      }
                    : {
                        // 題も一緒に流れるので、帯は紙の上端に置く。
                        left: 0,
                        right: 0,
                        top: 0,
                        height: '8%',
                        background: 'linear-gradient(to bottom, var(--bg), transparent)',
                      }
                }
              />
            )}
            {isVertical && titleField}
            {isVertical && showTitleRemaining && (
              <span
                className="pointer-events-none absolute z-[12] whitespace-nowrap text-[11px] text-[var(--date-color)]"
                style={{
                  // **1文字目の右上。** 題の真下に置くと、本文との間合いに割り込んで
                  // 題が本文から離れて見える。桁の始まりのすぐ上、右端で揃える。
                  right: `${TITLE_RIGHT_MARGIN}px`,
                  top: 'calc(4% - 18px)',
                  ...CONTROL_FONT,
                }}
              >
                {titleRemainingLabel}
              </span>
            )}

            <div
              ref={scrollContainerRef}
              className={`absolute inset-0 ${settings.writingMode === 'vertical' ? 'overflow-x-auto overflow-y-hidden' : 'overflow-auto'}`}
            >
              {/* Snippet selection toolbar */}
              <SnippetToolbar editorRef={editorRef} api={api} />

              {/* Eraser trace canvas — position/size set by useEraserTrace to overlay the editor box exactly */}
              <canvas ref={traceCanvasRef} className="pointer-events-none absolute z-[1]" />

              {/* 横書きの題は本文と同じ列に乗せ、一緒に上へ流す。 */}
              {!isVertical && (
                <div
                  className="relative"
                  style={{
                    ...horizontalColumnStyle,
                    paddingTop: `${PAGE_TOP_INSET}px`,
                    paddingBottom: `${TITLE_TO_BODY_GAP}px`,
                  }}
                >
                  {/* **題の1行目の右上。** 題の下に置くと、その高さぶん本文が押し下げられ、
                      題と本文の間合いが広がってしまう。流れから外して上に逃がす。 */}
                  {showTitleRemaining && (
                    <span
                      className="pointer-events-none absolute whitespace-nowrap text-[11px] text-[var(--date-color)]"
                      style={{
                        right: `${gutterPx}px`,
                        top: `${PAGE_TOP_INSET - 18}px`,
                        ...CONTROL_FONT,
                      }}
                    >
                      {titleRemainingLabel}
                    </span>
                  )}
                  {titleField}
                </div>
              )}

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
                // ドロップを受け付ける宣言。**これが無いと drop は発火しない**
                // （dragover の既定動作がドロップを拒否する）。
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes('text/plain')) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }}
                // 発酵の面から言葉を引き込む経路（キーワード・断片のドラッグ）。
                // **ブラウザ任せの drop では state が置いていかれる**——paste と同じ理由で、
                // DOM だけが変わって content が古いまま残り、自動保存が変化に気づかない。
                // 落ちる位置はブラウザのキャレットに従い、挿入と同期はこちらで持つ。
                onDrop={(e) => {
                  const text = e.dataTransfer.getData('text/plain');
                  if (!text) return;
                  e.preventDefault();
                  // 落とした場所に入れる。API 名がブラウザで割れているので utils を通す。
                  const dropped = caretRangeFromPoint(e.clientX, e.clientY);
                  if (dropped && editorRef.current?.contains(dropped.startContainer)) {
                    const selection = window.getSelection();
                    selection?.removeAllRanges();
                    selection?.addRange(dropped);
                  }
                  editorRef.current?.focus();
                  document.execCommand('insertText', false, text);
                  const updated = editorRef.current?.innerText ?? '';
                  setContent(updated);
                  if (status === 'saved') setStatus('editing');
                }}
                data-placeholder={t('placeholder')}
                // Issue #207: 縦書きと同じく横書きにも末尾へ半画面ぶんの余白を置く。
                // 最後の行が画面の下端に貼りついたままにならず、キャレットが中央に留まれる（#364）。
                className={`whitespace-pre-wrap bg-transparent focus:outline-none empty:before:text-zinc-400 empty:before:content-[attr(data-placeholder)] ${settings.writingMode === 'vertical' ? `absolute inset-0 after:block after:content-[''] after:w-[50vw]` : `pb-6 after:block after:content-[''] after:h-[50vh]`}`}
                style={{
                  // 横書きはタイトルが上に重なるので、その高さぶんを空ける（縦書きは横に並ぶので不要）。
                  ...(settings.writingMode === 'vertical' ? {} : horizontalColumnStyle),
                  ...(settings.writingMode === 'vertical'
                    ? {
                        left: '6%',
                        top: '4%',
                        // 右端は題から逆算する。％で置くと、題の右余白との釣り合いが
                        // 画面幅ごとに変わってしまう。
                        right: `${TITLE_RIGHT_MARGIN + titleThicknessPx + TITLE_TO_BODY_GAP}px`,
                        height: '86%',
                        position: 'absolute',
                        overflowX: 'auto',
                      }
                    : {}),
                  fontSize: `${settings.fontSize}px`,
                  lineHeight: settings.lineHeight,
                  writingMode:
                    settings.writingMode === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
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
        </div>
      </div>

      {/* Issue #466: 発酵結果は本文に重ねず、右の面に集約する。
          面は**画面の縦いっぱい**に立てる（ヘッダーの下から始めない）。
          余計なラッパーで包まないこと——包むと中身ぶんの高さしか持たない。 */}
      {/* **問いを紐づけていれば必ず縁を出す。** 発酵結果があるときだけ現れる作りだと、
          開閉できる面があること自体に気づけない（結果が無い＝面ごと存在しない、に見える）。
          中身が無いときは開いた先で「まだ発酵していません」と言う。
          畳んでいるときも縁は残す（開き直す場所が画面の反対側だけだと遠い）。 */}
      {linkedIds.size > 0 && (
        <FermentationSidebar
          detail={fermentationOverlayDetail}
          questions={linkedQuestionList}
          selectedQuestionId={selectedFermentQuestionId}
          onSelectQuestion={setPickedFermentQuestionId}
          loading={fermentationLoading}
          collapsed={!fermentSidebarOpen}
          onToggle={() => setFermentSidebarOpen((v) => !v)}
        />
      )}

      {/* 操作はすべてここに集める（問いを結ぶ・写真・音声・漬け込む・発酵・全画面）。
          本文に被らせないやり方は「場所を空ける」ではなく「振る舞い」で解く:
          書いている間は uiVisible が false になって一緒に消え、掴んで動かせ、畳める。 */}
      <EntryActionPalette
        actions={paletteActions}
        visible={paletteVisible}
        size={settings.paletteSize}
      />

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
    </div>
  );
}
