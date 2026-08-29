'use client';

// verify-exempt: localStorage トークン処理と認証リダイレクトのみを行う非描画ゲート（router/storage 依存でシーム不可）。

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
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

/**
 * ホーム画面から起動された（＝ブラウザの UI を持たない）状態か。
 *
 * Issue #437: PWA から開いたのにランディングが出てしまうため、この判定でアプリ側へ送る。
 * iOS Safari は display-mode を長く実装せず `navigator.standalone`（非標準）でしか
 * 判定できないので、両方を見る。
 */
function isStandaloneLaunch(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  const legacyFlag: unknown = Reflect.get(window.navigator, 'standalone');
  return legacyFlag === true;
}

/**
 * ランディング（/）のクライアント専用ゲート。描画は持たず（null）、副作用のみ:
 * - Supabase のメール確認リダイレクト（hash に access/refresh token）を受けてログイン状態にする
 * - 既ログインなら /entries/new へ送る
 * - PWA として起動されていれば、未ログインでもランディングではなくログイン画面へ送る
 *
 * ランディング本文は SSR で常に描画する（SEO）。ログイン者はこのゲートが直後に
 * リダイレクトするため、本文が見えるのは一瞬。
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

    const loggedIn = Boolean(getAccessToken());
    if (loggedIn) {
      router.replace('/entries/new');
      return;
    }
    // Issue #437: manifest の start_url は直したが、既にホーム画面に置かれている
    // ショートカットは古い start_url（＝ランディング）のまま起動する。ここでも受ける。
    // ブラウザで開いた未ログイン訪問者にはランディングを見せる（SEO と導線のため）。
    if (isStandaloneLaunch()) {
      router.replace('/login');
    }
  }, [router]);

  return null;
}
