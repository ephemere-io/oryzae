import { describe, expect, it } from 'vitest';
import { type InlineNode, type MdNode, parseInline, parseMarkdown } from '@/lib/markdown';

/** Drop the `id` field for shape-only assertions. */
function stripIds(node: InlineNode): unknown {
  switch (node.kind) {
    case 'text':
      return { kind: 'text', value: node.value };
    case 'bold':
      return { kind: 'bold', children: node.children.map(stripIds) };
    case 'code':
      return { kind: 'code', value: node.value };
    case 'link':
      return { kind: 'link', href: node.href, children: node.children.map(stripIds) };
  }
}

describe('parseInline', () => {
  it('returns plain text as a single text node', () => {
    expect(parseInline('hello world').map(stripIds)).toEqual([
      { kind: 'text', value: 'hello world' },
    ]);
  });

  it('parses **bold**', () => {
    expect(parseInline('a **bold** b').map(stripIds)).toEqual([
      { kind: 'text', value: 'a ' },
      { kind: 'bold', children: [{ kind: 'text', value: 'bold' }] },
      { kind: 'text', value: ' b' },
    ]);
  });

  it('parses inline `code`', () => {
    const out = parseInline('use `NEXT_LOCALE` cookie');
    expect(stripIds(out[1])).toEqual({ kind: 'code', value: 'NEXT_LOCALE' });
  });

  it('parses [link](url)', () => {
    const out = parseInline('see [docs](https://example.com) here');
    expect(stripIds(out[1])).toEqual({
      kind: 'link',
      href: 'https://example.com',
      children: [{ kind: 'text', value: 'docs' }],
    });
  });

  it('leaves unmatched ** as plain text', () => {
    expect(parseInline('a ** b').map(stripIds)).toEqual([{ kind: 'text', value: 'a ** b' }]);
  });

  it('assigns unique ids to every node', () => {
    const out = parseInline('a **b** [c](http://x) `d`');
    const ids = collectInlineIds(out);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

function collectInlineIds(nodes: InlineNode[]): number[] {
  const ids: number[] = [];
  for (const n of nodes) {
    ids.push(n.id);
    if (n.kind === 'bold' || n.kind === 'link') ids.push(...collectInlineIds(n.children));
  }
  return ids;
}

describe('parseMarkdown', () => {
  it('parses headings with their level', () => {
    const out = parseMarkdown('# H1\n\n## H2\n\n### H3');
    expect(out.map((n) => (n.kind === 'heading' ? n.level : null))).toEqual([1, 2, 3]);
  });

  it('groups consecutive non-empty lines into one paragraph', () => {
    const out = parseMarkdown('first line\nsecond line');
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('paragraph');
  });

  it('separates paragraphs by blank lines', () => {
    const out = parseMarkdown('a\n\nb\n\nc');
    expect(out).toHaveLength(3);
    expect(out.every((n) => n.kind === 'paragraph')).toBe(true);
  });

  it('parses unordered lists', () => {
    const out = parseMarkdown('- one\n- two\n- three');
    expect(out).toHaveLength(1);
    if (out[0].kind !== 'list') throw new Error('expected list');
    expect(out[0].ordered).toBe(false);
    expect(out[0].items).toHaveLength(3);
  });

  it('parses ordered lists', () => {
    const out = parseMarkdown('1. one\n2. two');
    expect(out).toHaveLength(1);
    if (out[0].kind !== 'list') throw new Error('expected list');
    expect(out[0].ordered).toBe(true);
    expect(out[0].items).toHaveLength(2);
  });

  it('parses tables with header and separator', () => {
    const src = [
      '| Provider | Purpose |',
      '|---|---|',
      '| Supabase | DB |',
      '| Vercel | Host |',
    ].join('\n');
    const out = parseMarkdown(src);
    expect(out).toHaveLength(1);
    if (out[0].kind !== 'table') throw new Error('expected table');
    expect(out[0].head).toHaveLength(2);
    expect(out[0].rows).toHaveLength(2);
    expect(out[0].rows[0].cells).toHaveLength(2);
  });

  it('does not treat a `|` line without a separator as a table', () => {
    const out = parseMarkdown('| not | a | table |\nnext line');
    expect(out[0].kind).toBe('paragraph');
  });

  it('handles blank lines at the start and end', () => {
    const out = parseMarkdown('\n\n# Title\n\n\n');
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('heading');
  });

  it('assigns unique ids across the whole document', () => {
    const src = '# H\n\n- a\n- b\n\n| x | y |\n|---|---|\n| 1 | 2 |\n\nplain **bold**.';
    const out = parseMarkdown(src);
    const ids = collectAllIds(out);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(0);
  });
});

function collectAllIds(nodes: MdNode[]): number[] {
  const ids: number[] = [];
  for (const n of nodes) {
    ids.push(n.id);
    if (n.kind === 'heading' || n.kind === 'paragraph') {
      ids.push(...collectInlineIds(n.text));
    } else if (n.kind === 'list') {
      for (const item of n.items) {
        ids.push(item.id, ...collectInlineIds(item.text));
      }
    } else {
      for (const cell of n.head) ids.push(cell.id, ...collectInlineIds(cell.text));
      for (const row of n.rows) {
        ids.push(row.id);
        for (const cell of row.cells) ids.push(cell.id, ...collectInlineIds(cell.text));
      }
    }
  }
  return ids;
}
