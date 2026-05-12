import {
  emailOtpTypeSchema,
  localeSchema,
  oauthCallbackSchema,
  oauthInitSchema,
  signupSchema,
  verifyOtpSchema,
} from '@oryzae/shared';
import { describe, expect, it } from 'vitest';

describe('localeSchema', () => {
  it('accepts all supported UI locales (ja/en/zh/ko)', () => {
    expect(localeSchema.parse('ja')).toBe('ja');
    expect(localeSchema.parse('en')).toBe('en');
    expect(localeSchema.parse('zh')).toBe('zh');
    expect(localeSchema.parse('ko')).toBe('ko');
  });

  it('rejects unsupported locales', () => {
    expect(() => localeSchema.parse('fr')).toThrow();
    expect(() => localeSchema.parse('')).toThrow();
  });
});

describe('signupSchema locale field', () => {
  const base = { nickname: 'tester_01', email: 'a@b.com', password: 'secret123' };

  it('accepts payload without locale (backward compat)', () => {
    const parsed = signupSchema.parse(base);
    expect(parsed.locale).toBeUndefined();
  });

  it('accepts all supported locales', () => {
    expect(signupSchema.parse({ ...base, locale: 'ja' }).locale).toBe('ja');
    expect(signupSchema.parse({ ...base, locale: 'en' }).locale).toBe('en');
    expect(signupSchema.parse({ ...base, locale: 'zh' }).locale).toBe('zh');
    expect(signupSchema.parse({ ...base, locale: 'ko' }).locale).toBe('ko');
  });

  it('rejects unsupported locale', () => {
    expect(() => signupSchema.parse({ ...base, locale: 'de' })).toThrow();
  });
});

describe('oauthInitSchema', () => {
  it('requires redirectTo as URL and accepts optional locale', () => {
    expect(() => oauthInitSchema.parse({ redirectTo: 'not-a-url' })).toThrow();
    const parsed = oauthInitSchema.parse({
      redirectTo: 'https://example.com/callback',
      locale: 'en',
    });
    expect(parsed.locale).toBe('en');
  });
});

describe('oauthCallbackSchema', () => {
  it('requires code and accepts optional locale', () => {
    expect(() => oauthCallbackSchema.parse({})).toThrow();
    const parsed = oauthCallbackSchema.parse({ code: 'abc', locale: 'ja' });
    expect(parsed.code).toBe('abc');
    expect(parsed.locale).toBe('ja');
  });
});

describe('emailOtpTypeSchema', () => {
  it('accepts all Supabase email OTP types', () => {
    for (const t of ['signup', 'invite', 'magiclink', 'recovery', 'email_change'] as const) {
      expect(emailOtpTypeSchema.parse(t)).toBe(t);
    }
  });

  it('rejects unsupported types (e.g. sms)', () => {
    expect(() => emailOtpTypeSchema.parse('sms')).toThrow();
    expect(() => emailOtpTypeSchema.parse('')).toThrow();
  });
});

describe('verifyOtpSchema', () => {
  it('requires non-empty tokenHash and a valid type', () => {
    expect(() => verifyOtpSchema.parse({})).toThrow();
    expect(() => verifyOtpSchema.parse({ tokenHash: '', type: 'signup' })).toThrow();
    expect(() => verifyOtpSchema.parse({ tokenHash: 'h', type: 'unknown' })).toThrow();

    const parsed = verifyOtpSchema.parse({ tokenHash: 'abc', type: 'recovery' });
    expect(parsed.tokenHash).toBe('abc');
    expect(parsed.type).toBe('recovery');
  });
});
