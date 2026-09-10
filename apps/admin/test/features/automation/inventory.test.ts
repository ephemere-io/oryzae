import { describe, expect, it } from 'vitest';
import {
  AUTOMATIONS,
  type Automation,
  scheduledAutomations,
  tokenSpendingAutomations,
} from '@/features/automation/inventory';

/**
 * 自動実行一覧のテスト。
 *
 * この一覧は「勝手に動いているものを把握する」ための唯一の場所なので、
 * 中身が欠けたまま画面に出るのが一番まずい（把握できているつもりになる）。
 * 実態との一致は scripts/check-automation-inventory.mjs が見るので、
 * ここでは「項目として成立しているか」と集計の正しさを固定する。
 */

const fake = (over: Partial<Automation>): Automation => ({
  id: 'x',
  name: 'x',
  purpose: 'x',
  triggers: [],
  schedule: null,
  costKind: 'none',
  costPerRun: '¥0',
  killSwitch: 'x',
  definedIn: '.github/workflows/x.yml',
  ...over,
});

describe('AUTOMATIONS', () => {
  it('id が重複していない', () => {
    const ids = AUTOMATIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('全項目に「何をするか」「止め方」「定義場所」が埋まっている', () => {
    for (const a of AUTOMATIONS) {
      expect(a.purpose, `${a.id} の purpose`).not.toBe('');
      expect(a.killSwitch, `${a.id} の killSwitch`).not.toBe('');
      expect(a.costPerRun, `${a.id} の costPerRun`).not.toBe('');
      expect(a.definedIn, `${a.id} の definedIn`).toMatch(/^\.github\//);
    }
  });

  it('自動で動く条件が 1 つも無い項目は載せない（人が起動するものは対象外）', () => {
    for (const a of AUTOMATIONS) {
      expect(
        a.schedule !== null || a.triggers.length > 0,
        `${a.id} は schedule も triggers も無い`,
      ).toBe(true);
    }
  });
});

describe('scheduledAutomations', () => {
  it('schedule を持つものだけ返す', () => {
    const list = [fake({ id: 'a', schedule: '毎週月曜' }), fake({ id: 'b', schedule: null })];
    expect(scheduledAutomations(list).map((a) => a.id)).toEqual(['a']);
  });

  it('実データでも 1 件以上ある（定期実行がゼロなら一覧の意味が薄い）', () => {
    expect(scheduledAutomations().length).toBeGreaterThan(0);
  });
});

describe('tokenSpendingAutomations', () => {
  it('トークン課金のものだけ返す', () => {
    const list = [
      fake({ id: 'a', costKind: 'tokens' }),
      fake({ id: 'b', costKind: 'actions' }),
      fake({ id: 'c', costKind: 'none' }),
    ];
    expect(tokenSpendingAutomations(list).map((a) => a.id)).toEqual(['a']);
  });

  it('トークンを使うものには止め方が書いてある（費用が出るものは必ず止められること）', () => {
    for (const a of tokenSpendingAutomations()) {
      expect(a.killSwitch, `${a.id}`).not.toContain('止めない');
    }
  });
});
