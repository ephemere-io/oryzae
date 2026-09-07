import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { DEVICE_PREF_COOKIE } from '@/lib/device';
import { middleware } from '@/middleware';

/**
 * `?device=pc|sp|auto` — 端末の手動切替を URL から行う（`?lang=` と同じ形）。
 *
 * これが無かった頃は、PC と SP を見比べるのに DevTools の Console で cookie を手で
 * 書いてリロードするしかなく、レビュー用の一時コンポーネントを画面に置いていた。
 * 一時コンポーネントは**消し忘れると本番のログイン後の全画面に出る**ので、恒久の
 * 仕組みに寄せた。
 *
 * ここで固定したい要点は 2 つ:
 *  - 付けた URL の**そのリクエストから**効くこと（cookie はレスポンスにしか乗らないので、
 *    保存するだけだとリロードするまで変わらない ＝ 付けても何も起きないように見える）
 *  - `auto` で解除できること（入る道だけあって出る道が無いと、その端末は以後ずっと
 *    嘘の見え方をする）
 */

const PC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120';
const SP_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile';

function run(
  path: string,
  options: { ua?: string; pref?: string } = {},
): { device: string | null; prefCookie: string | undefined } {
  const req = new NextRequest(`https://example.test${path}`, {
    headers: { 'user-agent': options.ua ?? PC_UA },
  });
  if (options.pref) req.cookies.set(DEVICE_PREF_COOKIE, options.pref);

  const res = middleware(req);
  return {
    // server component へ渡す解決結果。これが「そのリクエストで何を描くか」を決める。
    device: res.headers.get('x-middleware-request-x-device'),
    prefCookie: res.cookies.get(DEVICE_PREF_COOKIE)?.value,
  };
}

describe('middleware: ?device=', () => {
  it('切替が無ければ UA で決まる', () => {
    expect(run('/jar').device).toBe('pc');
    expect(run('/jar', { ua: SP_UA }).device).toBe('sp');
  });

  it('?device=sp はそのリクエストから効く（リロードを待たせない）', () => {
    const { device } = run('/jar', { ua: PC_UA });
    expect(device).toBe('pc');
    expect(run('/jar?device=sp', { ua: PC_UA }).device).toBe('sp');
  });

  it('?device= は cookie に憶える（次からは付け直さなくてよい）', () => {
    expect(run('/jar?device=sp').prefCookie).toBe('sp');
    expect(run('/jar', { pref: 'sp' }).device).toBe('sp');
  });

  it('?device=auto は切替を捨てて UA 判定へ戻す', () => {
    const { device, prefCookie } = run('/jar?device=auto', { ua: PC_UA, pref: 'sp' });
    expect(device).toBe('pc');
    // 空文字＝削除の指示（Set-Cookie で即時失効させる）。
    expect(prefCookie).toBe('');
  });

  it('知らない値は無視する（cookie も汚さない）', () => {
    const { device, prefCookie } = run('/jar?device=tablet', { ua: SP_UA });
    expect(device).toBe('sp');
    expect(prefCookie).toBeUndefined();
  });

  it('憶えた切替は UA より優先する', () => {
    expect(run('/jar', { ua: SP_UA, pref: 'pc' }).device).toBe('pc');
  });
});
