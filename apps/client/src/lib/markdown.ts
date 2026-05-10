/**
 * Minimal Markdown renderer for legal documents (privacy policy, terms).
 *
 * Supports the subset that legal docs actually need:
 * - `# / ## / ###` headings
 * - paragraphs (blank-line separated)
 * - `- ` unordered lists
 * - `1. ` ordered lists
 * - `| ... |` GFM tables
 * - inline `**bold**`, `` `code` ``, `[text](url)`
 *
 * The output is a tree of `MdNode`s that components can render to React without
 * pulling in `react-markdown` / `marked` (~30KB of deps for two static pages).
 *
 * Every node is assigned a sequential `id` during parsing so that React keys
 * can be stable without falling back to array indexes.
 */

export type MdNode =
  | { id: number; kind: 'heading'; level: 1 | 2 | 3; text: InlineNode[] }
  | { id: number; kind: 'paragraph'; text: InlineNode[] }
  | { id: number; kind: 'list'; ordered: boolean; items: ListItem[] }
  | { id: number; kind: 'table'; head: TableCell[]; rows: TableRow[] };

interface ListItem {
  id: number;
  text: InlineNode[];
}

interface TableCell {
  id: number;
  text: InlineNode[];
}

interface TableRow {
  id: number;
  cells: TableCell[];
}

export type InlineNode =
  | { id: number; kind: 'text'; value: string }
  | { id: number; kind: 'bold'; children: InlineNode[] }
  | { id: number; kind: 'code'; value: string }
  | { id: number; kind: 'link'; href: string; children: InlineNode[] };

class IdGenerator {
  private next = 0;
  alloc(): number {
    return this.next++;
  }
}

/** Parse inline markdown (bold / code / link) into a flat node list. */
export function parseInline(input: string, ids: IdGenerator = new IdGenerator()): InlineNode[] {
  const nodes: InlineNode[] = [];
  let i = 0;

  function pushText(value: string) {
    if (value === '') return;
    const last = nodes[nodes.length - 1];
    if (last && last.kind === 'text') {
      last.value += value;
    } else {
      nodes.push({ id: ids.alloc(), kind: 'text', value });
    }
  }

  while (i < input.length) {
    const ch = input[i];

    // **bold**
    if (ch === '*' && input[i + 1] === '*') {
      const end = input.indexOf('**', i + 2);
      if (end !== -1) {
        nodes.push({
          id: ids.alloc(),
          kind: 'bold',
          children: parseInline(input.slice(i + 2, end), ids),
        });
        i = end + 2;
        continue;
      }
    }

    // `code`
    if (ch === '`') {
      const end = input.indexOf('`', i + 1);
      if (end !== -1) {
        nodes.push({ id: ids.alloc(), kind: 'code', value: input.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // [text](url)
    if (ch === '[') {
      const closeBracket = input.indexOf(']', i + 1);
      if (closeBracket !== -1 && input[closeBracket + 1] === '(') {
        const closeParen = input.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          const text = input.slice(i + 1, closeBracket);
          const href = input.slice(closeBracket + 2, closeParen);
          nodes.push({
            id: ids.alloc(),
            kind: 'link',
            href,
            children: parseInline(text, ids),
          });
          i = closeParen + 1;
          continue;
        }
      }
    }

    pushText(ch);
    i++;
  }

  return nodes;
}

function splitTableRow(line: string): string[] {
  // Strip leading/trailing pipe and whitespace, then split on `|`.
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  // e.g. `|---|---|` or `| :--- | ---: |`
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

/** Parse markdown source into a list of block nodes. */
export function parseMarkdown(src: string): MdNode[] {
  const ids = new IdGenerator();
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const nodes: MdNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      nodes.push({
        id: ids.alloc(),
        kind: 'heading',
        level,
        text: parseInline(headingMatch[2], ids),
      });
      i++;
      continue;
    }

    // Table: a `| ... |` line followed by a separator line.
    if (line.trim().startsWith('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const head: TableCell[] = splitTableRow(line).map((cell) => ({
        id: ids.alloc(),
        text: parseInline(cell, ids),
      }));
      i += 2;
      const rows: TableRow[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells: TableCell[] = splitTableRow(lines[i]).map((cell) => ({
          id: ids.alloc(),
          text: parseInline(cell, ids),
        }));
        rows.push({ id: ids.alloc(), cells });
        i++;
      }
      nodes.push({ id: ids.alloc(), kind: 'table', head, rows });
      continue;
    }

    // Unordered list
    if (/^\s*-\s+/.test(line)) {
      const items: ListItem[] = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push({ id: ids.alloc(), text: parseInline(lines[i].replace(/^\s*-\s+/, ''), ids) });
        i++;
      }
      nodes.push({ id: ids.alloc(), kind: 'list', ordered: false, items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: ListItem[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push({
          id: ids.alloc(),
          text: parseInline(lines[i].replace(/^\s*\d+\.\s+/, ''), ids),
        });
        i++;
      }
      nodes.push({ id: ids.alloc(), kind: 'list', ordered: true, items });
      continue;
    }

    // Paragraph: gather consecutive non-empty, non-block-leading lines.
    const paragraphLines: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (next.trim() === '') break;
      if (/^#{1,3}\s+/.test(next)) break;
      if (/^\s*-\s+/.test(next)) break;
      if (/^\s*\d+\.\s+/.test(next)) break;
      if (next.trim().startsWith('|')) break;
      paragraphLines.push(next);
      i++;
    }
    nodes.push({
      id: ids.alloc(),
      kind: 'paragraph',
      text: parseInline(paragraphLines.join(' '), ids),
    });
  }

  return nodes;
}
