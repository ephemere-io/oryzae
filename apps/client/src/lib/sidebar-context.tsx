'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** 畳んだ状態の幅（アイコンだけ）。アイコン48px + 左右16pxずつ。 */
const SIDEBAR_COLLAPSED_WIDTH = 80;
/** 開いた状態の既定幅（アイコン + メニュー名）。 */
const SIDEBAR_DEFAULT_WIDTH = 232;
/** 開いた状態で許す最小幅。これを下回るドラッグは「畳む」とみなす。 */
export const SIDEBAR_MIN_WIDTH = 176;
export const SIDEBAR_MAX_WIDTH = 360;

const COLLAPSED_KEY = 'oryzae-sidebar-collapsed';
const WIDTH_KEY = 'oryzae-sidebar-width';

interface SidebarContextValue {
  /** フォーカスモード等で一時的に消しているか（畳むとは別の軸）。 */
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  /** 開いているときの幅（ユーザーが引いて決めた値）。 */
  expandedWidth: number;
  setExpandedWidth: (width: number) => void;
  /** いま実際に占めている幅。レイアウトはこれだけを見る。 */
  width: number;
  /** localStorage の復元が済んだか。済むまで幅のアニメーションを掛けない。 */
  restored: boolean;
}

const SidebarContext = createContext<SidebarContextValue>({
  hidden: false,
  setHidden: () => {},
  collapsed: true,
  setCollapsed: () => {},
  expandedWidth: SIDEBAR_DEFAULT_WIDTH,
  setExpandedWidth: () => {},
  width: SIDEBAR_COLLAPSED_WIDTH,
  restored: false,
});

function clampWidth(value: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(value)));
}

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
  const [expandedWidth, setExpandedWidthState] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!persist) {
      setRestored(true);
      return;
    }
    try {
      const storedCollapsed = window.localStorage.getItem(COLLAPSED_KEY);
      if (storedCollapsed === 'true' || storedCollapsed === 'false') {
        setCollapsedState(storedCollapsed === 'true');
      }
      const storedWidth = Number(window.localStorage.getItem(WIDTH_KEY));
      if (Number.isFinite(storedWidth) && storedWidth > 0) {
        setExpandedWidthState(clampWidth(storedWidth));
      }
    } catch {
      // プライベートウィンドウ等で localStorage が使えないときは既定のまま。
    }
    setRestored(true);
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

  const setExpandedWidth = useCallback(
    (next: number) => {
      const clamped = clampWidth(next);
      setExpandedWidthState(clamped);
      if (!persist) return;
      try {
        window.localStorage.setItem(WIDTH_KEY, String(clamped));
      } catch {
        // 同上。
      }
    },
    [persist],
  );

  const value = useMemo(
    () => ({
      hidden,
      setHidden,
      collapsed,
      setCollapsed,
      expandedWidth,
      setExpandedWidth,
      width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : expandedWidth,
      restored,
    }),
    [hidden, setHidden, collapsed, setCollapsed, expandedWidth, setExpandedWidth, restored],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebarVisibility(): SidebarContextValue {
  return useContext(SidebarContext);
}
