'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '@/lib/api';
import type { OnboardingResult } from '../types';

interface OnboardingCompleteResult {
  /** ID of the question created during onboarding, or null if none */
  questionId: string | null;
}

interface UseOnboardingResult {
  shouldShow: boolean;
  loading: boolean;
  complete: (result: OnboardingResult) => Promise<OnboardingCompleteResult>;
}

export function useOnboarding(api: ApiClient | null): UseOnboardingResult {
  const [shouldShow, setShouldShow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;

    (async () => {
      const res = await api.fetch('/api/v1/users/me');
      if (cancelled) return;
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { onboardingCompleted: boolean };
      if (cancelled) return;
      setShouldShow(!data.onboardingCompleted);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [api]);

  const complete = useCallback(
    async (result: OnboardingResult): Promise<OnboardingCompleteResult> => {
      if (!api) return { questionId: null };

      let questionId: string | null = null;
      if (result.firstQuestion) {
        const res = await api.fetch('/api/v1/questions', {
          method: 'POST',
          body: JSON.stringify({ string: result.firstQuestion }),
        });
        if (res.ok) {
          const data = (await res.json()) as { id?: string };
          questionId = data.id ?? null;
        }
      }

      await api.fetch('/api/v1/users/me/onboarding', {
        method: 'PATCH',
        body: JSON.stringify({ completed: true }),
      });

      setShouldShow(false);
      return { questionId };
    },
    [api],
  );

  return { shouldShow, loading, complete };
}
