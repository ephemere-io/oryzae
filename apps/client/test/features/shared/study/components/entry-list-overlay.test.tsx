import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EntryListOverlay,
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

describe('formatRowDate', () => {
  it('MM.DD にする', () => {
    expect(formatRowDate('2026-09-02T01:00:00.000Z')).toBe('09.02');
  });

  it('利用者のローカル暦日で出す（UTC の文字列を切らない）', () => {
    // JST の 6/1 01:00 は UTC では 5/31T16:00。文字列を切ると 6 月の一覧に 05.31 が並ぶ。
    const at = new Date('2026-06-01T00:30:00.000Z');
    const expected = `${`${at.getMonth() + 1}`.padStart(2, '0')}.${`${at.getDate()}`.padStart(2, '0')}`;
    expect(formatRowDate(at.toISOString())).toBe(expected);
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

  /**
   * 月の絞り込みは**呼び出し側**（サーバーが利用者のローカル暦月で絞ったもの）。
   * ここで `createdAt` の頭 7 文字を見て絞り直すと、UTC の月で判定することになり、
   * JST の月初 00:00〜09:00 に書いた記録を前月扱いで落としてしまう。
   */
  it('渡された記録をそのまま出す（手元で月を絞り直さない）', () => {
    // 6/1 01:00 JST に書いた記録。createdAt は 5/31T16:00Z なので、頭 7 文字は 2026-05。
    const june = entry('june-first', '2026-05-31T16:00:00.000Z');
    const { container } = render(
      withVerifyProviders(
        <EntryListOverlay
          open
          entries={[june]}
          months={['2026-06']}
          selectedMonth="2026-06"
          onSelectMonth={vi.fn()}
          onSelectEntry={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    );

    expect(container.querySelectorAll('li')).toHaveLength(1);
  });

  it('取りに行っている間は 0 件だと断定しない', () => {
    const { container } = render(
      withVerifyProviders(
        <EntryListOverlay
          open
          loading
          entries={[]}
          months={['2026-04']}
          selectedMonth="2026-04"
          onSelectMonth={vi.fn()}
          onSelectEntry={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    );

    expect(container.textContent).not.toContain('この月の記録はありません');
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

  function renderOpen(onClose: () => void) {
    return render(
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
  }

  function backdropOf(container: HTMLElement): HTMLElement {
    const element = container.querySelector('[data-verify-unit="EntryListOverlay"]');
    if (!(element instanceof HTMLElement)) throw new Error('一覧が無い');
    return element;
  }

  it('紙の外を押すと閉じる', () => {
    const onClose = vi.fn();
    const { container } = renderOpen(onClose);
    const backdrop = backdropOf(container);

    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('紙の中を押しても閉じない', () => {
    const onClose = vi.fn();
    const { container } = renderOpen(onClose);
    const heading = container.querySelector('h2');
    if (!(heading instanceof HTMLElement)) throw new Error('見出しが無い');

    fireEvent.pointerDown(heading);
    fireEvent.click(heading);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('押し始めが紙の中なら、外で離しても閉じない（検索欄で文字を選ぶ操作）', () => {
    const onClose = vi.fn();
    const { container } = renderOpen(onClose);
    const heading = container.querySelector('h2');
    if (!(heading instanceof HTMLElement)) throw new Error('見出しが無い');

    fireEvent.pointerDown(heading);
    // 離した場所の共通の祖先＝外側に click が届く。
    fireEvent.click(backdropOf(container));
    expect(onClose).not.toHaveBeenCalled();
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
