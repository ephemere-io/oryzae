import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EntryListOverlay,
  filterByMonth,
  formatRowDate,
} from '@/features/shared/study/components/entry-list-overlay';
import type { StudyEntry } from '@/features/shared/study/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';

afterEach(cleanup);

function entry(id: string, createdAt: string): StudyEntry {
  return {
    id,
    createdAt,
    excerpt: '今日は静かだった。',
    chars: 120,
    linkedQuestions: [],
    pickled: false,
  };
}

const ENTRIES = [entry('e1', '2026-09-02T01:00:00.000Z'), entry('e2', '2026-08-20T01:00:00.000Z')];

describe('filterByMonth', () => {
  it('null は全部通す', () => {
    expect(filterByMonth(ENTRIES, null)).toHaveLength(2);
  });

  it('その月だけに絞る', () => {
    expect(filterByMonth(ENTRIES, '2026-09').map((e) => e.id)).toEqual(['e1']);
  });

  it('該当が無ければ空', () => {
    expect(filterByMonth(ENTRIES, '2026-07')).toEqual([]);
  });

  it('元の配列を書き換えない', () => {
    filterByMonth(ENTRIES, '2026-09');
    expect(ENTRIES).toHaveLength(2);
  });
});

describe('formatRowDate', () => {
  it('MM.DD にする', () => {
    expect(formatRowDate('2026-09-02T01:00:00.000Z')).toBe('09.02');
  });

  it('壊れた日付でも落ちない', () => {
    expect(() => formatRowDate('nope')).not.toThrow();
  });
});

describe('EntryListOverlay', () => {
  /**
   * 閉じた状態は verify ハーネスでは扱えない（dom-contract verifier が
   * `data-verify-*` を出さないユニットを FAIL とするため）。ここで見る。
   */
  it('open=false では何も描かない', () => {
    const { container } = render(
      withVerifyProviders(
        <EntryListOverlay
          open={false}
          entries={ENTRIES}
          months={['2026-09']}
          selectedMonth={null}
          onSelectMonth={vi.fn()}
          onSelectEntry={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    );
    expect(container.textContent).toBe('');
  });

  it('Esc で閉じる', () => {
    const onClose = vi.fn();
    render(
      withVerifyProviders(
        <EntryListOverlay
          open
          entries={ENTRIES}
          months={['2026-09']}
          selectedMonth={null}
          onSelectMonth={vi.fn()}
          onSelectEntry={vi.fn()}
          onClose={onClose}
        />,
      ),
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('閉じているときは Esc を拾わない', () => {
    const onClose = vi.fn();
    render(
      withVerifyProviders(
        <EntryListOverlay
          open={false}
          entries={ENTRIES}
          months={['2026-09']}
          selectedMonth={null}
          onSelectMonth={vi.fn()}
          onSelectEntry={vi.fn()}
          onClose={onClose}
        />,
      ),
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
