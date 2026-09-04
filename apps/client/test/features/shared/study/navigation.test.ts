import { describe, expect, it } from 'vitest';
import {
  notebookTarget,
  overlayScope,
  staysInStudy,
  targetHref,
} from '@/features/shared/study/navigation';
import type { StudyTarget } from '@/features/shared/study/types';

describe('targetHref', () => {
  it('瓶・新規執筆・ボードは既存の画面へ行く', () => {
    expect(targetHref({ kind: 'jar' })).toBe('/jar');
    expect(targetHref({ kind: 'journal-new' })).toBe('/entries/new');
    expect(targetHref({ kind: 'board' })).toBe('/board');
  });

  it('封は瓶へ入りつつ、どの手紙かを伝える', () => {
    const href = targetHref({ kind: 'letter', fermentationId: 'f-1', questionId: 'q-2' });
    expect(href).toBe('/jar?letter=f-1');
  });

  it('手紙の id をエスケープする', () => {
    const href = targetHref({ kind: 'letter', fermentationId: 'a b&c', questionId: 'q' });
    expect(href).toBe('/jar?letter=a%20b%26c');
  });

  it('過去月と棚は URL を変えない（書斎の中でオーバーレイを開く）', () => {
    // ここを /entries に飛ばすと、既存の一覧画面を作り替えることになる。
    expect(targetHref({ kind: 'journal-month', month: '2026-08' })).toBeNull();
    expect(targetHref({ kind: 'archive' })).toBeNull();
  });
});

describe('staysInStudy', () => {
  it('オーバーレイで完結する対象だけ true', () => {
    expect(staysInStudy({ kind: 'journal-month', month: '2026-08' })).toBe(true);
    expect(staysInStudy({ kind: 'archive' })).toBe(true);
    expect(staysInStudy({ kind: 'jar' })).toBe(false);
    expect(staysInStudy({ kind: 'journal-new' })).toBe(false);
    expect(staysInStudy({ kind: 'board' })).toBe(false);
  });
});

describe('overlayScope', () => {
  it('過去月はその月に絞る', () => {
    expect(overlayScope({ kind: 'journal-month', month: '2026-08' })).toEqual({
      month: '2026-08',
    });
  });

  it('棚は全月（SP は棚ごと 1 つの的）', () => {
    expect(overlayScope({ kind: 'archive' })).toEqual({ month: null });
  });

  it('画面へ出ていく対象は絞り込みを持たない', () => {
    expect(overlayScope({ kind: 'jar' })).toBeNull();
    expect(overlayScope({ kind: 'board' })).toBeNull();
  });
});

describe('notebookTarget', () => {
  it('当月は新規執筆、過去月はその月の一覧', () => {
    expect(notebookTarget('2026-09', true)).toEqual({ kind: 'journal-new' });
    expect(notebookTarget('2026-08', false)).toEqual({
      kind: 'journal-month',
      month: '2026-08',
    });
  });
});

describe('すべての対象に行き先が定義されている', () => {
  const ALL: StudyTarget[] = [
    { kind: 'jar' },
    { kind: 'letter', fermentationId: 'f', questionId: 'q' },
    { kind: 'journal-new' },
    { kind: 'journal-month', month: '2026-08' },
    { kind: 'archive' },
    { kind: 'board' },
  ];

  it('href か overlayScope のどちらか一方を必ず持つ', () => {
    for (const target of ALL) {
      const href = targetHref(target);
      const scope = overlayScope(target);
      expect(href === null, target.kind).toBe(scope !== null);
    }
  });
});
