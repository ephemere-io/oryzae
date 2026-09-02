import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// features/pc と features/sp の間にコピペを作らせない。
//
// なぜ機械強制するか: これは #490 の**症状そのもの**だから。当時は「SP が PC のコードを
// 再利用できない」構造だったため、コピーするしか選択肢が無かった。その構造は
// features/shared への集約（fetch・型・端末非依存 UI）で解消したが、**共有できるように
// なっただけで、コピーが禁止されたわけではない**。
//
// reach-slice-isolation は pc → sp の import を止めるが、コピペは import を作らないので
// dep-cruiser では原理的に検出できない。ここはテキストの類似度で見るしかない。
//
// 閾値の根拠（測定値）:
//   正当な別実装（現存 6 ペア）  0.063 〜 0.304
//   コピペ（リネーム＋微修正）    1.000
// 大きく空いた谷の中央に閾値を置く。端末ごとに体験を作り分けている限り 0.3 を超えない。

const PC = 'src/features/pc';
const SP = 'src/features/sp';

/** これ以上似ていたらコピペとみなす。 */
const SIMILARITY_THRESHOLD = 0.6;

/** 小さすぎるファイルは偶然一致しうるので対象外にする（正規化後の行数）。 */
const MIN_LINES = 20;

/**
 * 移行中の既知の重複。**減る一方**であること。
 * 解消したら削除する（消し忘れは下の「陳腐化した allowlist」テストが検出する）。
 */
const MIGRATING: string[] = [];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/**
 * 比較用に正規化する。
 * コメントと空白を落とし、`sp-` / `Sp` / `pc-` / `Pc` の接頭辞を剥がす。
 * 接頭辞を残すと「名前を付け替えただけのコピー」が別物に見えてしまう。
 */
function normalize(source: string): string[] {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '')
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/\bsp-/gi, '')
        .replace(/\bSp([A-Z])/g, '$1')
        .replace(/\bpc-/gi, '')
        .replace(/\bPc([A-Z])/g, '$1'),
    )
    .filter((line) => line.length > 0);
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const line of setA) if (setB.has(line)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function components(dir: string): string[] {
  return walk(dir).filter((f) => f.endsWith('.tsx') && !f.endsWith('.verify.tsx'));
}

interface Duplicate {
  pair: string;
  similarity: number;
}

function findDuplicates(): Duplicate[] {
  const pcFiles = components(PC).map((f) => ({
    path: f,
    lines: normalize(readFileSync(f, 'utf8')),
  }));
  const spFiles = components(SP).map((f) => ({
    path: f,
    lines: normalize(readFileSync(f, 'utf8')),
  }));

  const found: Duplicate[] = [];
  for (const pc of pcFiles) {
    if (pc.lines.length < MIN_LINES) continue;
    for (const sp of spFiles) {
      if (sp.lines.length < MIN_LINES) continue;
      const similarity = jaccard(pc.lines, sp.lines);
      if (similarity >= SIMILARITY_THRESHOLD) {
        // キーは reach ルートからの相対パス。basename だと別ドメインの同名ファイル
        // （pc/entries/.../card.tsx と pc/board/.../card.tsx 等）が同じ文字列になり、
        // allowlist に 1 件足しただけで無関係なペアまで免除されてしまう。
        found.push({
          pair: `${relative(PC, pc.path)} ⇔ ${relative(SP, sp.path)}`,
          similarity,
        });
      }
    }
  }
  return found.sort((a, b) => b.similarity - a.similarity);
}

describe('pc と sp の間にコピペを作らない', () => {
  it(`類似度 ${SIMILARITY_THRESHOLD} 以上のコンポーネント対が無い`, () => {
    const unexpected = findDuplicates()
      .filter((d) => !MIGRATING.includes(d.pair))
      .map((d) => `${d.pair} (${d.similarity.toFixed(2)})`);

    // 共有したい部分は features/shared/{domain}/ へ切り出す。
    // 端末で体験を変えたい部分だけを pc/sp に残す。
    expect(unexpected).toEqual([]);
  });

  it('陳腐化した allowlist を残さない（直したら MIGRATING から消す）', () => {
    const current = findDuplicates().map((d) => d.pair);
    const stale = MIGRATING.filter((pair) => !current.includes(pair));
    expect(stale).toEqual([]);
  });
});
