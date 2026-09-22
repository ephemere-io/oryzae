import { describe, expect, it } from 'vitest';
import { helpTextsFrom } from '@/features/shared/help/hooks/use-help-texts';
import { buildCorpus, isDecisive, rankTopics, tokenize } from '@/features/shared/help/search';
import enMessages from '@/i18n/messages/en.json';
import jaMessages from '@/i18n/messages/ja.json';

function lookupIn(messages: { help: { topics: Record<string, Record<string, string>> } }) {
  return (key: string) => {
    const [id, field] = key.split('.');
    return messages.help.topics[id ?? '']?.[field ?? ''] ?? key;
  };
}

const JA = buildCorpus(helpTextsFrom(lookupIn(jaMessages)));
const EN = buildCorpus(helpTextsFrom(lookupIn(enMessages)));

describe('tokenize', () => {
  it('英語は空白で切った小文字の語', () => {
    expect(tokenize('Reread What I wrote')).toEqual(['reread', 'what', 'i', 'wrote']);
  });

  it('日本語は 2 文字の並びと、漢字 1 文字', () => {
    const units = tokenize('去年の手紙');
    expect(units).toContain('去年');
    expect(units).toContain('手紙');
    expect(units).toContain('紙');
    // 仮名 1 文字（助詞）は拾わない。どの話題にも当たってしまう。
    expect(units).not.toContain('の');
    expect(units).toContain('年の');
  });

  it('空や記号だけなら空', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('…！？')).toEqual([]);
  });
});

describe('rankTopics（ja）', () => {
  it('「去年書いたものを読み返したい」は書庫', () => {
    expect(rankTopics('去年書いたものを読み返したい', JA)[0]?.id).toBe('archive');
  });

  it('「手紙はいつ届く」は手紙が先。漬け込みも上位に', () => {
    const ids = rankTopics('手紙はいつ届く', JA).map((m) => m.id);
    expect(ids[0]).toBe('letter');
    expect(ids.slice(0, 3)).toContain('pickle');
  });

  it('「問い合わせ」はサポート', () => {
    expect(rankTopics('問い合わせをしたい', JA)[0]?.id).toBe('support');
  });

  it('「瓶」は瓶（1 文字でも当たる）', () => {
    expect(rankTopics('瓶', JA)[0]?.id).toBe('jar');
  });

  it('関係の無い文は空', () => {
    expect(rankTopics('xyzzy', JA)).toEqual([]);
  });

  it('結果は近い順', () => {
    const scores = rankTopics('書く エントリー 縦書き', JA).map((m) => m.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});

describe('rankTopics（en）', () => {
  it('"reread what I wrote last year" is the archive', () => {
    expect(rankTopics('reread what I wrote last year', EN)[0]?.id).toBe('archive');
  });

  it('"change my password" is the account', () => {
    expect(rankTopics('change my password', EN)[0]?.id).toBe('account');
  });
});

describe('isDecisive', () => {
  it('1 位が 2 位を十分に引き離していれば、Jev には訊かない', () => {
    expect(
      isDecisive([
        { id: 'jar', score: 9, source: 'local' },
        { id: 'pickle', score: 3, source: 'local' },
      ]),
    ).toBe(true);
  });

  it('並んでいれば訊く', () => {
    expect(
      isDecisive([
        { id: 'jar', score: 5, source: 'local' },
        { id: 'pickle', score: 4, source: 'local' },
      ]),
    ).toBe(false);
  });

  it('何も当たっていなければ訊く', () => {
    expect(isDecisive([])).toBe(false);
  });

  it('1 件だけでも弱ければ訊く', () => {
    expect(isDecisive([{ id: 'jar', score: 2, source: 'local' }])).toBe(false);
    expect(isDecisive([{ id: 'jar', score: 4, source: 'local' }])).toBe(true);
  });
});
