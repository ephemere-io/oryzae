'use client';

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
import { useHelpFirstVisit } from './hooks/use-help-first-visit';
import { type HoverTarget, hoverTargetOf, isTypingTarget } from './hover';
import type { HelpTopicId } from './types';

/** ヘルプモードが有効か（アカウントの設定）。無ければ有効。 */
const ENABLED_KEY = 'oryzae-help-mode';
/** 面が開いているか。画面を移っても、読み込み直しても、開いたままにする。 */
const OPEN_KEY = 'oryzae-help-open';
/** 面の幅。掴んで変えた値を憶える。 */
const WIDTH_KEY = 'oryzae-help-width';

/** 面の幅の範囲（px）。既定は発酵の面と同じ。 */
export const HELP_WIDTH = { min: 280, max: 560, default: SIDE_PANEL_WIDTH } as const;

/**
 * 「何にも触れていない」に落とすまでの間。部品と部品の隙間を横切るたびに
 * 説明が消えては読めない。
 */
const HOVER_CLEAR_MS = 160;

/** 初めての人が面を閉じたあと、「?」が居場所を教えている時間。 */
const CUE_MS = 5000;

export interface HelpModeValue {
  /** ヘルプモード（設定）。無効なら「?」も出ず、`?` キーも効かない。 */
  enabled: boolean;
  open: boolean;
  /** 初めての人に自動で開いた回か。閉じたら「見た」と記録する。 */
  firstVisit: boolean;
  /** 初めての人が面を閉じた直後。「?」が脈打って居場所を教える。 */
  cue: boolean;
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
  width: HELP_WIDTH.default,
  hoverTarget: null,
  focused: null,
  query: '',
  setEnabled: noop,
  openHelp: noop,
  closeHelp: noop,
  toggleHelp: noop,
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
 * - 初めての人（`onboardingCompleted` が false）には面を開いた状態で始め、初めて閉じた
 *   ときに「?」が脈打って居場所を教える。閉じたことを記録し、以後は自動で開かない
 * - 開閉と幅は localStorage に憶える。画面を移っても開いたまま
 * - `?` で開閉、`Esc` で閉じる（文字を打っている最中は効かない）
 * - 開いている間、画面の部品に触れると `data-help` か名前を読んで「触れているもの」を更新する
 */
export function HelpProvider({
  children,
  api,
}: {
  children: React.ReactNode;
  api: ApiClient | null;
}) {
  const [enabled, setEnabledState] = useState(true);
  const [open, setOpen] = useState(false);
  const [firstVisit, setFirstVisit] = useState(false);
  const [cue, setCue] = useState(false);
  const [width, setWidthState] = useState<number>(HELP_WIDTH.default);
  const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null);
  const [focused, setFocused] = useState<HelpTopicId | null>(null);
  const [query, setQuery] = useState('');
  const clearTimer = useRef<number | null>(null);
  const cueTimer = useRef<number | null>(null);

  const { firstVisit: isFirst, markSeen } = useHelpFirstVisit(api);

  // 憶えていたものを、マウント後に読む（SSR と最初の描画は既定で揃える）。
  useEffect(() => {
    const storedEnabled = readStored(ENABLED_KEY) !== '0';
    setEnabledState(storedEnabled);
    if (storedEnabled && readStored(OPEN_KEY) === '1') setOpen(true);
    const storedWidth = Number(readStored(WIDTH_KEY));
    if (storedWidth > 0) setWidthState(clampHelpWidth(storedWidth));
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    writeStored(ENABLED_KEY, next ? '1' : '0');
    if (!next) {
      setOpen(false);
      writeStored(OPEN_KEY, '0');
      setHoverTarget(null);
    }
  }, []);

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
  const autoOpened = useRef(false);
  useEffect(() => {
    if (!isFirst || autoOpened.current) return;
    autoOpened.current = true;
    setFirstVisit(true);
    openHelp();
  }, [isFirst, openHelp]);

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

  const setWidth = useCallback((next: number) => {
    const clamped = clampHelpWidth(next);
    setWidthState(clamped);
    writeStored(WIDTH_KEY, String(clamped));
  }, []);

  const setHovered = useCallback((topic: HelpTopicId | null) => {
    if (clearTimer.current !== null) {
      window.clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
    setHoverTarget(topic === null ? null : { topic, label: null });
  }, []);

  // 開いている間だけ、画面のどこに触れているかを読む。
  useEffect(() => {
    if (!open) return;
    function onPointerOver(event: PointerEvent) {
      const target = hoverTargetOf(event.target instanceof Element ? event.target : null);
      if (target === 'inside-panel') return;
      if (clearTimer.current !== null) {
        window.clearTimeout(clearTimer.current);
        clearTimer.current = null;
      }
      if (target !== null) {
        setHoverTarget((prev) =>
          prev && prev.topic === target.topic && prev.label === target.label ? prev : target,
        );
        return;
      }
      // 隙間に出ただけなら少し待つ。次の部品に入れば、この待ちは取り消される。
      clearTimer.current = window.setTimeout(() => {
        clearTimer.current = null;
        setHoverTarget(null);
      }, HOVER_CLEAR_MS);
    }
    document.addEventListener('pointerover', onPointerOver, true);
    return () => {
      document.removeEventListener('pointerover', onPointerOver, true);
      if (clearTimer.current !== null) {
        window.clearTimeout(clearTimer.current);
        clearTimer.current = null;
      }
    };
  }, [open]);

  // `?` で開閉、`Esc` で閉じる。設定で切っている人にはキーも効かない。
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key === '?' && enabled && !isTypingTarget(event.target)) {
        event.preventDefault();
        toggleHelp();
        return;
      }
      if (event.key === 'Escape' && open) closeHelp();
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
      width,
      hoverTarget,
      focused,
      query,
      setEnabled,
      openHelp,
      closeHelp,
      toggleHelp,
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
      width,
      hoverTarget,
      focused,
      query,
      setEnabled,
      openHelp,
      closeHelp,
      toggleHelp,
      setWidth,
      setHovered,
    ],
  );

  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

export function useHelpMode(): HelpModeValue {
  return useContext(HelpContext);
}
