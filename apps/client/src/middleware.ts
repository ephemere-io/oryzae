import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isLocale, LOCALE_COOKIE } from '@/i18n/config';
import { DEVICE_COOKIE, DEVICE_PREF_COOKIE, detectDeviceFromUA, isDevice } from '@/lib/device';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // 言語: ?lang= を cookie に固定（既存挙動）
  const lang = req.nextUrl.searchParams.get('lang');
  if (lang && isLocale(lang) && req.cookies.get(LOCALE_COOKIE)?.value !== lang) {
    res.cookies.set(LOCALE_COOKIE, lang, {
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
      sameSite: 'lax',
    });
  }

  // 端末: UA から device cookie を付与。手動切替(device-pref)があれば尊重して上書きしない。
  // URL には端末を出さない（同一 URL のまま）。クライアントは useDevice() で cookie を読む。
  const pref = req.cookies.get(DEVICE_PREF_COOKIE)?.value;
  if (!isDevice(pref)) {
    const detected = detectDeviceFromUA(req.headers.get('user-agent'));
    if (req.cookies.get(DEVICE_COOKIE)?.value !== detected) {
      res.cookies.set(DEVICE_COOKIE, detected, {
        path: '/',
        maxAge: ONE_YEAR_SECONDS,
        sameSite: 'lax',
      });
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
