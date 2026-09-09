import { describe, expect, it } from 'vitest';
import { isSpendLimitError } from '@/contexts/shared/infrastructure/anthropic-spend-limit';

/**
 * 「待てば直るレート制限」と「金銭的に止まっている状態」を分ける判定。
 * ここを取り違えると、上限に達しただけなのに原因不明の不具合として扱ってしまう。
 */
describe('isSpendLimitError', () => {
  it('クレジット残高切れ（402 billing_error）を拾う', () => {
    expect(isSpendLimitError({ status: 402, message: 'Your credit balance is too low' })).toBe(
      true,
    );
  });

  it('ティア月間上限（429 + enforced_spend_limit_reached）を拾う', () => {
    expect(
      isSpendLimitError({
        status: 429,
        error: {
          type: 'rate_limit_error',
          details: { error_code: 'enforced_spend_limit_reached' },
        },
      }),
    ).toBe(true);
  });

  it('自分で設定した支出上限（400 + 特定の文面）を拾う', () => {
    expect(
      isSpendLimitError({
        status: 400,
        message: 'You have reached your specified API usage limits. Access resumes 2026-09-01.',
      }),
    ).toBe(true);
  });

  it('Error でラップされていても文面で拾える', () => {
    expect(isSpendLimitError(new Error('You have reached your specified API usage limits'))).toBe(
      true,
    );
  });

  // ここが false でないと、待てば直る障害を「上限到達」と誤報する。
  it('通常のレート制限（429 + retry-after）は対象外', () => {
    expect(
      isSpendLimitError({
        status: 429,
        message: 'Number of requests has exceeded your rate limit',
        error: { type: 'rate_limit_error' },
      }),
    ).toBe(false);
  });

  it('普通の 400 は対象外', () => {
    expect(isSpendLimitError({ status: 400, message: 'max_tokens must be positive' })).toBe(false);
  });

  it('通信エラー・想定外の値でも false', () => {
    expect(isSpendLimitError(new Error('socket hang up'))).toBe(false);
    expect(isSpendLimitError(null)).toBe(false);
    expect(isSpendLimitError(undefined)).toBe(false);
    expect(isSpendLimitError('boom')).toBe(false);
  });

  it('大文字小文字が違っても文面判定は効く', () => {
    expect(
      isSpendLimitError({
        status: 400,
        message: 'YOU HAVE REACHED YOUR SPECIFIED API USAGE LIMITS',
      }),
    ).toBe(true);
  });
});
