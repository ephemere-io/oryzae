import posthog from 'posthog-js';

export function initPostHog() {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      // 自ドメインの `/ingest/*` rewrite 経由で送信し、広告ブロッカーによる
      // posthog.com への直接遮断 (#225) を回避する。rewrite は
      // `apps/client/next.config.ts` で定義。
      api_host: '/ingest',
      // Toolbar から "View in PostHog" 等で遷移するときの UI URL。
      ui_host: 'https://us.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: true,
    });
  }
  return posthog;
}
