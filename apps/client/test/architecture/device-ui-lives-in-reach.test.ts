import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

// 端末固有 UI は features/{pc,sp} にだけ置く。
// （doc: client-architecture-guide.md「各ディレクトリの責務」）
//
// なぜ機械強制するか: components/ や flat features に sp-*/pc-* を置くと reach 軸を
// 迂回できてしまう。Issue #490 では SP ボトムナビが components/ 直下に、PC サイドバーが
// features/auth（端末非依存のはずの flat）に置かれ、シェルが左右非対称になった。
// ファイル名の接頭辞を強制の取っ手にする（命名規則は doc の「命名規則」に従う）。

const DEVICE_PREFIX = /^(sp|pc)-/;

/**
 * 移行中の既知違反（Issue #490 Phase 4 で解消する）。
 * **減る一方**であること。解消したら削除する（消し忘れは下のテストが検出する）。
 */
const MIGRATING: string[] = ['src/components/sp-bottom-nav.tsx'];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** reach を持たない領域＝ components/ と flat features（pc/sp/shared 以外）。 */
function deviceAgnosticDirs(): string[] {
  const flat = readdirSync('src/features', { withFileTypes: true })
    .filter((e) => e.isDirectory() && !['pc', 'sp', 'shared'].includes(e.name))
    .map((e) => join('src/features', e.name));
  return ['src/components', ...flat];
}

function findViolations(): string[] {
  return deviceAgnosticDirs()
    .flatMap(walk)
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => DEVICE_PREFIX.test(basename(f)))
    .sort();
}

describe('端末固有 UI は features/{pc,sp} に置く', () => {
  it('components/ と flat features に sp-*/pc-* のファイルが無い', () => {
    const unexpected = findViolations().filter((f) => !MIGRATING.includes(f));
    expect(unexpected).toEqual([]);
  });

  it('陳腐化した allowlist を残さない（直したら MIGRATING から消す）', () => {
    const violations = findViolations();
    const stale = MIGRATING.filter((f) => !violations.includes(f));
    expect(stale).toEqual([]);
  });

  it('pc スライスに sp-*、sp スライスに pc-* を置かない', () => {
    const crossed = [
      ...walk('src/features/pc').filter((f) => basename(f).startsWith('sp-')),
      ...walk('src/features/sp').filter((f) => basename(f).startsWith('pc-')),
    ];
    expect(crossed).toEqual([]);
  });
});
