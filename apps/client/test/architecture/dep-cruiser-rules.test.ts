import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// reach アーキテクチャの機械強制（dep-cruiser）が「黙って腐らない」ための番人テスト。
// ルールが削除・弱体化されたら落ちる。

interface DepRule {
  name: string;
  severity: string;
  module?: { path?: string };
  from?: { path?: string; pathNot?: string | string[] };
  to?: { path?: string; pathNot?: string | string[] };
}
interface DepConfig {
  forbidden: DepRule[];
  required?: DepRule[];
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

  // Issue #490: app への押し上げ・flat への fetch 残留を塞ぐルール。
  // 移行完了まで warn、Phase 6 で error に上げる（severity はここでは問わない）。
  it('app/flat の fetch 抜け道ルールが存在する', () => {
    for (const name of ['app-no-api-client', 'app-no-reach-hooks', 'flat-features-no-api']) {
      expect(rule(name).name).toBe(name);
    }
  });

  it('app-no-reach-hooks: app → features/{pc,sp}/*/hooks を禁止（seam 漏れ防止）', () => {
    const r = rule('app-no-reach-hooks');
    expect(r.from?.path).toContain('src/app/');
    expect(r.to?.path).toContain('(pc|sp)');
    expect(r.to?.path).toContain('hooks');
  });

  it('app-no-api-client: Route Handler は除外される', () => {
    const r = rule('app-no-api-client');
    expect(r.from?.pathNot).toContain('src/app/api/');
    expect(r.to?.path).toContain('lib/api');
  });

  it('seam 強制: 保護 page は DeviceView を required している', () => {
    const req = (config.required ?? []).find((r) => r.name === 'protected-pages-use-device-view');
    expect(req?.severity).toBe('error');
    expect(req?.module?.path).toContain('protected');
    expect(req?.to?.path).toContain('device-view');
  });
});
