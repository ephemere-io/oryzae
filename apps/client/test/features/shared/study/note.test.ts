import { afterEach, describe, expect, it } from 'vitest';
import { readStudyNoteDismissed, saveStudyNoteDismissed } from '@/features/shared/study/note';

const KEY = 'oryzae_study_note_dismissed';

afterEach(() => localStorage.clear());

describe('卓上のメモをはがしたかどうか', () => {
  it('はじめは置いてある', () => {
    expect(readStudyNoteDismissed()).toBe(false);
  });

  it('はがしたら、次に開いても置かない', () => {
    saveStudyNoteDismissed();
    expect(readStudyNoteDismissed()).toBe(true);
  });

  it('タブを閉じても憶えている（localStorage）', () => {
    // はがしたメモが次のタブでまた置いてあったら、はがした意味が無い。
    saveStudyNoteDismissed();
    expect(localStorage.getItem(KEY)).toBe('1');
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('別のものが同じ鍵に入っていたら「置いてある」に倒す', () => {
    localStorage.setItem(KEY, 'yes');
    expect(readStudyNoteDismissed()).toBe(false);
  });

  it('保存できない環境でも落ちない（次に開いたときにまた置いてあるだけ）', () => {
    const setItem = localStorage.setItem;
    localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      expect(() => saveStudyNoteDismissed()).not.toThrow();
    } finally {
      localStorage.setItem = setItem;
    }
  });
});
