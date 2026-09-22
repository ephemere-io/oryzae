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
import type { ApiClient } from '@/lib/api';
import { useHelpFirstVisit } from './hooks/use-help-first-visit';
import { type HoverTarget, hoverTargetOf, isTypingTarget } from './hover';
import type { HelpTopicId } from './types';

/** 開いているかを憶えておく鍵。画面を移っても、読み込み直しても、開いたままにする。 */
const OPEN_KEY = 'oryzae-help-open';

/**
 * 「何にも触れていない」に落とすまでの間。部品と部品の隙間を横切るたびに
 * 説明が消えては読めない。
 */
const HOVER_CLEAR_MS = 160;

export interface HelpModeValue {
  open: boolean;
  /** 初めての人に自動で開いた回か。閉じたら「見た」と記録する。 */
  firstVisit: boolean;
  /** いま触れているもの。PC のポインタか、書斎の 3D の的から届く。 */
  hoverTarget: HoverTarget | null;
  /** 面の中で開いている話題。 */
  focused: HelpTopicId | null;
  query: string;
  openHelp: (topic?: HelpTopicId) => void;
  closeHelp: () => void;
  toggleHelp: () => void;
  /** 書斎の 3D の的のように、DOM を持たないものが「触れている」を伝える口。 */
  setHovered: (topic: HelpTopicId | null) => void;
  setFocused: (topic: HelpTopicId | null) => void;
  setQuery: (query: string) => void;
}

const noop = () => {};

/** Provider の外（テスト・孤立検証）では、閉じたままの何もしない値。 */
const DEFAULT: HelpModeValue = {
  open: false,
  firstVisit: false,
  hoverTarget: null,
  focused: null,
  query: '',
  openHelp: noop,
  closeHelp: noop,
  toggleHelp: noop,
  setHovered: noop,
  setFocused: noop,
  setQuery: noop,
};

const HelpContext = createContext<HelpModeValue>(DEFAULT);

function readStoredOpen(): boolean {
  try {
    return window.localStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStoredOpen(open: boolean): void {
  try {
    window.localStorage.setItem(OPEN_KEY, open ? '1' : '0');
  } catch {
    // 憶えられなくても、その場の開閉は効く。
  }
}

/**
 * ヘルプモード（`docs/help-mode-guide.md`）。
 *
 * 初回のオンボーディング（4 段の紹介を順に進める画面）を置き換えたもの。あれは一度
 * 終えると戻れず、途中で試すこともできなかった。ヘルプは**モード**で、開いている間は
 * 画面をそのまま触れる。触れたものの説明が面に出て、閉じてもまた開ける。
 *
 * - 初めての人（`onboardingCompleted` が false）には自動で開く。閉じたら記録する
 * - 開閉は localStorage に憶える。画面を移っても開いたまま
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
  const [open, setOpen] = useState(false);
  const [firstVisit, setFirstVisit] = useState(false);
  const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null);
  const [focused, setFocused] = useState<HelpTopicId | null>(null);
  const [query, setQuery] = useState('');
  const clearTimer = useRef<number | null>(null);

  const { firstVisit: isFirst, markSeen } = useHelpFirstVisit(api);

  // 憶えていた開閉を、マウント後に読む（SSR と最初の描画は閉じたままで揃える）。
  useEffect(() => {
    if (readStoredOpen()) setOpen(true);
  }, []);

  const openHelp = useCallback((topic?: HelpTopicId) => {
    setOpen(true);
    writeStoredOpen(true);
    setQuery('');
    if (topic) setFocused(topic);
  }, []);

  // 初めての人には、確認が取れ次第 1 回だけ開く。最初の話題（Oryzae とは）を開いた状態で。
  const autoOpened = useRef(false);
  useEffect(() => {
    if (!isFirst || autoOpened.current) return;
    autoOpened.current = true;
    setFirstVisit(true);
    openHelp('concept');
  }, [isFirst, openHelp]);

  const closeHelp = useCallback(() => {
    setOpen(false);
    writeStoredOpen(false);
    setHoverTarget(null);
    if (firstVisit) {
      setFirstVisit(false);
      void markSeen();
    }
  }, [firstVisit, markSeen]);

  const toggleHelp = useCallback(() => {
    if (open) closeHelp();
    else openHelp();
  }, [open, closeHelp, openHelp]);

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

  // `?` で開閉、`Esc` で閉じる。
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key === '?' && !isTypingTarget(event.target)) {
        event.preventDefault();
        toggleHelp();
        return;
      }
      if (event.key === 'Escape' && open) closeHelp();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, toggleHelp, closeHelp]);

  const value = useMemo<HelpModeValue>(
    () => ({
      open,
      firstVisit,
      hoverTarget,
      focused,
      query,
      openHelp,
      closeHelp,
      toggleHelp,
      setHovered,
      setFocused,
      setQuery,
    }),
    [open, firstVisit, hoverTarget, focused, query, openHelp, closeHelp, toggleHelp, setHovered],
  );

  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

export function useHelpMode(): HelpModeValue {
  return useContext(HelpContext);
}
