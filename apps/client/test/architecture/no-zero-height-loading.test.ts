import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 取得待ちに `return null` で**高さゼロ**を返さない。
 *
 * 見落としの実例: アカウント画面の統計セクション（WritingStats）が
 * `if (loading) return null` だったため、読み込み中は高さゼロ、届いた瞬間に
 * サマリーカード6枚＋月次推移12行がまとめて出現し、下のセクションを押し下げていた。
 * スクロール中は「急に画面が増える」ように見える。
 *
 * page.tsx 側は `route-loading.test.ts` が同じことを見ている。こちらは feature の
 * コンポーネント側。枠（スケルトン）を返すか、そもそも高さの変わらない形にすること。
 *
 * 検出するのは `loading` を条件にした `return null` だけ。`if (!open) return null`
 * （モーダルの閉状態）のように、そもそも場所を取らないのが正しいものは対象外。
 */

const ROOT = 'src/features';

/** `if (loading) return null` / `if (isLoading) return null;` 等を拾う。 */
const ZERO_HEIGHT_LOADING = /if\s*\([^)]*\b(is)?[Ll]oading\b[^)]*\)\s*(\{\s*)?return null/;

/** コメントを落としてから判定する（この規約自体を説明する文章が引っかかるため）。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

describe('取得待ちに高さゼロを返さない', () => {
  it('features のコンポーネントに `if (loading) return null` が無い', () => {
    const offenders = walk(ROOT)
      .filter((f) => f.endsWith('.tsx') && !f.endsWith('.verify.tsx'))
      .filter((f) => ZERO_HEIGHT_LOADING.test(stripComments(readFileSync(f, 'utf8'))))
      .sort();

    expect(offenders).toEqual([]);
  });
});
