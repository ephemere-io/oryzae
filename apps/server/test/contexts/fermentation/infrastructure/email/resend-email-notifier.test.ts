import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResendEmailNotifier } from '@/contexts/fermentation/infrastructure/email/resend-email-notifier.js';

const PARAMS = {
  to: 'user@example.com',
  subject: 'Subject',
  bodyText: 'Body',
};

describe('ResendEmailNotifier (issue #288: failure observability)', () => {
  const originalEnv = { ...process.env };
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    process.env = { ...originalEnv };
    fetchSpy.mockReset();
    errorSpy.mockClear();
    warnSpy.mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('sends to Resend with the configured api key + EMAIL_FROM and resolves on 2xx', async () => {
    process.env.RESEND_API_KEY = 'rk_test';
    process.env.EMAIL_FROM = 'Oryzae <noreply@example.com>';
    delete process.env.EMAIL_ENABLED;
    fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const notifier = new ResendEmailNotifier();
    await notifier.send(PARAMS);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init?.method).toBe('POST');
    // HeadersInit は object | array | Headers のユニオンなので Headers でラップして取り出す
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer rk_test');
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    expect(body).toEqual({
      from: 'Oryzae <noreply@example.com>',
      to: ['user@example.com'],
      subject: 'Subject',
      text: 'Body',
    });
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('throws AND logs error when Resend returns non-2xx', async () => {
    process.env.RESEND_API_KEY = 'rk_test';
    delete process.env.EMAIL_ENABLED;
    fetchSpy.mockResolvedValueOnce(
      new Response('{"name":"validation_error","message":"Invalid `to`"}', { status: 422 }),
    );

    const notifier = new ResendEmailNotifier();
    await expect(notifier.send(PARAMS)).rejects.toThrow(/422/);
    expect(errorSpy).toHaveBeenCalledOnce();
    const [, payload] = errorSpy.mock.calls[0];
    expect(payload).toMatchObject({
      to: 'user@example.com',
      status: 422,
    });
  });

  it('throws AND logs error when fetch itself rejects (network error)', async () => {
    process.env.RESEND_API_KEY = 'rk_test';
    delete process.env.EMAIL_ENABLED;
    fetchSpy.mockRejectedValueOnce(new Error('ECONNRESET'));

    const notifier = new ResendEmailNotifier();
    await expect(notifier.send(PARAMS)).rejects.toThrow('ECONNRESET');
    expect(errorSpy).toHaveBeenCalledOnce();
    const [, payload] = errorSpy.mock.calls[0];
    expect(payload).toMatchObject({ to: 'user@example.com', error: 'ECONNRESET' });
  });

  it('skips silently (no fetch, no log) when EMAIL_ENABLED=false (dev opt-out)', async () => {
    process.env.RESEND_API_KEY = 'rk_test';
    process.env.EMAIL_ENABLED = 'false';

    const notifier = new ResendEmailNotifier();
    await notifier.send(PARAMS);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns and skips (no throw) when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_ENABLED;

    const notifier = new ResendEmailNotifier();
    await notifier.send(PARAMS);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('RESEND_API_KEY not set');
  });
});
