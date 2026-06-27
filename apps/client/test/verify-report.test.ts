/**
 * Verify Report ジェネレータ。
 *
 * matrix ゲートと同じ runUnit を jsdom 上で全ユニット×fixture に回し、結果を Markdown と JSON に
 * 書き出す。CI の「Verify Report」ジョブがこの Markdown を読み、PR に sticky コメントとして貼る
 * （GIF 手貼りの置き換え）。1 定義の 5 番目の利用者: CI matrix / dashboard / replay / window.__verify /
 * （これ）PR レポート。
 *
 * これは「ゲート」ではなく「ビュー」。verdict の合否は matrix が assert する。ここは units>0 の
 * サニティだけ確認し、あとはレポートを生成するだけ（意図的 FAIL でも落とさない）。
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Verdict, VerifyResult } from '@oryzae/verify';
import { allUnits, runUnit } from '@oryzae/verify';
import { describe, expect, it } from 'vitest';
import { EXPECTED_FAIL } from './verify-expected-fail';
import '@/lib/verify/register';

// runner は act 外で描画・観測するため、React の act 警告を抑止する。
Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', false);

// vitest の cwd は apps/client（--filter 実行・pnpm test とも）。CI もこのパスを読む。
const MD_OUT = join(process.cwd(), 'verify-report.md');
const JSON_OUT = join(process.cwd(), 'verify-report.json');

function verdictIcon(v: Verdict): string {
  if (v === 'PASS') return '✅';
  if (v === 'FAIL') return '❌';
  if (v === 'BLOCKED') return '⛔';
  return '⬜';
}

function isExpectedFail(r: VerifyResult): boolean {
  return EXPECTED_FAIL.has(`${r.unitId}::${r.fixtureId}`);
}

function buildMarkdown(results: VerifyResult[], unitCount: number): string {
  const pass = results.filter((r) => r.verdict === 'PASS').length;
  const fail = results.filter((r) => r.verdict === 'FAIL').length;
  const blocked = results.filter((r) => r.verdict === 'BLOCKED').length;
  const expected = results.filter((r) => r.verdict === 'FAIL' && isExpectedFail(r)).length;
  const unexpectedFail = fail - expected;

  // probe 情報の早見表（unitId::fixtureId → probe）。
  const probeOf = new Map<string, boolean>();
  for (const u of allUnits()) {
    for (const f of u.fixtures) probeOf.set(`${u.id}::${f.id}`, Boolean(f.probe));
  }

  const headline =
    unexpectedFail > 0
      ? `🔴 **${unexpectedFail} 件の想定外 FAIL**`
      : blocked > 0
        ? `🟡 **${blocked} 件 BLOCKED（観測不能）**`
        : `🟢 **all green**`;

  const expectedNote = expected > 0 ? `  ·  ${expected} expected-fail（嘘検出の実証）` : '';

  const rows = results.map((r) => {
    const key = `${r.unitId}::${r.fixtureId}`;
    const probe = probeOf.get(key) ? '🔍 ' : '';
    const expectedTag = r.verdict === 'FAIL' && isExpectedFail(r) ? ' *(expected)*' : '';
    return `| \`${r.unitId}\` | ${probe}\`${r.fixtureId}\` | ${verdictIcon(r.verdict)} ${r.verdict}${expectedTag} | ${r.checks.length} | ${r.durationMs} |`;
  });

  return [
    '## 🔬 Verify Harness Report',
    '',
    `${headline}  —  ${unitCount} units · ${results.length} fixtures · ✅ ${pass} / ❌ ${fail} / ⛔ ${blocked}${expectedNote}`,
    '',
    '| Unit | Fixture | Verdict | Checks | ms |',
    '|------|---------|---------|--------|----|',
    ...rows,
    '',
    '> 開発時は `/verify`（ダッシュボード）・`/verify/replay`（ライブ再生）でも同じ結果を確認できます。',
  ].join('\n');
}

describe('verify report', () => {
  it('全ユニットを実行して Markdown/JSON レポートを生成する', async () => {
    const units = allUnits();
    expect(units.length, 'no verify units registered').toBeGreaterThan(0);

    const results: VerifyResult[] = [];
    for (const unit of units) {
      results.push(...(await runUnit(unit)));
    }

    writeFileSync(MD_OUT, buildMarkdown(results, units.length));
    writeFileSync(JSON_OUT, JSON.stringify({ units: units.length, results }, null, 2));
  });
});
