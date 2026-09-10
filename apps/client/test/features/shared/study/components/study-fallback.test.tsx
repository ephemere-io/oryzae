import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { saveStudyBackdrop } from '@/features/shared/study/backdrop';
import { StudyFallback } from '@/features/shared/study/components/study-fallback';
import { withVerifyProviders } from '@/lib/verify/with-providers';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * 戻り道の見え方を固定する。
 *
 * ここが守っているのは「読み込み中に**別の何か**を挟まない」こと。3 つのリンクも、
 * 書斎を模した絵も、順に「謎の選択肢が出る」「戻るときだけ謎のアイコンが出る」と
 * 報告された（PR #570）。出してよいのは、出ていく直前に掴んだ部屋そのものだけ。
 */
describe('StudyFallback', () => {
  it('読み込み中、憶えた部屋があればそれを敷く', () => {
    saveStudyBackdrop(PIXEL);
    const { container } = render(withVerifyProviders(<StudyFallback loading />));
    const backdrop = container.querySelector('img[data-study-backdrop]');
    expect(backdrop?.getAttribute('src')).toBe(PIXEL);
  });

  it('読み込み中、憶えていなければ何も出さない', () => {
    const { container } = render(withVerifyProviders(<StudyFallback loading />));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent?.trim()).toBe('');
  });

  it('読み込み中は行き先を出さない（すぐ書斎に置き換わるのに選択を迫らない）', () => {
    saveStudyBackdrop(PIXEL);
    const { container } = render(withVerifyProviders(<StudyFallback loading />));
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });

  it('書斎が出せないときは、理由と 3 つの行き先を出す', () => {
    // こちらは「読み込み中」とは意味が違う。代わりにどこへ行けるかを示す画面。
    const { container } = render(withVerifyProviders(<StudyFallback />));
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/jar', '/entries/new', '/board']);
    expect(container.querySelector('h1')).not.toBeNull();
  });
});
