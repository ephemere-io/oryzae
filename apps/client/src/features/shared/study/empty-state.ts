import type { StudyState } from './types';

/**
 * まだ何も届いていない書斎。
 *
 * 認証画面はこの状態でシーンを組む。**ログインする前に中身を見せない**ためであり、同時に
 * 「扉の前に立っている段階では、部屋の中身はまだ知らない」という見立てでもある。
 * 認証が通って state が届いたら `handle.setState()` で差し替わる — それは扉の外にいるあいだに
 * 起きるので、画面には出てこない（`docs/oryzae-study/70-entrance.md`）。
 */
export function emptyStudyState(now: string): StudyState {
  return {
    now,
    unreadCount: 0,
    fermentation: { readiness: 0, status: 'idle', letters: [] },
    notebooks: [],
    entries: [],
    questions: [],
    board: { total: 0, snippets: 0, photos: 0, cards: [] },
  };
}
