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

import { allUnits, runUnit, type VerifyResult } from '@oryzae/verify';
import { beforeAll, describe, expect, it } from 'vitest';
import { EXPECTED_FAIL } from './verify-expected-fail';
import '@/app/verify/register';

// runner は act 外で意図的に描画・観測するため、React の act 警告を抑止する。
Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', false);

describe('verify matrix', () => {
  const units = allUnits();

  it('has units registered', () => {
    expect(units.length).toBeGreaterThan(0);
  });

  for (const unit of units) {
    describe(unit.id, () => {
      /**
       * ユニットは **1 回だけ** 走らせる。
       *
       * `runUnit()` はそのユニットの全 fixture を実行する。以前はそれを fixture ごとの
       * `it()` の中で呼んでいたため、fixture が N 個のユニットで N×N 回ぶん実行していた
       * （6 個なら 36 回）。1 つの `it()` が 6 fixture ぶんの時間を背負うので、重いユニット
       * では既定の 5 秒を食い破り、負荷がかかった機械でタイムアウトが散発していた。
       * 落ちる先は毎回ちがい、アサーション失敗ではなく必ずタイムアウトだった。
       *
       * ここで 1 回走らせて結果を配れば、各 `it()` は配列を引くだけになる。
       */
      let results: VerifyResult[] = [];
      beforeAll(async () => {
        results = await runUnit(unit);
      });

      it('has at least one probe fixture', () => {
        expect(
          unit.fixtures.some((f) => f.probe),
          `Unit "${unit.id}" has no probe fixtures — only the happy path is covered.`,
        ).toBe(true);
      });

      for (const fixture of unit.fixtures) {
        const key = `${unit.id}::${fixture.id}`;
        const shouldFail = EXPECTED_FAIL.has(key);
        it(`${fixture.probe ? '🔍 ' : ''}${fixture.id} → ${shouldFail ? 'FAIL (by design)' : 'PASS'}`, () => {
          const r = results.find((x) => x.fixtureId === fixture.id);
          expect(r, `no result for ${key}`).toBeDefined();
          expect(r?.verdict).toBe(shouldFail ? 'FAIL' : 'PASS');
        });
      }
    });
  }
});
