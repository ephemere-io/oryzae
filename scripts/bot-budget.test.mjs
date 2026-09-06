import { describe, expect, it } from 'vitest';
import {
  barrenStreak,
  capUsd,
  extractCostUsd,
  monthKey,
  parseLedger,
  plan,
  recordRun,
  renderIssueBody,
  spentUsd,
} from './bot-budget.mjs';

/**
 * 予算ガバナー自体のテスト。
 *
 * このガバナーが静かに壊れると「上限を守れているつもりで課金され続ける」状態になる。
 * 気づけるのは請求が来たときで、そのときには手遅れ。だから
 * 「止めるべきときに止まる」ことを、通常系より厚くテストで固定する。
 */

const ledgerWith = (month, spentUsd, runs = []) => ({ version: 1, months: { [month]: { spentUsd, runs } } });
const CAP = capUsd({ budgetJpy: 500, jpyPerUsd: 170 }); // ≈ $2.94

describe('monthKey', () => {
  it('JST の月で切る', () => {
    // UTC では 8 月末だが JST では 9 月 1 日 6:00。円建て月額なので 9 月に載せる。
    expect(monthKey(new Date('2026-08-31T21:00:00Z'))).toBe('2026-09');
  });

  it('JST の月初直前は前月のまま', () => {
    expect(monthKey(new Date('2026-08-31T14:59:00Z'))).toBe('2026-08');
  });
});

describe('capUsd', () => {
  it('円の上限を為替で USD に直す', () => {
    expect(capUsd({ budgetJpy: 500, jpyPerUsd: 170 })).toBeCloseTo(2.941, 3);
  });

  it('為替や予算が不正なら 0（= 走らせない）', () => {
    expect(capUsd({ budgetJpy: 500, jpyPerUsd: 0 })).toBe(0);
    expect(capUsd({ budgetJpy: -1, jpyPerUsd: 170 })).toBe(0);
    expect(capUsd({ budgetJpy: Number.NaN, jpyPerUsd: 170 })).toBe(0);
  });
});

describe('parseLedger', () => {
  it('Issue 本文のフェンスから台帳を取り出す', () => {
    const body = renderIssueBody(ledgerWith('2026-09', 1.5), {
      capUsd: CAP,
      budgetJpy: 500,
      jpyPerUsd: 170,
      month: '2026-09',
    });
    expect(spentUsd(parseLedger(body), '2026-09')).toBe(1.5);
  });

  it('壊れた JSON は null を返す（0 円扱いにしない）', () => {
    expect(parseLedger('```json ledger\n{ not json\n```')).toBeNull();
  });

  it('フェンスが無ければ null', () => {
    expect(parseLedger('# 手で書き換えられた本文')).toBeNull();
    expect(parseLedger('```json ledger\n{"months":{}}')).toBeNull();
  });

  it('文字列以外は null', () => {
    expect(parseLedger(undefined)).toBeNull();
    expect(parseLedger({ months: {} })).toBeNull();
  });

  it('months を持たない JSON は台帳とみなさない', () => {
    expect(parseLedger('```json ledger\n{"total":3}\n```')).toBeNull();
  });
});

describe('plan — 止めるべきときに止まる', () => {
  const base = { month: '2026-09', capUsd: CAP, perRunCapUsd: 0.6, reservePct: 30, minRunUsd: 0.15 };

  it('台帳が読めなければ実行しない', () => {
    expect(plan({ ...base, ledger: null, kind: 'reactive' }).allowed).toBe(false);
  });

  it('上限に達していれば reactive でも実行しない', () => {
    expect(plan({ ...base, ledger: ledgerWith('2026-09', CAP), kind: 'reactive' }).allowed).toBe(false);
  });

  it('残りが最低額を下回れば実行しない', () => {
    const r = plan({ ...base, ledger: ledgerWith('2026-09', CAP - 0.1), kind: 'reactive' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('残額が足りない');
  });

  it('巡回は予備枠を食い潰さない', () => {
    // 予備枠 30% = $0.88。残り $0.5 は予備枠の内側なので巡回は走らない。
    const ledger = ledgerWith('2026-09', CAP - 0.5);
    expect(plan({ ...base, ledger, kind: 'sweep' }).allowed).toBe(false);
    // 同じ残額でも、壊れたものを直す reactive は走ってよい。
    expect(plan({ ...base, ledger, kind: 'reactive' }).allowed).toBe(true);
  });

  it('為替や予算が不正で上限 0 なら実行しない', () => {
    expect(plan({ ...base, capUsd: 0, ledger: ledgerWith('2026-09', 0), kind: 'reactive' }).allowed).toBe(
      false,
    );
  });

  it('別の月の使用額は今月の枠を削らない', () => {
    const ledger = ledgerWith('2026-08', CAP);
    expect(plan({ ...base, ledger, kind: 'sweep' }).allowed).toBe(true);
  });
});

describe('plan — 走るときの配分', () => {
  const base = { month: '2026-09', capUsd: CAP, perRunCapUsd: 0.6, reservePct: 30, minRunUsd: 0.15 };

  it('初回は 1 回あたり上限を渡す', () => {
    const r = plan({ ...base, ledger: { version: 1, months: {} }, kind: 'sweep' });
    expect(r.allowed).toBe(true);
    expect(r.budgetUsd).toBe(0.6);
  });

  it('残りが 1 回あたり上限より少なければ残りぶんだけ渡す', () => {
    const r = plan({ ...base, ledger: ledgerWith('2026-09', CAP - 0.3), kind: 'reactive' });
    expect(r.budgetUsd).toBeCloseTo(0.3, 4);
  });

  it('巡回に渡す額は予備枠を差し引いた残りを超えない', () => {
    const r = plan({ ...base, ledger: ledgerWith('2026-09', 1.7), kind: 'sweep' });
    // 残り ≈ 1.24、予備枠 ≈ 0.88 → 使えるのは ≈ 0.36
    expect(r.budgetUsd).toBeLessThan(0.4);
    expect(r.budgetUsd).toBeGreaterThan(0.3);
  });
});

describe('recordRun', () => {
  it('使用額を積み上げる', () => {
    const next = recordRun(ledgerWith('2026-09', 0.5), '2026-09', { at: 'x', costUsd: 0.25 });
    expect(spentUsd(next, '2026-09')).toBe(0.75);
  });

  it('浮動小数の誤差を台帳に残さない', () => {
    const next = recordRun(ledgerWith('2026-09', 0.1), '2026-09', { at: 'x', costUsd: 0.2 });
    expect(spentUsd(next, '2026-09')).toBe(0.3);
  });

  it('台帳が無くても新規に作る', () => {
    expect(spentUsd(recordRun(null, '2026-09', { at: 'x', costUsd: 0.4 }), '2026-09')).toBe(0.4);
  });

  it('元の台帳を書き換えない', () => {
    const before = ledgerWith('2026-09', 0.5);
    recordRun(before, '2026-09', { at: 'x', costUsd: 0.25 });
    expect(spentUsd(before, '2026-09')).toBe(0.5);
  });

  it('履歴と保持月数に蓋をする（Issue 本文の文字数上限を超えないため）', () => {
    let ledger = { version: 1, months: {} };
    for (let i = 0; i < 60; i++) ledger = recordRun(ledger, '2026-09', { at: `t${i}`, costUsd: 0.001 });
    expect(ledger.months['2026-09'].runs).toHaveLength(40);
    // 直近が残る
    expect(ledger.months['2026-09'].runs.at(-1).at).toBe('t59');

    for (const m of ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07']) {
      ledger = recordRun(ledger, m, { at: m, costUsd: 0.01 });
    }
    expect(Object.keys(ledger.months)).toHaveLength(6);
    expect(Object.keys(ledger.months)).not.toContain('2026-01');
  });
});

describe('extractCostUsd — 実費を読み落とさない', () => {
  it('stream-json の配列から result の費用を取る', () => {
    const log = JSON.stringify([
      { type: 'assistant', message: {} },
      { type: 'result', subtype: 'success', total_cost_usd: 0.4231, num_turns: 12 },
    ]);
    expect(extractCostUsd(log)).toBe(0.4231);
  });

  it('JSONL でも読める', () => {
    const log = ['{"type":"system"}', '{"type":"result","total_cost_usd":0.12}', ''].join('\n');
    expect(extractCostUsd(log)).toBe(0.12);
  });

  it('壊れた行が混ざっていても最後の値を取る', () => {
    const log = ['{"type":"result","total_cost_usd":0.10}', 'not json', '{"type":"result","total_cost_usd":0.31}'].join(
      '\n',
    );
    expect(extractCostUsd(log)).toBe(0.31);
  });

  it('入れ子に埋まっていても拾う', () => {
    expect(extractCostUsd(JSON.stringify({ run: { summary: { total_cost_usd: 0.77 } } }))).toBe(0.77);
  });

  it('JSON として壊れていてもキーが読めれば拾う', () => {
    expect(extractCostUsd('...途中で切れたログ "total_cost_usd": 0.55, "x')).toBe(0.55);
  });

  it('費用が無ければ null（呼び出し側が上限ぶん計上する）', () => {
    expect(extractCostUsd('{"type":"result"}')).toBeNull();
    expect(extractCostUsd('')).toBeNull();
    expect(extractCostUsd(null)).toBeNull();
  });
});

describe('renderIssueBody', () => {
  it('人が読む表と、機械が読み戻せる JSON を両方載せる', () => {
    const ledger = recordRun(null, '2026-09', {
      at: '2026-09-03T00:10:00Z',
      kind: 'sweep',
      costUsd: 0.42,
      result: 'merged:#570',
    });
    const body = renderIssueBody(ledger, { capUsd: CAP, budgetJpy: 500, jpyPerUsd: 170, month: '2026-09' });

    expect(body).toContain('¥500');
    expect(body).toContain('merged:#570');
    // 往復できること（読み戻せない本文を書いたら次回の実行が止まる）
    expect(spentUsd(parseLedger(body), '2026-09')).toBe(0.42);
  });

  it('実行履歴が空でも読み戻せる', () => {
    const body = renderIssueBody(
      { version: 1, months: {} },
      { capUsd: CAP, budgetJpy: 500, jpyPerUsd: 170, month: '2026-09' },
    );
    expect(parseLedger(body)).toEqual({ version: 1, months: {} });
  });
});

describe('barrenStreak — 直らないまま回り続けるのを止める', () => {
  const asRun = (result) => ({ at: 'x', costUsd: 0.1, result });
  const withRuns = (...results) => ({
    version: 1,
    months: { '2026-09': { spentUsd: 0.1 * results.length, runs: results.map(asRun) } },
  });

  it('マージできなかった実行が末尾に続いた数を返す', () => {
    expect(barrenStreak(withRuns('merged:#1', 'gates-failed', 'blocked'))).toBe(2);
  });

  it('成果のある実行が挟まればリセットされる', () => {
    expect(barrenStreak(withRuns('gates-failed', 'gates-failed', 'merged:#2'))).toBe(0);
  });

  it('「何も見つからなかった」は数えない（巡回の正常な結果なので）', () => {
    expect(barrenStreak(withRuns('gates-failed', 'gates-failed', 'no-fix'))).toBe(0);
  });

  it('月をまたいでも連続とみなす', () => {
    const ledger = {
      version: 1,
      months: {
        '2026-08': { spentUsd: 0.2, runs: [asRun('blocked')] },
        '2026-09': { spentUsd: 0.2, runs: [asRun('gates-failed'), asRun('blocked')] },
      },
    };
    expect(barrenStreak(ledger)).toBe(3);
  });

  it('履歴が無ければ 0', () => {
    expect(barrenStreak({ version: 1, months: {} })).toBe(0);
    expect(barrenStreak(null)).toBe(0);
  });

  it('3 回続いたら予算が残っていても実行しない', () => {
    const r = plan({
      ledger: withRuns('blocked', 'gates-failed', 'blocked'),
      month: '2026-09',
      capUsd: CAP,
      perRunCapUsd: 0.6,
      kind: 'reactive',
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('3 回続いた');
  });

  it('2 回までなら走る', () => {
    const r = plan({
      ledger: withRuns('blocked', 'gates-failed'),
      month: '2026-09',
      capUsd: CAP,
      perRunCapUsd: 0.6,
      kind: 'reactive',
    });
    expect(r.allowed).toBe(true);
  });
});
