'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LandingPage } from '@/features/landing/components/landing-page';
import { getAccessToken, setTokens } from '@/lib/auth';

function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {};
  const stripped = hash.startsWith('#') ? hash.slice(1) : hash;
  for (const pair of stripped.split('&')) {
    const [key, value] = pair.split('=');
    if (key && value) {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  }
  return params;
}

export default function HomePage() {
  const router = useRouter();
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;

    // Handle Supabase email confirmation redirect (tokens in hash fragment)
    if (hash) {
      const params = parseHashParams(hash);
      const accessToken = params.access_token;
      const refreshToken = params.refresh_token;

      if (accessToken && refreshToken) {
        setTokens(accessToken, refreshToken);
        router.replace('/jar');
        return;
      }
    }

    if (getAccessToken()) {
      router.replace('/jar');
    } else {
      setShowLanding(true);
    }
  }, [router]);

  if (!showLanding) return null;
  return <LandingPage />;
}
