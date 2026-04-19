'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/** Fixed glass-morphism sidebar width (px) */
export const SIDEBAR_WIDTH = 80;

interface SidebarVisibilityContextValue {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}

const SidebarVisibilityContext = createContext<SidebarVisibilityContextValue>({
  hidden: false,
  setHidden: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHiddenState] = useState(false);
  const setHidden = useCallback((next: boolean) => setHiddenState(next), []);
  const value = useMemo(() => ({ hidden, setHidden }), [hidden, setHidden]);
  return (
    <SidebarVisibilityContext.Provider value={value}>{children}</SidebarVisibilityContext.Provider>
  );
}

export function useSidebarVisibility(): SidebarVisibilityContextValue {
  return useContext(SidebarVisibilityContext);
}
