import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ロード表示は画面ごとに決める。ルートグループに1枚だけ置く運用は構造的に間違い
 * （どの画面へ移動しても同じもの＝一覧の枠が出ていた）。
 *
 * 何を出すか（スケルトン or PageLoading）は画面の性質で変わるが、**ルートごとに1つ持つ**
 * という構造は共通なので、import では見えないこの点を機械強制する:
 *  1. 保護ルートの page.tsx には、必ず同じ階層に loading.tsx がある
 *     （無いと1つ上の loading.tsx＝別画面のものが使われる）
 *  2. ルートグループ直下に loading.tsx を置かない
 *     （置くと 1 の抜けが「別画面のロード表示」として黙って埋まってしまう）
 *  3. 各 loading.tsx は `_loading/` の *RouteLoading を描く（実装を散らかさない）
 *
 * 行き先ごとに実際に出るものが変わるかは `test/app/route-loading.test.tsx` が描画して確認する。
 */

const PROTECTED_ROOT = 'src/app/(protected)';

/** 保護ルート配下の page.tsx があるディレクトリを列挙する（`_` 始まりは private folder）。 */
function routeDirs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const full = join(dir, entry.name);
    if (existsSync(join(full, 'page.tsx'))) out.push(full);
    out.push(...routeDirs(full));
  }
  return out;
}

describe('保護ルートは画面ごとのロード表示を持つ', () => {
  const dirs = routeDirs(PROTECTED_ROOT);

  it('保護ルートを検出できている（テスト自体が空振りしていない）', () => {
    expect(dirs.length).toBeGreaterThan(0);
  });

  it('page.tsx のあるルートには loading.tsx が同居する', () => {
    const missing = dirs.filter((d) => !existsSync(join(d, 'loading.tsx')));
    expect(missing).toEqual([]);
  });

  it('ルートグループ直下に共通の loading.tsx を置かない', () => {
    expect(existsSync(join(PROTECTED_ROOT, 'loading.tsx'))).toBe(false);
  });

  it('各 loading.tsx は _loading の *RouteLoading を描く', () => {
    const offenders = dirs.filter((d) => {
      const src = readFileSync(join(d, 'loading.tsx'), 'utf8');
      return !/_loading\/[a-z-]+-route-loading/.test(src);
    });
    expect(offenders).toEqual([]);
  });
});
