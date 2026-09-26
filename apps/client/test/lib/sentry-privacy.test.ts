import { describe, expect, it } from 'vitest';
import { scrubSentryEvent, sentryPrivacyOptions } from '@/lib/sentry-privacy';

describe('scrubSentryEvent', () => {
  it('drops the request body so diary text never reaches Sentry', () => {
    const event = {
      message: 'boom',
      request: {
        url: 'https://oryzae.app/api/v1/entries',
        method: 'POST',
        data: { content: '今日は誰にも言えないことがあった' },
        cookies: { 'sb-access-token': 'secret' },
        headers: {
          'content-type': 'application/json',
          Cookie: 'sb-access-token=secret',
          Authorization: 'Bearer eyJ...',
        },
      },
    };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.request).toEqual({
      url: 'https://oryzae.app/api/v1/entries',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    expect(JSON.stringify(scrubbed)).not.toContain('誰にも言えない');
  });

  it('leaves events without a request untouched', () => {
    const event = { message: 'boom', request: undefined };
    expect(scrubSentryEvent(event)).toEqual({ message: 'boom' });
  });

  it('is wired to both errors and transactions, with default PII off', () => {
    expect(sentryPrivacyOptions.sendDefaultPii).toBe(false);
    expect(sentryPrivacyOptions.beforeSend).toBe(scrubSentryEvent);
    expect(sentryPrivacyOptions.beforeSendTransaction).toBe(scrubSentryEvent);
  });
});
