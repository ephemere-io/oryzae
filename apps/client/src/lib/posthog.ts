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
      // 日記の本文を PostHog に載せない（docs/security-guide.md）。
      // autocapture はクリックした要素の文字を拾い、セッション録画は画面の文字と
      // 通信の本文を記録できる。録画を PostHog 側で有効にしても本文が映らないよう、
      // こちらで先に塞いでおく（プロジェクト設定だけに頼ると、誰かが ON にした瞬間に漏れる）。
      mask_all_text: true,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '*',
        recordBody: false,
        recordHeaders: false,
      },
    });
  }
  return posthog;
}
