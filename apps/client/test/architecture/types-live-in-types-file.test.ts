import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ドメイン型は features/{reach}/{domain}/types.ts に置く。hooks/ から型を export しない。
// （doc: client-architecture-guide.md「命名規則」型ファイル = types.ts）
//
// なぜ機械強制するか: 型が hook ファイルに同居すると、その型を使いたい別 reach は
// hook ごと import するしかなくなり、reach 分離に阻まれて型を再定義する。Issue #490 では
// 同じ発酵詳細の型が pc/fermentation・pc/entries・shared/fermentation に 3つ生えた。

/**
 * 移行中の既知違反（Issue #490 Phase 2 で解消する）。
 * **減る一方**であること。解消したら削除する（消し忘れは下のテストが検出する）。
 */
const MIGRATING: string[] = [
  'src/features/pc/board/hooks/use-board.ts',
  'src/features/pc/entries/hooks/use-entry-fermentation-detail.ts',
  'src/features/pc/entries/hooks/use-voice-dynamics.ts',
  'src/features/pc/fermentation/hooks/use-fermentation-results.ts',
  'src/features/pc/fermentation/hooks/use-jar-layout-save.ts',
  'src/features/shared/entries/hooks/use-entries.ts',
  'src/features/shared/entries/hooks/use-entry-draft.ts',
  'src/features/shared/fermentation/hooks/use-fermentation-inbox.ts',
];

const EXPORTED_TYPE = /^export\s+(interface|type)\s/m;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function findViolations(): string[] {
  return walk('src/features')
    .filter((f) => /\/hooks\/.*\.tsx?$/.test(f))
    .filter((f) => EXPORTED_TYPE.test(readFileSync(f, 'utf8')))
    .sort();
}

describe('ドメイン型は types.ts に置く', () => {
  it('features/**/hooks/ が型を export していない', () => {
    const unexpected = findViolations().filter((f) => !MIGRATING.includes(f));
    expect(unexpected).toEqual([]);
  });

  it('陳腐化した allowlist を残さない（直したら MIGRATING から消す）', () => {
    const violations = findViolations();
    const stale = MIGRATING.filter((f) => !violations.includes(f));
    expect(stale).toEqual([]);
  });
});
