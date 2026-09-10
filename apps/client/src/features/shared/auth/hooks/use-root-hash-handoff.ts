'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { setTokens } from '@/lib/auth';

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
 * ルート（`/`）に届いたメールリンクの hash を、**ログインへ送る判断より先に**読む。
 *
 * 以前は `/` が振り分けだけのゲート（`HomeGate`）で、保護レイアウトの外にあった。
 * `/` が書斎そのもの（保護ルート）になったので、hash の扱いは保護レイアウトが引き継ぐ。
 * hash はサーバーに送られないので、ブラウザでしか読めない。
 *
 * - トークン（`#access_token=…&refresh_token=…`）… 保存して**読み込み直す**。
 *   認証（`AuthProvider`）はマウント時にしか復元しないので、読み込み直さないと
 *   「未ログイン」のままログイン画面へ送られる。読み込み直すと hash も消える
 * - エラー（期限切れ・使用済みリンク。`#error=…&error_code=…`）… 確認画面へ回して理由を
 *   見せる。**この分岐を消さないこと** — 無いと「トークンも無い・ログインもしていない」
 *   としてログイン画面へ流れ、リンクが切れていた事実を知る術がなくなる
 *
 * @param enabled いま `/` を開いているか（他の画面の hash は読まない）。
 * @returns 引き継ぎ中か。true の間、呼び出し側はログイン画面へ送らないこと。
 */
export function useRootHashHandoff(enabled: boolean): { readonly current: boolean } {
  const router = useRouter();
  const handingOff = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const hash = window.location.hash;
    if (!hash) return;

    const params = parseHashParams(hash);
    const accessToken = params.access_token;
    const refreshToken = params.refresh_token;
    if (accessToken && refreshToken) {
      handingOff.current = true;
      setTokens(accessToken, refreshToken);
      window.location.replace('/');
      return;
    }

    const errorCode = params.error_code ?? params.error;
    if (errorCode) {
      handingOff.current = true;
      router.replace(`/auth/confirm?auth_error=${encodeURIComponent(errorCode)}`);
    }
  }, [enabled, router]);

  return handingOff;
}
