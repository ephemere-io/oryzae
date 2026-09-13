import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 書斎が有効な間、**もともとのナビゲーションを一切描かない**。
 *
 * 書斎は「それ自体が唯一のグローバルナビゲーションになる」（00-overview.md）。旧ナビが
 * 1 つでも残ると、戻り道が左上のマークと旧ナビで二重になり、どちらが正なのか分からなくなる。
 *
 * ここを import 関係では見られない — 部品は**フラグ off のときのために残す**ので、
 * ファイルもコードも消えない。消えているべきなのは「描かれること」だけなので、
 * 描画の分岐そのものを読む。
 */

const LAYOUT = join(process.cwd(), 'src', 'app', '(protected)', 'layout.tsx');
const SP_SHELL = join(
  process.cwd(),
  'src',
  'features',
  'sp',
  'navigation',
  'components',
  'sp-shell.tsx',
);

/**
 * 旧ナビの部品。フラグ off のときだけ描いてよい。
 *
 * `Sidebar` は layout が直接 `!studyHome &&` で守る。`SpBottomNav` は SP の殻（`SpShell`）が
 * `bottomNav &&` で守り、layout が `bottomNav={!studyHome}` を渡す。分岐が 2 か所に分かれるので
 * 両方を読む。
 */
const OLD_NAVIGATION = ['Sidebar', 'SpBottomNav'];

function layoutSource(): string {
  return readFileSync(LAYOUT, 'utf8');
}

function jsxLines(source: string, component: string): string[] {
  return source
    .split('\n')
    .filter((line) => line.includes(`<${component} `) || line.includes(`<${component}/`));
}

describe('書斎が有効な間、旧ナビを描かない', () => {
  it('Sidebar は layout で !studyHome のときだけ描く', () => {
    const lines = jsxLines(layoutSource(), 'Sidebar');
    expect(lines.length, 'Sidebar が layout に無い').toBeGreaterThan(0);
    for (const line of lines) {
      expect(line, `Sidebar がフラグで守られていない: ${line.trim()}`).toContain('!studyHome &&');
    }
  });

  it('SpBottomNav は殻で bottomNav のときだけ描き、layout は !studyHome を渡す', () => {
    const lines = jsxLines(readFileSync(SP_SHELL, 'utf8'), 'SpBottomNav');
    expect(lines.length, 'SpBottomNav が殻に無い').toBeGreaterThan(0);
    for (const line of lines) {
      expect(line, `SpBottomNav がフラグで守られていない: ${line.trim()}`).toContain(
        'bottomNav &&',
      );
    }
    expect(layoutSource(), 'layout が殻に !studyHome を渡していない').toContain(
      'bottomNav={!studyHome}',
    );
  });

  it('旧ナビは layout と殻以外から描かれない（検証スペックを除く）', () => {
    // どこか別の画面が直接置いていると、layout の分岐をすり抜ける。
    const src = join(process.cwd(), 'src');
    const hits = grepJsx(src, OLD_NAVIGATION).filter(
      (hit) =>
        !hit.file.endsWith('.verify.tsx') &&
        !hit.file.endsWith('layout.tsx') &&
        !hit.file.endsWith('sp-shell.tsx'),
    );
    expect(hits.map((hit) => `${hit.file}: ${hit.line}`)).toEqual([]);
  });
});

interface Hit {
  file: string;
  line: string;
}

function grepJsx(dir: string, components: readonly string[]): Hit[] {
  const hits: Hit[] = [];

  const walk = (current: string): void => {
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (!path.endsWith('.tsx')) continue;
      const source = readFileSync(path, 'utf8');
      for (const line of source.split('\n')) {
        for (const component of components) {
          if (line.includes(`<${component} `) || line.includes(`<${component}/`)) {
            hits.push({ file: path, line: line.trim() });
          }
        }
      }
    }
  };

  walk(dir);
  return hits;
}
