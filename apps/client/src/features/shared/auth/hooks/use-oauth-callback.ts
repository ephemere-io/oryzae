'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { AuthFlowError, AuthSession } from '@/features/shared/auth/types';
import { createApiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/**
 * OAuth コールバックの確定処理（端末非依存）。
 *
 * Issue #490: もともと `app/(auth)/callback/page.tsx` が API を直叩きしていた。
 * page は「エラーコードを i18n で描く」だけにし、通信とセッション確定はここに閉じる。
 *
 * 2つのフローを扱う:
 * - PKCE: クエリの `code` を `/oauth/callback` に渡す
 * - implicit: URL ハッシュのトークンを保存し `/oauth/finalize` で profile 作成・枠チェック
 *   （Issue #307: Supabase JS の既定が implicit のため Google SSO 新規はこちらを通る。
 *   呼ばないと profile が作られず、初回のヘルプも出ない）
 */

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

function isSupportedLocale(value: string | null): value is 'ja' | 'en' {
  return value === 'ja' || value === 'en';
}

/** 409 + capacity_reached だけは専用の文言を出すため区別する。 */
async function classifyFailure(res: Response): Promise<AuthFlowError> {
  const body: unknown = await res.json().catch(() => ({}));
  const error =
    typeof body === 'object' && body !== null && 'error' in body ? body.error : undefined;
  return res.status === 409 && error === 'capacity_reached' ? 'capacity_reached' : 'auth_failed';
}

/**
 * 2フローで必要な形が違うので型ガードを分ける。
 * - implicit: トークンは URL ハッシュから取るので、レスポンスは `user` だけあればよい
 * - PKCE: レスポンスの `session` からトークンを取り出すので `session` まで必須
 * 分けずに緩い方（user だけ）で PKCE を通すと、`session` を欠くレスポンスで
 * `data.session.accessToken` が TypeError になり、useEffect 内の未処理 rejection として
 * 握り潰されて `setError` にも到達しない（画面が「認証中…」のまま固まる）。
 */
function isAuthUser(value: unknown): value is Pick<AuthSession, 'user'> {
  if (typeof value !== 'object' || value === null) return false;
  if (!('user' in value) || typeof value.user !== 'object' || value.user === null) return false;
  return 'id' in value.user && typeof value.user.id === 'string';
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!isAuthUser(value)) return false;
  if (!('session' in value) || typeof value.session !== 'object' || value.session === null) {
    return false;
  }
  const { session } = value;
  if (!('accessToken' in session) || typeof session.accessToken !== 'string') return false;
  return 'refreshToken' in session && typeof session.refreshToken === 'string';
}

export function useOauthCallback(
  /**
   * `/` へ読み込み直す**直前**に待つもの（認証画面の扉を開けて入る演出）。
   * 行き先を受け取り、解決したら移る。失敗しても移る — 演出のために入口を塞がない。
   */
  beforeLeave?: (destination: string) => Promise<void>,
): { error: AuthFlowError | null } {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { adoptSession } = useAuth();
  const [error, setError] = useState<AuthFlowError | null>(null);
  // effect を searchParams だけで回すため、関数は ref で読む（毎描画で新しい参照になりうる）。
  const beforeLeaveRef = useRef(beforeLeave);
  beforeLeaveRef.current = beforeLeave;
  const adoptRef = useRef(adoptSession);
  adoptRef.current = adoptSession;
  const pushRef = useRef(router.push);
  pushRef.current = router.push;

  useEffect(() => {
    async function handleCallback() {
      const localeParam = searchParams.get('locale');
      const locale = isSupportedLocale(localeParam) ? localeParam : undefined;

      // ── PKCE フロー: code がクエリにある ──
      const code = searchParams.get('code');
      if (code) {
        const res = await createApiClient().fetch('/api/v1/auth/oauth/callback', {
          method: 'POST',
          body: JSON.stringify({ code, locale }),
        });
        if (!res.ok) {
          setError(await classifyFailure(res));
          return;
        }
        const data: unknown = await res.json();
        if (!isAuthSession(data)) {
          setError('auth_failed');
          return;
        }
        // 文脈に載せる。載れば読み込み直さずに入れる（`AuthContextValue.adoptSession`）。
        const adopted = adoptRef.current(data);
        await finish(beforeLeaveRef.current, adopted ? pushRef.current : null);
        return;
      }

      // ── implicit フロー: トークンが URL ハッシュにある ──
      const params = parseHashParams(window.location.hash);
      const accessToken = params.access_token;
      const refreshToken = params.refresh_token;
      if (accessToken && refreshToken) {
        const tokens = { accessToken, refreshToken };
        // profile 作成・枠チェックのため、まずこのトークンで呼ぶ。
        const res = await createApiClient(accessToken).fetch('/api/v1/auth/oauth/finalize', {
          method: 'POST',
          body: JSON.stringify({ locale }),
        });
        if (!res.ok) {
          setError(await classifyFailure(res));
          return;
        }
        const data: unknown = await res.json();
        const adopted = adoptRef.current(data, tokens);
        await finish(beforeLeaveRef.current, adopted ? pushRef.current : null);
        return;
      }

      setError('no_code');
    }

    handleCallback();
  }, [searchParams]);

  return { error };
}

const HOME = '/';

/**
 * 扉を開けて入ってから、書斎へ移る。
 *
 * **文脈に載せられたならアプリ内遷移**（`push`）。以前は必ず読み込み直していた —
 * `router.push` だと root の AuthProvider が再マウントされず `restoreSession` も走らないため、
 * 保存したトークンを認証コンテキストが読めず `/login` に弾かれていた（#363 の回帰修正）。
 * いまは `adoptSession` がその場で文脈に載せるので、読み込み直す理由が無い。載せられ
 * なかったとき（応答の形が違う）だけ、従来どおり読み込み直して復元に任せる。
 *
 * 行き先を `/entries/new` と書かず `/` にするのは、ホームがどこかを知っているのが
 * `/`（書斎。止めていれば `/entries/new` へ送る）1 か所だから。
 */
async function finish(
  beforeLeave?: (destination: string) => Promise<void>,
  push?: ((destination: string) => void) | null,
): Promise<void> {
  await beforeLeave?.(HOME).catch(() => undefined);
  if (push) push(HOME);
  else window.location.assign(HOME);
}
