import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isLocale, LOCALE_COOKIE } from '@/i18n/config';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function middleware(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get('lang');
  if (lang && isLocale(lang) && req.cookies.get(LOCALE_COOKIE)?.value !== lang) {
    const res = NextResponse.next();
    res.cookies.set(LOCALE_COOKIE, lang, {
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
      sameSite: 'lax',
    });
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
