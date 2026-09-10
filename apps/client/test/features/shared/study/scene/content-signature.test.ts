import { describe, expect, it } from 'vitest';
import { contentSignature } from '@/features/shared/study/scene/content-signature';
import type { StudyBoardCard, StudyState } from '@/features/shared/study/types';

function card(patch: Partial<StudyBoardCard> = {}): StudyBoardCard {
  return {
    id: 'card-1',
    cardType: 'snippet',
    x: 10,
    y: 20,
    rotation: 3,
    width: 200,
    height: 120,
    zIndex: 0,
    lines: 3,
    ...patch,
  };
}

const BASE: StudyState = {
  now: '2026-09-11',
  unreadCount: 0,
  fermentation: { readiness: 0.4, status: 'fermenting', letters: [] },
  notebooks: [{ month: '2026-09', entryCount: 4, current: true }],
  entries: [],
  questions: [],
  board: { total: 1, snippets: 1, photos: 0, cards: [card()] },
};

function state(patch: Partial<StudyState>): StudyState {
  return { ...BASE, ...patch };
}

describe('contentSignature', () => {
  it('中身が同じなら同じ（別の object でも組み直さない）', () => {
    expect(contentSignature(state({}))).toBe(contentSignature(BASE));
  });

  it('絵に出ないもの（一覧の記録・問い・未読数）が変わっても同じ', () => {
    // ここが要点。5 つの取得が別々に届くので、これらで組み直していると
    // 戻ってきた直後に何度も部屋を作り直すことになる。
    const noisy = state({
      unreadCount: 3,
      questions: [{ id: 'q1', currentText: '問い' }],
      entries: [
        {
          id: 'e1',
          createdAt: '2026-09-11T00:00:00Z',
          excerpt: '本文',
          chars: 2,
          linkedQuestions: [],
          pickled: false,
        },
      ],
    });
    expect(contentSignature(noisy)).toBe(contentSignature(BASE));
  });

  it('壁の総数だけが動いても組み直さない（数はラベルが言う）', () => {
    const more = state({ board: { ...BASE.board, total: 40, snippets: 30, photos: 10 } });
    expect(contentSignature(more)).toBe(contentSignature(BASE));
  });

  it('積みの厚み（件数）が変われば組み直す', () => {
    const thicker = state({ notebooks: [{ month: '2026-09', entryCount: 9, current: true }] });
    expect(contentSignature(thicker)).not.toBe(contentSignature(BASE));
  });

  it('月が増えれば組み直す（棚に背表紙が増える）', () => {
    const added = state({
      notebooks: [...BASE.notebooks, { month: '2026-08', entryCount: 2, current: false }],
    });
    expect(contentSignature(added)).not.toBe(contentSignature(BASE));
  });

  it('瓶の進み具合と状態が変われば組み直す', () => {
    expect(
      contentSignature(state({ fermentation: { ...BASE.fermentation, readiness: 0.9 } })),
    ).not.toBe(contentSignature(BASE));
    expect(
      contentSignature(state({ fermentation: { ...BASE.fermentation, status: 'completed' } })),
    ).not.toBe(contentSignature(BASE));
  });

  it('壁のカードが動けば組み直す', () => {
    const moved = state({ board: { ...BASE.board, cards: [card({ x: 80 })] } });
    expect(contentSignature(moved)).not.toBe(contentSignature(BASE));
  });

  it('カードが 1 枚増えれば組み直す', () => {
    const added = state({
      board: { ...BASE.board, cards: [card(), card({ id: 'card-2', cardType: 'photo' })] },
    });
    expect(contentSignature(added)).not.toBe(contentSignature(BASE));
  });

  it('日が変われば組み直す（当月の判定が動く）', () => {
    expect(contentSignature(state({ now: '2026-10-01' }))).not.toBe(contentSignature(BASE));
  });

  it('見た目に出ない誤差（0.001）では組み直さない', () => {
    const jitter = state({ fermentation: { ...BASE.fermentation, readiness: 0.4004 } });
    expect(contentSignature(jitter)).toBe(contentSignature(BASE));
  });
});
