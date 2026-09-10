import { afterEach, describe, expect, it } from 'vitest';
import { readStudyBackdrop, saveStudyBackdrop } from '@/features/shared/study/backdrop';

const KEY = 'oryzae_study_backdrop';
const PIXEL = 'data:image/jpeg;base64,/9j/4AAQ';

afterEach(() => sessionStorage.clear());

describe('憶えた書斎', () => {
  it('憶えて、取り出せる', () => {
    saveStudyBackdrop(PIXEL);
    expect(readStudyBackdrop()).toBe(PIXEL);
  });

  it('憶えていなければ null（初回・別タブ）', () => {
    expect(readStudyBackdrop()).toBeNull();
  });

  it('画像でないものが入っていたら null', () => {
    // 同じ鍵に別のものが入っている状態で `<img src>` へ流すと、地に壊れた画像が出る。
    sessionStorage.setItem(KEY, 'not-an-image');
    expect(readStudyBackdrop()).toBeNull();
  });

  it('タブを閉じたら忘れる（localStorage には書かない）', () => {
    // 昨日の部屋が今日の地になると、記録は変わっているのに絵だけ古い、が起きる。
    saveStudyBackdrop(PIXEL);
    expect(sessionStorage.getItem(KEY)).toBe(PIXEL);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('保存できない環境でも落ちない', () => {
    const setItem = sessionStorage.setItem;
    sessionStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      expect(() => saveStudyBackdrop(PIXEL)).not.toThrow();
    } finally {
      sessionStorage.setItem = setItem;
    }
  });
});
