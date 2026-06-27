/**
 * 検証マトリクス（CIゲート本体）。
 *
 * 登録された全ユニット×fixture を全 verifier に通し verdict を assert する。
 * これは window.__verify.runAll() と dashboard の Run all と同じコード経路。
 * 1つの真実、3つの消費者。`pnpm test`（CI の test ジョブ）でそのまま走る。
 *
 * ルール:
 *  - 全ユニットは最低1つの probe fixture を持つ（ハッピーパスだけの検証は不可）。
 *  - 意図的に失敗する probe は EXPECTED_FAIL に登録し「FAILすること」を assert する
 *    → ハーネスが嘘を捕まえられること自体を保証する。
 */

import { allUnits, runUnit } from '@oryzae/verify';
import { describe, expect, it } from 'vitest';
import '@/lib/verify/register';
import { EXPECTED_FAIL } from './verify-expected-fail';

// runner は act 外で意図的に描画・観測するため、React の act 警告を抑止する。
Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', false);

describe('verify matrix', () => {
  const units = allUnits();

  it('has units registered', () => {
    expect(units.length).toBeGreaterThan(0);
  });

  for (const unit of units) {
    describe(unit.id, () => {
      it('has at least one probe fixture', () => {
        expect(
          unit.fixtures.some((f) => f.probe),
          `Unit "${unit.id}" has no probe fixtures — only the happy path is covered.`,
        ).toBe(true);
      });

      for (const fixture of unit.fixtures) {
        const key = `${unit.id}::${fixture.id}`;
        const shouldFail = EXPECTED_FAIL.has(key);
        it(`${fixture.probe ? '🔍 ' : ''}${fixture.id} → ${shouldFail ? 'FAIL (by design)' : 'PASS'}`, async () => {
          const results = await runUnit(unit);
          const r = results.find((x) => x.fixtureId === fixture.id);
          expect(r, `no result for ${key}`).toBeDefined();
          expect(r?.verdict).toBe(shouldFail ? 'FAIL' : 'PASS');
        });
      }
    });
  }
});
