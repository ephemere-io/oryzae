'use client';

// verify-exempt: localStorage トークン処理と認証リダイレクトのみを行う非描画ゲート（router/storage 依存でシーム不可）。

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getAccessToken, setTokens } from '@/lib/auth';
import { DOCS_SITE_URL } from '@/lib/docs-site';

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

/**
 * ルート（/）のクライアント専用ゲート。描画は持たず（null）、副作用のみ:
 * - Supabase のメール確認リダイレクト（hash に access/refresh token）を受けてログイン状態にする
 * - 既ログインなら /entries/new へ送る
 * - どちらでもない訪問者は公開サイト（別ドメイン）へ送る
 *
 * ランディングは別リポジトリの公開サイトに移したため、ここは本文を持たない。
 * 未ログイン訪問者を送り出す先が別オリジンなので、next/router ではなく
 * `window.location.replace` を使う。
 */
export function HomeGate() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = parseHashParams(hash);
      const accessToken = params.access_token;
      const refreshToken = params.refresh_token;
      if (accessToken && refreshToken) {
        setTokens(accessToken, refreshToken);
        router.replace('/entries/new');
        return;
      }
    }
    if (getAccessToken()) {
      router.replace('/entries/new');
      return;
    }
    window.location.replace(DOCS_SITE_URL);
  }, [router]);

  return null;
}
