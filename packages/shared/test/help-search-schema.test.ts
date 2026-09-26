import { describe, expect, it } from 'vitest';
import { helpSearchSchema } from '../src/index.js';

/**
 * `helpSearchSchema` の境界。サーバーはこの形をそのまま外部 API（Jev）へ転送するので、
 * 上限（文の長さ・選択肢の数）が緩むと、有料 API へ送る量がそのぶん増える。
 */

/** `[a-z_]{1,32}` に収まる id を n 個。数字は使えないので 2 文字の英字で数える。 */
function topicsOf(n: number): { id: string; label: string }[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))}`,
    label: `話題 ${i}`,
  }));
}

const VALID = {
  query: '去年書いたものを読み返したい',
  screen: '/jar',
  locale: 'ja',
  topics: [
    { id: 'jar', label: '瓶' },
    { id: 'write', label: '書く' },
  ],
};

describe('helpSearchSchema', () => {
  it('正しい入力は通り、query の前後の空白は落とす', () => {
    const parsed = helpSearchSchema.parse({ ...VALID, query: '  手紙はいつ届く？  ' });
    expect(parsed.query).toBe('手紙はいつ届く？');
    expect(parsed.topics).toEqual(VALID.topics);
  });

  const cases: { name: string; input: Record<string, unknown>; ok: boolean }[] = [
    { name: 'query が 200 字', input: { ...VALID, query: 'あ'.repeat(200) }, ok: true },
    { name: 'query が 201 字', input: { ...VALID, query: 'あ'.repeat(201) }, ok: false },
    { name: 'query が空', input: { ...VALID, query: '' }, ok: false },
    { name: 'query が空白だけ', input: { ...VALID, query: '   ' }, ok: false },
    { name: 'screen が 64 字', input: { ...VALID, screen: '/'.repeat(64) }, ok: true },
    { name: 'screen が 65 字', input: { ...VALID, screen: '/'.repeat(65) }, ok: false },
    { name: 'locale が未対応', input: { ...VALID, locale: 'xx' }, ok: false },
    {
      name: '話題 id に大文字（Jar）',
      input: { ...VALID, topics: [{ id: 'Jar', label: '瓶' }, VALID.topics[1]] },
      ok: false,
    },
    {
      name: '話題 id に数字（jar2）',
      input: { ...VALID, topics: [{ id: 'jar2', label: '瓶' }, VALID.topics[1]] },
      ok: false,
    },
    { name: '話題が 40 個', input: { ...VALID, topics: topicsOf(40) }, ok: true },
    { name: '話題が 41 個', input: { ...VALID, topics: topicsOf(41) }, ok: false },
    { name: '話題が 2 個', input: { ...VALID, topics: topicsOf(2) }, ok: true },
    { name: '話題が 1 個', input: { ...VALID, topics: topicsOf(1) }, ok: false },
  ];

  it.each(cases)('$name', ({ input, ok }) => {
    expect(helpSearchSchema.safeParse(input).success).toBe(ok);
  });
});
