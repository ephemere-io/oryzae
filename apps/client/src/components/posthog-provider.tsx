'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { Suspense, useEffect } from 'react';
import { initPostHog } from '@/lib/posthog';

const posthogClient = initPostHog();

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname;
      const search = searchParams.toString();
      if (search) {
        url = `${url}?${search}`;
      }
      posthog.capture('$pageview', { $current_url: url });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthogClient}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}
