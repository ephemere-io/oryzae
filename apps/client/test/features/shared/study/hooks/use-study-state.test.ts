import { describe, expect, it } from 'vitest';
import {
  deriveStatus,
  localDateKey,
  toExcerpt,
} from '@/features/shared/study/hooks/use-study-state';

describe('deriveStatus', () => {
  it('手紙が届いていれば completed', () => {
    expect(deriveStatus(1, 1)).toBe('completed');
    // 完了は「未読の手紙がある」ことで決まる。readiness の値では決まらない。
    expect(deriveStatus(0, 1)).toBe('completed');
  });

  it('何も進んでいなければ idle', () => {
    expect(deriveStatus(0, 0)).toBe('idle');
  });

  it('少しでも進んでいれば fermenting', () => {
    expect(deriveStatus(0.01, 0)).toBe('fermenting');
    expect(deriveStatus(0.95, 0)).toBe('fermenting');
    // readiness が 1 でも、手紙が届くまでは発酵中。
    expect(deriveStatus(1, 0)).toBe('fermenting');
  });
});

describe('localDateKey', () => {
  it('ローカル暦日の YYYY-MM-DD を返す', () => {
    const date = new Date(2026, 8, 2, 13, 45);
    expect(localDateKey(date)).toBe('2026-09-02');
  });

  it('月と日を 2 桁に揃える', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('日付をまたぐ深夜でもローカルの日を返す（UTC に寄らない）', () => {
    // ローカル 00:30。toISOString() を使うと JST では前日になる。
    const date = new Date(2026, 8, 2, 0, 30);
    expect(localDateKey(date)).toBe('2026-09-02');
  });
});

describe('toExcerpt', () => {
  it('本文の先頭 1 文だけを取る', () => {
    expect(toExcerpt('今日は静かだった。昨日のことを思い出していた。')).toBe('今日は静かだった。');
  });

  it('改行でも切る', () => {
    expect(toExcerpt('見出しのような一行\n続きの本文がある')).toBe('見出しのような一行');
  });

  it('英文はピリオドと空白で切る', () => {
    expect(toExcerpt('A quiet day. Then it rained.')).toBe('A quiet day.');
  });

  it('区切りが無ければ全体を使う', () => {
    expect(toExcerpt('区切りのない短い本文')).toBe('区切りのない短い本文');
  });

  it('長い 1 文は 60 字で打ち切る', () => {
    const long = 'あ'.repeat(200);
    const excerpt = toExcerpt(long);
    expect(excerpt).toHaveLength(61); // 60 字 + 省略記号
    expect(excerpt.endsWith('…')).toBe(true);
  });

  it('空・空白だけなら空文字', () => {
    expect(toExcerpt('')).toBe('');
    expect(toExcerpt('   \n  ')).toBe('');
  });

  it('前後の空白を落とす', () => {
    expect(toExcerpt('  今日は静かだった。  ')).toBe('今日は静かだった。');
  });
});
