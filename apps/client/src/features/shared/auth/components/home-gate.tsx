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
 * ルート（/）のクライアント専用ゲート。描画は持たず（null）、副作用のみ:
 * - Supabase のメール確認リダイレクト（hash に access/refresh token）を受けてログイン状態にする
 * - Supabase がエラーを返した場合（期限切れ・使用済みリンク）は確認画面へ送って理由を見せる
 * - 既ログインなら /entries/new へ送る
 * - 未ログインならログイン画面へ送る
 *
 * ランディングは別リポジトリの公開サイト（別ドメイン）に移したため、ここは本文を持たない。
 *
 * **未ログインの行き先は公開サイトではなくログイン画面。** 以前は SEO と新規導線のために
 * `docs.oryzae.ephemere.io` へ送っていたが、アプリのドメインを開いた人が
 * 「テストしたいのに別サイトへ飛ばされて戻れない」状態になっていた。アプリのドメインは
 * アプリの入口として扱い、ランディングは公開サイトのドメインを直接共有して届ける。
 * これで Vercel のプレビュー（本番と別オリジン＝常に未ログイン）でも動作確認ができる。
 *
 * **エラー分岐を消さないこと。** 期限切れリンクは hash にトークンではなく
 * `#error=access_denied&error_code=otp_expired&...` で戻ってくる。この分岐が無いと
 * 「トークンも無い・ログインもしていない」としてログイン画面へ流れてしまい、
 * ユーザーはリンクが切れていた事実を知る術がなくなる。
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
      const errorCode = params.error_code ?? params.error;
      if (errorCode) {
        router.replace(`/auth/confirm?auth_error=${encodeURIComponent(errorCode)}`);
        return;
      }
    }

    if (getAccessToken()) {
      router.replace('/entries/new');
      return;
    }

    // 未ログインはログイン画面へ。ホーム画面のショートカット（古い start_url が
    // ここを指す。Issue #437）から起動した場合も同じ行き先でよい。
    router.replace('/login');
  }, [router]);

  return null;
}
