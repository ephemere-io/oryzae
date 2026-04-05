'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const COLLAPSED_WIDTH = 56;
export const EXPANDED_WIDTH = 200;

interface SidebarContextValue {
  expanded: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  expanded: false,
  toggle: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((prev) => !prev), []);

  // Keyboard shortcut: Cmd+B / Ctrl+B
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  return <SidebarContext value={{ expanded, toggle }}>{children}</SidebarContext>;
}
