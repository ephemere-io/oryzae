'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

/**
 * アカウント設定から見るお知らせメールの購読状態 (Issue #614)。
 *
 * 現在値は `GET /api/v1/users/me` から読む。**メール内のリンクからも同じ列が
 * 変わる**ので、画面側の状態だけを信じず毎回サーバーに聞く（メールで止めたのに
 * 設定画面では「受け取る」に見える、が起きないようにする）。
 */
interface State {
  /** 現在値。読み込み中は null。 */
  optOut: boolean | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

function readOptOut(body: unknown): boolean | null {
  if (typeof body !== 'object' || body === null) return null;
  if (!('newsletterOptOut' in body)) return null;
  const value = body.newsletterOptOut;
  return typeof value === 'boolean' ? value : null;
}

export function useNewsletterSubscription() {
  const [state, setState] = useState<State>({
    optOut: null,
    loading: true,
    saving: false,
    error: null,
  });

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    let cancelled = false;
    (async () => {
      const res = await createApiClient(token).fetch('/api/v1/users/me');
      if (cancelled) return;

      const optOut = res.ok ? readOptOut(await res.json().catch(() => null)) : null;
      setState((s) => ({ ...s, optOut, loading: false }));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setOptOut = useCallback(async (next: boolean) => {
    const token = getAccessToken();
    if (!token) return;

    setState((s) => ({ ...s, saving: true, error: null }));

    const res = await createApiClient(token).fetch('/api/v1/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ newsletterOptOut: next }),
    });

    if (res.ok) {
      setState((s) => ({ ...s, optOut: next, saving: false }));
      return;
    }

    // 失敗したら値を動かさない。トグルだけ動いて保存されていない状態が
    // いちばん困る（「止めたつもりが届く」）。
    setState((s) => ({ ...s, saving: false, error: 'failed' }));
  }, []);

  return { ...state, setOptOut };
}
