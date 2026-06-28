import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// features/shared は「端末非依存・UIなし」のロジック層。UI(.tsx) が紛れ込んだら落ちる。
// （doc: shared = データ hook / 型のみ。UI は pc/sp、または端末非依存 UI は flat features）

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

describe('features/shared は UI を持たない', () => {
  it('.tsx ファイルが存在しない', () => {
    const tsx = walk('src/features/shared').filter((f) => f.endsWith('.tsx'));
    expect(tsx).toEqual([]);
  });
});
