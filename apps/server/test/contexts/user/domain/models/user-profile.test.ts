import { describe, expect, it } from 'vitest';
import { UserProfile, type UserProfileProps } from '@/contexts/user/domain/models/user-profile';

const baseProps: UserProfileProps = {
  id: 'user-1',
  nickname: 'taro',
  avatarUrl: null,
  onboardingCompleted: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('UserProfile', () => {
  it('fromProps / toProps はラウンドトリップする', () => {
    const profile = UserProfile.fromProps(baseProps);
    expect(profile.toProps()).toEqual(baseProps);
  });

  it('withOnboardingCompleted は新インスタンスを返し元を変更しない', () => {
    const profile = UserProfile.fromProps(baseProps);
    const updated = profile.withOnboardingCompleted();

    expect(updated).not.toBe(profile);
    expect(updated.onboardingCompleted).toBe(true);
    expect(profile.onboardingCompleted).toBe(false);
    expect(updated.updatedAt).not.toBe(profile.updatedAt);
  });

  it('既に完了済みなら同じインスタンスを返す（冪等）', () => {
    const profile = UserProfile.fromProps({ ...baseProps, onboardingCompleted: true });
    const updated = profile.withOnboardingCompleted();
    expect(updated).toBe(profile);
  });
});
