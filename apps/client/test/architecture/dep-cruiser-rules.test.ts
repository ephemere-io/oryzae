import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// reach アーキテクチャの機械強制（dep-cruiser）が「黙って腐らない」ための番人テスト。
// ルールが削除・弱体化されたら落ちる。

interface DepRule {
  name: string;
  severity: string;
  from?: { path?: string; pathNot?: string | string[] };
  to?: { path?: string; pathNot?: string | string[] };
}
interface DepConfig {
  forbidden: DepRule[];
}

const require = createRequire(import.meta.url);
const config: DepConfig = require('../../.dependency-cruiser.cjs');

function rule(name: string): DepRule {
  const found = config.forbidden.find((r) => r.name === name);
  if (!found) throw new Error(`dep-cruiser rule が見つかりません: ${name}`);
  return found;
}

function pathNotList(rule: DepRule): string[] {
  const pn = rule.to?.pathNot;
  if (Array.isArray(pn)) return pn;
  return pn ? [pn] : [];
}

describe('dep-cruiser guardrails (reach architecture)', () => {
  it('主要ルールが error 重大度で存在する', () => {
    for (const name of [
      'feature-isolation-flat',
      'reach-slice-isolation',
      'reach-shared-purity',
      'ui-components-independence',
      'lib-independence',
      'no-circular',
    ]) {
      expect(rule(name).severity).toBe('error');
    }
  });

  it('reach-slice-isolation: pc/sp は自ドメイン+shared 以外を禁止', () => {
    const r = rule('reach-slice-isolation');
    expect(r.from?.path).toContain('(pc|sp)');
    expect(pathNotList(r).some((p) => p.includes('shared'))).toBe(true);
  });

  it('reach-shared-purity: shared → pc/sp を禁止', () => {
    const r = rule('reach-shared-purity');
    expect(r.from?.path).toContain('shared');
    expect(r.to?.path).toContain('(pc|sp)');
  });

  it('feature-isolation-flat: flat → shared は許可（pathNot に shared）', () => {
    expect(pathNotList(rule('feature-isolation-flat')).some((p) => p.includes('shared'))).toBe(
      true,
    );
  });
});
