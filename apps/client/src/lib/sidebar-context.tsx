'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** 畳んだ状態の幅（アイコンだけ）。アイコン48px + 左右16pxずつ。 */
const SIDEBAR_COLLAPSED_WIDTH = 80;
/** 開いた状態の幅（アイコン + メニュー名）。 */
const SIDEBAR_EXPANDED_WIDTH = 240;

const COLLAPSED_KEY = 'oryzae-sidebar-collapsed';

/**
 * 幅を配る CSS 変数。**サイドバー・本文の左余白・エディタの左端が、この1本だけを見る。**
 *
 * 以前は React の state を各所へ px で配っていた。開閉のたびに画面全体（本文の折返しを
 * 含む）が再描画され、3者が別々のタイミングで動いて見えた。変数を1つ根に置いて CSS に
 * 配らせれば、状態が変わっても再描画は1回で済み、3者が同じフレームで動く
 * （shadcn のサイドバーと同じ作り）。
 */
const SIDEBAR_WIDTH_VAR = '--sidebar-width';

function applySidebarWidth(width: number): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty(SIDEBAR_WIDTH_VAR, `${width}px`);
}

interface SidebarContextValue {
  /** フォーカスモード等で一時的に消しているか（畳むとは別の軸）。 */
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  /** いま占めている幅。契約に出すために持つ（レイアウトは CSS 変数のほうを見る）。 */
  width: number;
}

const SidebarContext = createContext<SidebarContextValue>({
  hidden: false,
  setHidden: () => {},
  collapsed: true,
  setCollapsed: () => {},
  width: SIDEBAR_COLLAPSED_WIDTH,
});

/**
 * サイドバーの開閉。
 *
 * **開くか畳むかの2状態だけ**にしてある。掴んで幅を変えられるようにもしていたが、
 * 「掴めるはずの縁が掴めない」「畳むとまた掴めない」「本文が指に遅れて付いてくる」と
 * 不具合が続いた。中間の幅に意味がある画面ではないので、状態そのものを減らした
 * （shadcn のサイドバーも expanded / icon の2状態しか持たない）。
 */
export function SidebarProvider({
  children,
  initialCollapsed = true,
  /**
   * localStorage への保存と復元を行うか（既定 true）。
   * 孤立検証（verify）では fixture をまたいで値が漏れるため false にする。
   */
  persist = true,
}: {
  children: React.ReactNode;
  initialCollapsed?: boolean;
  persist?: boolean;
}) {
  const [hidden, setHiddenState] = useState(false);
  // SSR と最初の描画は既定値で揃える。localStorage はマウント後に読む
  // （初期値として読むと、サーバーの出力と食い違って hydration が壊れる）。
  const [collapsed, setCollapsedState] = useState(initialCollapsed);

  useEffect(() => {
    if (!persist) return;
    try {
      const stored = window.localStorage.getItem(COLLAPSED_KEY);
      if (stored === 'true' || stored === 'false') setCollapsedState(stored === 'true');
    } catch {
      // プライベートウィンドウ等で localStorage が使えないときは既定のまま。
    }
  }, [persist]);

  const setHidden = useCallback((next: boolean) => setHiddenState(next), []);

  const setCollapsed = useCallback(
    (next: boolean) => {
      setCollapsedState(next);
      if (!persist) return;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // 保存できなくても操作自体は通す。
      }
    },
    [persist],
  );

  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;
  useEffect(() => {
    applySidebarWidth(width);
  }, [width]);

  const value = useMemo(
    () => ({ hidden, setHidden, collapsed, setCollapsed, width }),
    [hidden, setHidden, collapsed, setCollapsed, width],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebarVisibility(): SidebarContextValue {
  return useContext(SidebarContext);
}
