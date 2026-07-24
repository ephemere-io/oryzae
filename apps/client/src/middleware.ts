import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isLocale, LOCALE_COOKIE } from '@/i18n/config';
import { DEVICE_COOKIE, DEVICE_PREF_COOKIE, isDevice, resolveDevice } from '@/lib/device';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// インデックス許可する公開ページ。これ以外（認証/保護下・計測系）は noindex にする。
const PUBLIC_INDEXABLE_PATHS = new Set(['/', '/privacy', '/support']);

export function middleware(req: NextRequest) {
  // 端末を解決（手動切替 device-pref があれば優先、無ければ UA 判定）。
  const pref = req.cookies.get(DEVICE_PREF_COOKIE)?.value;
  const resolvedDevice = resolveDevice(pref, req.headers.get('user-agent'));

  // Issue #363 perf: 解決した端末を **リクエストヘッダ x-device** で server component に渡す。
  // cookie はレスポンスにしか付かず同一リクエスト（＝初回訪問）の SSR では読めないため、
  // SSR で端末別シェル＋スケルトンを即描画するにはヘッダ経由が必要。
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-device', resolvedDevice);
  const res = NextResponse.next({ request: { headers: requestHeaders } });

  // Issue #363: バックグラウンド復帰時のホワイトアウト対策（bfcache 有効化）。
  // 本番(Vercel)の動的ページは既定で `Cache-Control: ...no-store...` を返し、no-store が
  // bfcache を無効化する（本番で notRestoredReasons=response-cache-control-no-store を実測）。
  // no-store だと iOS はバックグラウンドのタブを凍結できず破棄し、復帰時に白画面のまま
  // 手動リロードが必要になる。no-store を外し no-cache（毎回再検証）に保つことで bfcache
  // 適格にする。保護ページは全て client 描画で SSR 出力（HTML/RSC）に私的データを含まない
  // ため、no-store を外しても露出はない。API(/api)・静的資産(_next)は matcher 対象外。
  // ※ next dev では Next がレンダリング後に上書きし効かない。本番の挙動はプレビューで検証する。
  res.headers.set('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');

  // 言語: ?lang= を cookie に固定（既存挙動）
  const lang = req.nextUrl.searchParams.get('lang');
  if (lang && isLocale(lang) && req.cookies.get(LOCALE_COOKIE)?.value !== lang) {
    res.cookies.set(LOCALE_COOKIE, lang, {
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
      sameSite: 'lax',
    });
  }

  // 端末 cookie を付与（手動切替がある時は尊重して上書きしない）。クライアント側の
  // 永続・後続リクエスト用。URL には端末を出さない（同一 URL のまま）。
  if (!isDevice(pref) && req.cookies.get(DEVICE_COOKIE)?.value !== resolvedDevice) {
    res.cookies.set(DEVICE_COOKIE, resolvedDevice, {
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
      sameSite: 'lax',
    });
  }

  // SEO: 公開ページ以外はクローラに noindex を返す（保護ページは client 描画で
  // metadata を持てないため、ヘッダで確実に noindex する。robots.txt と二重担保）。
  if (!PUBLIC_INDEXABLE_PATHS.has(req.nextUrl.pathname)) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
