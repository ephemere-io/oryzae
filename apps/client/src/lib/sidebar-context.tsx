'use client';

import { createContext, useContext, useState } from 'react';

// ── Constants ──────────────────────────────────────────────────────────────────

export const COLLAPSED_WIDTH = 56; // px (w-14)
export const EXPANDED_WIDTH = 200; // px

// ── Context ────────────────────────────────────────────────────────────────────

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
  const toggle = () => setExpanded((prev) => !prev);

  return <SidebarContext value={{ expanded, toggle }}>{children}</SidebarContext>;
}
