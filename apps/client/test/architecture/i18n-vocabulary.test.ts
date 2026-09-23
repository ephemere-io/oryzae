import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * **同じ物を、端末ごとに違う名前で呼ばない。**
 *
 * 実例: ボードの道具箱で、PC は「スニペットを作成」と出しているのに、SP の短い名前だけ
 * 「抜粋」になっていた（韓国語も 스니펫 / 발췌 で割れていた）。同じ機能が端末で別の名前に
 * なると、説明も問い合わせも噛み合わなくなる。型もテストも通ってしまうので、
 * レビューで人が気づくまで残った。
 *
 * ここで縛るのは 2 つ:
 *  1. 4 言語のキーの集合が一致する（どれか 1 言語だけ足し忘れない）
 *  2. **短い名前は正式名称の短縮形である**（「スニペットを作成」に対する「スニペット」）。
 *     語そのものを固定すると翻訳を変えるたびにテストを直すことになるので、
 *     語ではなく**関係**を見る。言語を問わず効く。
 */

const LOCALES = ['ja', 'en', 'ko', 'zh'] as const;
type Locale = (typeof LOCALES)[number];

function load(locale: Locale): unknown {
  return JSON.parse(readFileSync(`src/i18n/messages/${locale}.json`, 'utf8'));
}

const MESSAGES = new Map<Locale, unknown>(LOCALES.map((locale) => [locale, load(locale)]));

/** `board.toolbar.snippet` のような道を辿って文字列を取り出す（無ければ失敗させる）。 */
function text(locale: Locale, path: string): string {
  let node = MESSAGES.get(locale);
  for (const key of path.split('.')) {
    if (typeof node !== 'object' || node === null || !(key in node)) {
      throw new Error(`${locale}.json に ${path} が無い`);
    }
    node = Object.getOwnPropertyDescriptor(node, key)?.value;
  }
  if (typeof node !== 'string') throw new Error(`${locale}.json の ${path} が文字列ではない`);
  return node;
}

function keysOf(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix];
  return Object.entries(node).flatMap(([key, value]) => keysOf(value, `${prefix}${key}.`));
}

/**
 * 道具箱の「短い名前」と、その正式名称の対。
 *
 * スマホにはホバーが無いので、アイコンの下に短い名前を添えている（#616 の ActionPalette）。
 * その短い名前は、読み上げに使う正式名称を縮めたものでなければならない。
 */
const SHORT_LABELS = [
  { short: 'sp.board.tool_snippet', full: 'sp.board.add_snippet' },
  { short: 'sp.board.tool_photo', full: 'sp.board.add_photo' },
];

/** PC と SP で必ず同じ言葉を使うもの（作る物の名前）。 */
const SHARED_WORDS = [{ pc: 'board.toolbar.snippet', sp: 'sp.board.add_snippet' }];

describe('i18n の語彙', () => {
  it('4 言語のキーが一致する', () => {
    const ja = keysOf(MESSAGES.get('ja')).sort();
    for (const locale of LOCALES) {
      expect(keysOf(MESSAGES.get(locale)).sort(), `${locale}.json`).toEqual(ja);
    }
  });

  it.each(SHORT_LABELS)('$short は $full の短縮形', ({ short, full }) => {
    for (const locale of LOCALES) {
      const caption = text(locale, short);
      const label = text(locale, full);
      expect(
        label.toLowerCase().includes(caption.toLowerCase()),
        `${locale}: 「${caption}」は「${label}」の短縮形ではない（同じ物を別の名前で呼んでいる）`,
      ).toBe(true);
    }
  });

  it.each(SHARED_WORDS)('$pc と $sp は同じ言葉', ({ pc, sp }) => {
    for (const locale of LOCALES) {
      expect(text(locale, sp), `${locale}: PC と SP で名前が割れている`).toBe(text(locale, pc));
    }
  });
});
