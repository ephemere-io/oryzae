import { describe, expect, it } from 'vitest';
import { studyHint } from '@/features/shared/study/hints';
import type { StudyState } from '@/features/shared/study/types';

const BASE: StudyState = {
  now: '2026-09-11',
  unreadCount: 0,
  fermentation: { readiness: 0, status: 'idle', letters: [] },
  notebooks: [],
  entries: [],
  questions: [],
  board: { total: 0, snippets: 0, photos: 0, cards: [] },
};

function state(patch: Partial<StudyState>): StudyState {
  return { ...BASE, ...patch };
}

describe('studyHint（鉛筆）', () => {
  it('押すと何が起きるかを言う', () => {
    expect(studyHint('pen', BASE)).toEqual({ textKey: 'hint_pen' });
  });
});

describe('studyHint（瓶）', () => {
  it('未読の手紙があるときは、それを最優先で言う', () => {
    // 発酵が始まったばかりでも、届いている手紙のほうが先。
    const hint = studyHint('jar', state({ unreadCount: 1 }));
    expect(hint.textKey).toBe('hint_jar_letter');
  });

  it('読み終えた手紙は「未読」と言わない', () => {
    const hint = studyHint(
      'jar',
      state({ unreadCount: 0, fermentation: { readiness: 1, status: 'completed', letters: [] } }),
    );
    expect(hint.textKey).toBe('hint_jar_read');
  });

  it('空の瓶と発酵中を言い分ける', () => {
    expect(studyHint('jar', BASE).textKey).toBe('hint_jar_empty');
    expect(
      studyHint(
        'jar',
        state({ fermentation: { readiness: 0.3, status: 'fermenting', letters: [] } }),
      ).textKey,
    ).toBe('hint_jar_fermenting');
  });

  it('もうすぐ届く（ラベルの状態語と同じ段階分け）', () => {
    expect(
      studyHint(
        'jar',
        state({ fermentation: { readiness: 0.9, status: 'fermenting', letters: [] } }),
      ).textKey,
    ).toBe('hint_jar_almost');
  });
});

describe('studyHint（板）', () => {
  it('両方あるときは内訳を並べる', () => {
    const hint = studyHint(
      'board',
      state({ board: { total: 15, snippets: 12, photos: 3, cards: [] } }),
    );
    expect(hint).toEqual({ textKey: 'hint_board_both', values: { photos: 3, snippets: 12 } });
  });

  it('0 の種類は読み上げない（「写真 0 件」と数えない）', () => {
    expect(
      studyHint('board', state({ board: { total: 4, snippets: 4, photos: 0, cards: [] } })),
    ).toEqual({ textKey: 'hint_board_snippets', values: { count: 4 } });
    expect(
      studyHint('board', state({ board: { total: 2, snippets: 0, photos: 2, cards: [] } })),
    ).toEqual({ textKey: 'hint_board_photos', values: { count: 2 } });
  });

  it('空の板でも黙らない（何も出ないと「壊れている」に見える）', () => {
    expect(studyHint('board', BASE)).toEqual({ textKey: 'hint_board_empty' });
  });
});
