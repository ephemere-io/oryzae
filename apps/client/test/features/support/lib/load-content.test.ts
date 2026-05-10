import { describe, expect, it } from 'vitest';
import { makeT, parseSupportMarkdown } from '@/features/support/lib/content-types';

describe('parseSupportMarkdown', () => {
  it('frontmatter の dot.path: value をフラットマップに展開する', () => {
    const md = `---\nhero.title: 使い方\nnav.cta: アプリを試す\n---\n\n# body.key\n本文\n`;
    const result = parseSupportMarkdown(md);
    expect(result['hero.title']).toBe('使い方');
    expect(result['nav.cta']).toBe('アプリを試す');
  });

  it('body の `# key` セクションを本文として取り込む', () => {
    const md = `---\na: 1\n---\n\n# intro.lead\n複数行の\n本文。\n\n# faq.1.q\n質問？\n`;
    const result = parseSupportMarkdown(md);
    expect(result['intro.lead']).toBe('複数行の\n本文。');
    expect(result['faq.1.q']).toBe('質問？');
  });

  it('frontmatter 内のコメント行と空行を無視する', () => {
    const md = `---\n# これはコメント\n\nhero.title: タイトル\n---\n`;
    const result = parseSupportMarkdown(md);
    expect(result['hero.title']).toBe('タイトル');
    expect(Object.keys(result)).toEqual(['hero.title']);
  });

  it('frontmatter が無いと例外を投げる', () => {
    expect(() => parseSupportMarkdown('# key\nvalue')).toThrow(/frontmatter/);
  });

  it('値に半角コロンを含んでも最初のコロンで分割する', () => {
    const md = `---\nintro.title: Oryzae: 4つの場所\n---\n`;
    const result = parseSupportMarkdown(md);
    expect(result['intro.title']).toBe('Oryzae: 4つの場所');
  });
});

describe('makeT', () => {
  it('存在するキーを返す', () => {
    const t = makeT({ 'hero.title': '使い方' });
    expect(t('hero.title')).toBe('使い方');
  });

  it('存在しないキーで例外を投げる', () => {
    const t = makeT({});
    expect(() => t('missing.key')).toThrow(/未定義のキー/);
  });
});
