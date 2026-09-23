'use client';

import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { SIDE_PANEL_WIDTH } from '@/components/ui/surface';
import type { ApiClient } from '@/lib/api';
import { useHelpProgress } from './hooks/use-help-progress';
import { HELP_PANEL_ATTR, type HoverTarget, hoverTargetOf, isTypingTarget } from './hover';
import { currentHelpStep } from './tutorial';
import type { HelpTopicId, HelpTutorial } from './types';

/** ヘルプモードが有効か（アカウントの設定）。無ければ有効。 */
const ENABLED_KEY = 'oryzae-help-mode';
/** 面が開いているか。画面を移っても、読み込み直しても、開いたままにする。 */
const OPEN_KEY = 'oryzae-help-open';
/** 面の幅。掴んで変えた値を憶える。 */
const WIDTH_KEY = 'oryzae-help-width';

/** 面の幅の範囲（px）。既定は発酵の面と同じ。 */
/** SP のシートの高さ。「ようこそ」の沈みがこの上端で止まるので、両方が同じ値を見る。 */
export const SP_HELP_SHEET_HEIGHT = '82dvh';

export const HELP_WIDTH = { min: 280, max: 560, default: SIDE_PANEL_WIDTH } as const;

/**
 * 「何にも触れていない」に落とすまでの間。部品と部品の隙間を横切るたびに
 * 説明が消えては読めない。
 */
const HOVER_CLEAR_MS = 160;
/** 触れてからこれだけ止まったら映す。通り過ぎただけの物では 1 枚を変えない。 */
const HOVER_DWELL_MS = 450;

function sameTarget(a: HoverTarget, b: HoverTarget): boolean {
  return a.topic === b.topic && a.label === b.label;
}

/** 初めての人が面を閉じたあと、「?」が居場所を教えている時間。 */
const CUE_MS = 5000;

/** 手前に開いているメニュー・ダイアログがあるか（隠してあるものは数えない）。 */
function hasOpenLayer(): boolean {
  const layers = document.querySelectorAll<HTMLElement>(
    '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [aria-modal="true"]',
  );
  for (const layer of layers) {
    if (layer.hidden || layer.getAttribute('aria-hidden') === 'true') continue;
    if (layer.closest('[hidden], [inert]') !== null) continue;
    return true;
  }
  return false;
}

export interface HelpModeValue {
  /** ヘルプモード（設定）。無効なら「?」も出ず、`?` キーも効かない。 */
  enabled: boolean;
  open: boolean;
  /** 初めての人に自動で開いた回か。閉じたら「見た」と記録する。 */
  firstVisit: boolean;
  /** 初めての人が面を閉じた直後。「?」が脈打って居場所を教える。 */
  cue: boolean;
  /**
   * 初めての人に「ようこそ」を出しているか（面が開いていて、まだ晴らしていない）。
   * この間、面は三歩だけを明るくし、他を薄くする。
   */
  welcome: boolean;
  /**
   * 三歩の案内。`step` はいまの歩（全部済めば null）。開いている間は html に
   * `data-tutorial-step` が付き、画面の中の相手（`data-tutorial`）が同じ脈で灯る。
   */
  tutorial: HelpTutorial;
  /** 面の幅（px）。 */
  width: number;
  /** いま触れているもの。PC のポインタか、書斎の 3D の的から届く。 */
  hoverTarget: HoverTarget | null;
  /** 一覧の中で開いている話題。 */
  focused: HelpTopicId | null;
  query: string;
  setEnabled: (enabled: boolean) => void;
  /** 開く。設定が無効でも、開けと言われたら有効にして開く（設定の外からの入口）。 */
  openHelp: (topic?: HelpTopicId) => void;
  closeHelp: () => void;
  toggleHelp: () => void;
  /** 「ようこそ」を晴らす（始めてみよう）。面はそのまま。 */
  dismissWelcome: () => void;
  setWidth: (width: number) => void;
  /** 書斎の 3D の的のように、DOM を持たないものが「触れている」を伝える口。 */
  setHovered: (topic: HelpTopicId | null) => void;
  setFocused: (topic: HelpTopicId | null) => void;
  setQuery: (query: string) => void;
}

const noop = () => {};

/** Provider の外（テスト・孤立検証）では、閉じたままの何もしない値。 */
const DEFAULT: HelpModeValue = {
  enabled: false,
  open: false,
  firstVisit: false,
  cue: false,
  welcome: false,
  tutorial: { step: null, done: null },
  width: HELP_WIDTH.default,
  hoverTarget: null,
  focused: null,
  query: '',
  setEnabled: noop,
  openHelp: noop,
  closeHelp: noop,
  toggleHelp: noop,
  dismissWelcome: noop,
  setWidth: noop,
  setHovered: noop,
  setFocused: noop,
  setQuery: noop,
};

const HelpContext = createContext<HelpModeValue>(DEFAULT);

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 憶えられなくても、その場の操作は効く。
  }
}

export function clampHelpWidth(width: number): number {
  if (!Number.isFinite(width)) return HELP_WIDTH.default;
  return Math.round(Math.min(HELP_WIDTH.max, Math.max(HELP_WIDTH.min, width)));
}

/**
 * ヘルプモード（`docs/help-mode-guide.md`）。
 *
 * 初回のオンボーディング（4 段の紹介を順に進める画面）を置き換えたもの。あれは一度
 * 終えると戻れず、途中で試すこともできなかった。ヘルプは**モード**で、有効な間は画面の
 * 右上に「?」が居て、押すと右の面が開く。面は閉じてもまた同じ「?」から開ける。
 *
 * - 有効／無効はアカウントの設定（既定は有効）。localStorage に憶える
 * - 初めての人（`onboardingCompleted` が false）には面を開いた状態で始め、面以外を沈めて
 *   「ようこそ」を出す（`welcome`。伝えるのは案内の在処と「始めてみよう」だけ）。
 *   初めて閉じたときに「?」が脈打って居場所を教える。閉じたことを記録し、以後は自動で開かない
 * - 開閉と幅は localStorage に憶える。画面を移っても開いたまま
 * - `?` で開閉、`Esc` で閉じる（文字を打っている最中は効かない）
 * - 開いている間、画面の部品に触れると `data-help` か名前を読んで「触れているもの」を更新する。
 *   面の中に入ったら「触れていない」に戻る（画面の話題）
 */
export function HelpProvider({
  children,
  api,
}: {
  children: React.ReactNode;
  api: ApiClient | null;
}) {
  // 憶えていた設定を読むまでは null。true で始めると、切っている人にも「?」が一瞬出て、
  // 右端の fixed の層が 48px 動く。
  const [enabledState, setEnabledState] = useState<boolean | null>(null);
  const enabled = enabledState === true;
  const [open, setOpen] = useState(false);
  const [firstVisit, setFirstVisit] = useState(false);
  const [cue, setCue] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [width, setWidthState] = useState<number>(HELP_WIDTH.default);
  const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null);
  const [focused, setFocused] = useState<HelpTopicId | null>(null);
  const [query, setQuery] = useState('');
  const clearTimer = useRef<number | null>(null);
  const cueTimer = useRef<number | null>(null);

  const { firstVisit: isFirst, progress, markSeen } = useHelpProgress(api);
  const pathname = usePathname();

  // 憶えていたものを、マウント後に読む（SSR と最初の描画は既定で揃える）。
  useEffect(() => {
    const storedEnabled = readStored(ENABLED_KEY) !== '0';
    setEnabledState(storedEnabled);
    if (storedEnabled && readStored(OPEN_KEY) === '1') setOpen(true);
    const storedWidth = Number(readStored(WIDTH_KEY));
    if (storedWidth > 0) setWidthState(clampHelpWidth(storedWidth));
  }, []);

  const setEnabled = useCallback(
    (next: boolean) => {
      setEnabledState(next);
      writeStored(ENABLED_KEY, next ? '1' : '0');
      if (!next) {
        setOpen(false);
        writeStored(OPEN_KEY, '0');
        setHoverTarget(null);
        // 初めての人が × を押す前に切った。記録しておかないと、次の読み込みで自動で開いて
        // 設定まで有効に戻してしまう。
        if (firstVisit) {
          setFirstVisit(false);
          void markSeen();
        }
      }
    },
    [firstVisit, markSeen],
  );

  const openHelp = useCallback((topic?: HelpTopicId) => {
    setEnabledState(true);
    writeStored(ENABLED_KEY, '1');
    setOpen(true);
    writeStored(OPEN_KEY, '1');
    setQuery('');
    setCue(false);
    if (topic) setFocused(topic);
  }, []);

  // 初めての人には、確認が取れ次第 1 回だけ、開いた状態で始める。
  // 設定で切っている人には開かない（開くと有効に戻してしまう）— 見たことにして、以後は訊かない。
  const autoOpened = useRef(false);
  useEffect(() => {
    if (!isFirst || autoOpened.current || enabledState === null) return;
    autoOpened.current = true;
    if (!enabledState) {
      void markSeen();
      return;
    }
    setFirstVisit(true);
    openHelp();
  }, [isFirst, enabledState, openHelp, markSeen]);

  const closeHelp = useCallback(() => {
    setOpen(false);
    writeStored(OPEN_KEY, '0');
    setHoverTarget(null);
    if (!firstVisit) return;
    // 初めて閉じた。「?」が居場所を教え、以後は自動で開かない。
    setFirstVisit(false);
    setCue(true);
    if (cueTimer.current !== null) window.clearTimeout(cueTimer.current);
    cueTimer.current = window.setTimeout(() => {
      cueTimer.current = null;
      setCue(false);
    }, CUE_MS);
    void markSeen();
  }, [firstVisit, markSeen]);

  useEffect(
    () => () => {
      if (cueTimer.current !== null) window.clearTimeout(cueTimer.current);
    },
    [],
  );

  const toggleHelp = useCallback(() => {
    if (open) closeHelp();
    else openHelp();
  }, [open, closeHelp, openHelp]);

  // 「始めてみよう」で見たことにする。面は開いたまま画面を移れるので、閉じるまで待つと
  // 次の読み込みでまた「ようこそ」が出る。「?」の脈打ちは初めて閉じたときのまま（`firstVisit`
  // はここでは落とさない）。
  const dismissWelcome = useCallback(() => {
    setWelcomeDismissed(true);
    void markSeen();
  }, [markSeen]);
  const welcome = firstVisit && open && !welcomeDismissed;

  const setWidth = useCallback((next: number) => {
    const clamped = clampHelpWidth(next);
    setWidthState(clamped);
    writeStored(WIDTH_KEY, String(clamped));
  }, []);

  // 触れているものは、**少し止まってから**映す。通り過ぎた物では変えない — ポインタが物を
  // またぐたびに 1 枚が入れ替わると、何もしていないのに勝手に変わって見えて、注意を奪う。
  // 一度映したら次に止まるまでそのまま（隙間に出ても消さない）。消えるのは、面の中に
  // 入ったとき・画面を移ったとき・閉じたとき。
  const hoverRef = useRef<HoverTarget | null>(null);
  useEffect(() => {
    hoverRef.current = hoverTarget;
  }, [hoverTarget]);
  const dwellTimer = useRef<number | null>(null);
  const pending = useRef<HoverTarget | null>(null);
  const cancelDwell = useCallback(() => {
    if (dwellTimer.current !== null) {
      window.clearTimeout(dwellTimer.current);
      dwellTimer.current = null;
    }
    pending.current = null;
  }, []);
  const dwellOn = useCallback(
    (target: HoverTarget) => {
      const shown = hoverRef.current;
      if (shown && sameTarget(shown, target)) {
        cancelDwell();
        return;
      }
      if (pending.current && sameTarget(pending.current, target)) return;
      cancelDwell();
      pending.current = target;
      dwellTimer.current = window.setTimeout(() => {
        dwellTimer.current = null;
        pending.current = null;
        setHoverTarget(target);
      }, HOVER_DWELL_MS);
    },
    [cancelDwell],
  );
  const cancelClear = useCallback(() => {
    if (clearTimer.current !== null) {
      window.clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
  }, []);

  // 閉じている間は憶えない。書斎の的は開閉に関わらず触れを伝えてくるが、閉じた面のために
  // Provider の値を作り直して全部の読み手を描き直す理由は無い。
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  const setHovered = useCallback(
    (topic: HelpTopicId | null) => {
      if (!openRef.current) return;
      if (topic === null) {
        cancelDwell();
        return;
      }
      cancelClear();
      dwellOn({ topic, label: null });
    },
    [cancelDwell, cancelClear, dwellOn],
  );

  // 開いている間だけ、画面のどこに触れているかを読む。
  useEffect(() => {
    if (!open) return;
    function onPointerOver(event: PointerEvent) {
      const target = hoverTargetOf(event.target instanceof Element ? event.target : null);
      // 面の中に入ったら「何にも触れていない」扱い（少し待ってから）。面の隣の物
      // （瓶の画面の「問いの変遷」）を横切った直後に面へ入ると、その物の説明が
      // 面の中に居座っていた。生きている 1 枚はポインタの下を映す — 面の中は映さない。
      if (target === 'inside-panel') {
        cancelDwell();
        cancelClear();
        clearTimer.current = window.setTimeout(() => {
          clearTimer.current = null;
          setHoverTarget(null);
        }, HOVER_CLEAR_MS);
        return;
      }
      cancelClear();
      if (target === null) {
        cancelDwell();
        return;
      }
      dwellOn(target);
    }
    document.addEventListener('pointerover', onPointerOver, true);
    return () => {
      document.removeEventListener('pointerover', onPointerOver, true);
      cancelDwell();
      cancelClear();
    };
  }, [open, cancelDwell, cancelClear, dwellOn]);

  // 画面を移ったら「触れていない」に戻る（前の画面で止まっていた物の説明を持ち越さない）。
  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    cancelDwell();
    setHoverTarget(null);
  }, [pathname, cancelDwell]);

  // 三歩のいまの歩。開いている間だけ html に印を付け、画面の中の相手（`data-tutorial`）が
  // 同じ脈で灯る。閉じているときや設定で切っているときは灯らない — 案内を追っていない人の
  // 画面で、ボタンがいつまでも脈打つのは邪魔なだけ。
  const tutorialStep = currentHelpStep(progress);
  const tutorial = useMemo<HelpTutorial>(
    () => ({ step: tutorialStep, done: progress }),
    [tutorialStep, progress],
  );
  useEffect(() => {
    const root = document.documentElement;
    if (enabled && open && tutorialStep !== null) {
      root.setAttribute('data-tutorial-step', tutorialStep);
    } else {
      root.removeAttribute('data-tutorial-step');
    }
    return () => root.removeAttribute('data-tutorial-step');
  }, [enabled, open, tutorialStep]);

  // `?` で開閉、`Esc` で閉じる。設定で切っている人にはキーも効かない。
  // 日本語入力の変換中の `Esc`（変換の取り消し）は面の操作ではない。検索欄が文を消すために
  // 自分で処理した `Esc`（defaultPrevented）もここでは触らない。
  // 面の外で字を打っている最中や、手前にメニュー・ダイアログが開いているときの `Esc` は
  // そちらのもの（エディタの問いチップを Esc で畳んだら面まで閉じた）。面の中からなら閉じる。
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.key === '?' && enabled && !isTypingTarget(event.target)) {
        event.preventDefault();
        toggleHelp();
        return;
      }
      if (event.key !== 'Escape' || !open) return;
      const target = event.target;
      const inPanel = target instanceof Element && target.closest(`[${HELP_PANEL_ATTR}]`) !== null;
      if (!inPanel && (isTypingTarget(target) || hasOpenLayer())) return;
      closeHelp();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, open, toggleHelp, closeHelp]);

  const value = useMemo<HelpModeValue>(
    () => ({
      enabled,
      open,
      firstVisit,
      cue,
      welcome,
      tutorial,
      width,
      hoverTarget,
      focused,
      query,
      setEnabled,
      openHelp,
      closeHelp,
      toggleHelp,
      dismissWelcome,
      setWidth,
      setHovered,
      setFocused,
      setQuery,
    }),
    [
      enabled,
      open,
      firstVisit,
      cue,
      welcome,
      tutorial,
      width,
      hoverTarget,
      focused,
      query,
      setEnabled,
      openHelp,
      closeHelp,
      toggleHelp,
      dismissWelcome,
      setWidth,
      setHovered,
    ],
  );

  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

export function useHelpMode(): HelpModeValue {
  return useContext(HelpContext);
}
