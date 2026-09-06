'use client';

// verify-exempt: localStorage トークン処理と認証リダイレクトのみを行うゲート（router/storage 依存でシーム不可）。

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
 * ルート（/）のクライアント専用ゲート。描画は持たず（null）、副作用のみ:
 * - Supabase のメール確認リダイレクト（hash に access/refresh token）を受けてログイン状態にする
 * - Supabase がエラーを返した場合（期限切れ・使用済みリンク）は確認画面へ送って理由を見せる
 * - 既ログインなら /entries/new へ送る
 * - PWA として起動されていれば、未ログインでもログイン画面へ送る（アプリの外に出さない）
 * - どれでもない訪問者は公開サイト（別ドメイン）へ送る
 *
 * ランディングは別リポジトリの公開サイトに移したため、ここは本文を持たない。
 * 未ログイン訪問者を送り出す先が別オリジンなので、next/router ではなく
 * `window.location.replace` を使う。
 *
 * **エラー分岐を消さないこと。** 期限切れリンクは hash にトークンではなく
 * `#error=access_denied&error_code=otp_expired&...` で戻ってくる。この分岐が無いと
 * 「トークンも無い・ログインもしていない」として公開サイトへ即離脱してしまい、
 * ユーザーはリンクが切れていた事実を知る術がなくなる。
 *
 * **PWA 分岐も消さないこと。** 公開サイトを別ドメインに出したことで、この分岐が無いと
 * ホーム画面のショートカットから起動した人が別ドメインへ飛ばされ、アプリに戻れなくなる。
 * 分割前は同一ドメインのランディングに留まっていたので、実害が一段大きくなっている。
 */
export function HomeGate() {
  const router = useRouter();
  const t = useTranslations('app.home_gate');

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

    // Issue #437: manifest の start_url は直したが、既にホーム画面に置かれている
    // ショートカットは古い start_url（＝ここ）のまま起動する。ここでも受ける。
    if (isStandaloneLaunch()) {
      router.replace('/login');
      return;
    }

    // ブラウザで開いた未ログイン訪問者には公開サイトのランディングを見せる（SEO と導線）。
    window.location.replace(DOCS_SITE_URL);
  }, [router]);

  // 判定はすべて JS 側でしかできない（トークンは localStorage、確認リンクは hash で
  // サーバーに届かない）。そのぶん JS が動くまでの空白と、JS が無効・失敗したときの
  // 行き止まりが避けられないので、最低限の出口を置く。
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm" style={{ color: 'var(--date-color)' }}>
        {t('redirecting')}
      </p>
      <noscript>
        <p className="text-sm" style={{ color: 'var(--fg)' }}>
          {t('no_script')}
        </p>
        <p className="mt-3 flex justify-center gap-4 text-sm">
          <a href={DOCS_SITE_URL} style={{ color: 'var(--accent)' }}>
            {t('link_about')}
          </a>
          <a href="/login" style={{ color: 'var(--accent)' }}>
            {t('link_login')}
          </a>
        </p>
      </noscript>
    </div>
  );
}
