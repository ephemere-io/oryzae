import { describe, expect, it } from 'vitest';
import { resolveMaxUserCount } from '@/contexts/user/application/config/signup-cap';
import { DEFAULT_MAX_USER_COUNT } from '@/contexts/user/domain/policies/signup-capacity.policy';

describe('resolveMaxUserCount', () => {
  it('MAX_USER_COUNT 未設定なら DEFAULT_MAX_USER_COUNT を返す', () => {
    expect(resolveMaxUserCount({})).toBe(DEFAULT_MAX_USER_COUNT);
  });

  it('MAX_USER_COUNT が空文字なら DEFAULT_MAX_USER_COUNT', () => {
    expect(resolveMaxUserCount({ MAX_USER_COUNT: '' })).toBe(DEFAULT_MAX_USER_COUNT);
  });

  it('正の整数文字列をパースする', () => {
    expect(resolveMaxUserCount({ MAX_USER_COUNT: '250' })).toBe(250);
    expect(resolveMaxUserCount({ MAX_USER_COUNT: '1' })).toBe(1);
  });

  it('非数値なら DEFAULT_MAX_USER_COUNT にフォールバック', () => {
    expect(resolveMaxUserCount({ MAX_USER_COUNT: 'abc' })).toBe(DEFAULT_MAX_USER_COUNT);
  });

  it('0 や負数なら DEFAULT_MAX_USER_COUNT にフォールバック', () => {
    expect(resolveMaxUserCount({ MAX_USER_COUNT: '0' })).toBe(DEFAULT_MAX_USER_COUNT);
    expect(resolveMaxUserCount({ MAX_USER_COUNT: '-10' })).toBe(DEFAULT_MAX_USER_COUNT);
  });

  it('parseInt で整数部のみ取る (250.7 → 250)', () => {
    expect(resolveMaxUserCount({ MAX_USER_COUNT: '250.7' })).toBe(250);
  });
});
