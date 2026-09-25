import { describe, expect, it } from 'vitest';
import { isPassage, staysAtEntrance } from '@/features/shared/auth/entrance/passage';

describe('isPassage', () => {
  it('Google から戻った先とメールのリンクの先は通り道（言語を選ばせない）', () => {
    expect(isPassage('/callback')).toBe(true);
    expect(isPassage('/auth/confirm')).toBe(true);
  });

  it('フォームのある画面は通り道ではない', () => {
    for (const path of ['/login', '/signup', '/forgot-password', '/reset-password']) {
      expect(isPassage(path)).toBe(false);
    }
  });
});

describe('staysAtEntrance', () => {
  it('書斎やサブ画面へ向かうなら扉を開けて入る', () => {
    for (const destination of ['/', '/entries/new', '/account', '/entries/new?questionId=q1']) {
      expect(staysAtEntrance(destination)).toBe(false);
    }
  });

  it('パスワード再設定のように扉の手前へ戻る行き先では入らない', () => {
    expect(staysAtEntrance('/reset-password')).toBe(true);
    expect(staysAtEntrance('/login?next=%2F')).toBe(true);
    expect(staysAtEntrance('/login#top')).toBe(true);
  });

  it('前方一致で取り違えない', () => {
    expect(staysAtEntrance('/login-help')).toBe(false);
  });
});
