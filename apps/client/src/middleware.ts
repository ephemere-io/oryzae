import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isLocale, LOCALE_COOKIE } from '@/i18n/config';
import { DEVICE_COOKIE, DEVICE_PREF_COOKIE, isDevice, resolveDevice } from '@/lib/device';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

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

  return res;
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
