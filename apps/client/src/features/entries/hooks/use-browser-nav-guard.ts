'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Intercepts browser back/forward navigation while `enabled` is true.
 *
 * Strategy: on mount, push a duplicate history entry (sentinel) so the first
 * back press pops the sentinel instead of leaving. When popstate fires, we
 * re-push the sentinel to pin the user in place and open a confirmation
 * modal. On confirm, we skip the interceptor and call history.go(-2) to
 * unwind both the sentinel and the entry the user originally tried to leave.
 */
export function useBrowserNavGuard(enabled: boolean) {
  const [open, setOpen] = useState(false);
  const skipNextRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const pinnedUrl = window.location.href;
    window.history.pushState(null, '', pinnedUrl);

    const handler = () => {
      if (skipNextRef.current) {
        skipNextRef.current = false;
        return;
      }
      window.history.pushState(null, '', pinnedUrl);
      setOpen(true);
    };

    window.addEventListener('popstate', handler);
    return () => {
      window.removeEventListener('popstate', handler);
    };
  }, [enabled]);

  const cancel = useCallback(() => {
    setOpen(false);
  }, []);

  const confirm = useCallback(() => {
    setOpen(false);
    skipNextRef.current = true;
    window.history.go(-2);
  }, []);

  return { open, cancel, confirm };
}
