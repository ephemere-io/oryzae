import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UnsubscribeTokenUnavailableError } from '@/contexts/newsletter/domain/gateways/unsubscribe-token.gateway.js';
import { HmacUnsubscribeToken } from '@/contexts/newsletter/infrastructure/unsubscribe/hmac-unsubscribe-token.js';

describe('HmacUnsubscribeToken', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('発行したトークンから user_id を復元できる', () => {
    const tokens = new HmacUnsubscribeToken();
    const token = tokens.issue('11111111-2222-3333-4444-555555555555');

    expect(tokens.verify(token)).toBe('11111111-2222-3333-4444-555555555555');
  });

  it('user_id が違えばトークンも違う', () => {
    const tokens = new HmacUnsubscribeToken();
    expect(tokens.issue('u1')).not.toBe(tokens.issue('u2'));
  });

  it('同じ user_id なら毎回同じトークン（古いメールのリンクも効く）', () => {
    const tokens = new HmacUnsubscribeToken();
    expect(tokens.issue('u1')).toBe(tokens.issue('u1'));
  });

  it('URL に載せられる文字だけを使う', () => {
    const token = new HmacUnsubscribeToken().issue('11111111-2222-3333-4444-555555555555');
    expect(token).toMatch(/^[A-Za-z0-9_.-]+$/);
  });

  // ここが破れると、user_id を総当たりして他人を勝手に配信停止にできる。
  it('署名を差し替えたトークンを拒む', () => {
    const tokens = new HmacUnsubscribeToken();
    const token = tokens.issue('u1');
    const [payload] = token.split('.');

    expect(tokens.verify(`${payload}.forged`)).toBeNull();
    expect(tokens.verify(payload)).toBeNull();
    expect(tokens.verify(`${payload}.`)).toBeNull();
  });

  it('payload だけ他人の user_id に差し替えたトークンを拒む', () => {
    const tokens = new HmacUnsubscribeToken();
    const [, signature] = tokens.issue('u1').split('.');
    const otherPayload = Buffer.from('u2', 'utf8').toString('base64url');

    expect(tokens.verify(`${otherPayload}.${signature}`)).toBeNull();
  });

  it('秘密鍵が変わると既存のトークンは無効になる（まとめて失効させる手段）', () => {
    const token = new HmacUnsubscribeToken().issue('u1');

    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'rotated-secret';
    expect(new HmacUnsubscribeToken().verify(token)).toBeNull();
  });

  it('壊れた形のトークンで例外を投げない', () => {
    const tokens = new HmacUnsubscribeToken();
    for (const bogus of ['', '.', 'a.b.c', 'not-a-token', '....']) {
      expect(tokens.verify(bogus)).toBeNull();
    }
  });

  it('鍵が無ければ発行は落ちる（配信停止リンクの無いメールを送らせない）', () => {
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = '';
    expect(() => new HmacUnsubscribeToken().issue('u1')).toThrow(UnsubscribeTokenUnavailableError);
  });

  it('鍵が無いときの検証は例外ではなく null（設定状況を応答から読ませない）', () => {
    const token = new HmacUnsubscribeToken().issue('u1');
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = '';

    expect(new HmacUnsubscribeToken().verify(token)).toBeNull();
  });
});
