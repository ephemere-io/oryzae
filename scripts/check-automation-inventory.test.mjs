import { describe, expect, it } from 'vitest';
import {
  collectFindings,
  extractDefinedIn,
  extractScheduledDefinedIn,
  extractTriggers,
  isAutomatic,
} from './check-automation-inventory.mjs';

/**
 * 自動実行一覧のゲート自体のテスト。
 *
 * このゲートが静かに壊れると「一覧に載っていない自動実行」が増え続ける。
 * 把握できていないものは止められないので、**検出漏れ**を特に厚く固定する。
 */

const inventoryWith = (...entries) =>
  `export const AUTOMATIONS = [\n${entries
    .map(
      ({ definedIn, schedule }) =>
        `  {\n    id: 'x',\n    schedule: ${schedule === null ? 'null' : `'${schedule}'`},\n    definedIn: '${definedIn}',\n  },`,
    )
    .join('\n')}\n];`;

describe('extractTriggers', () => {
  it('入れ子の on: ブロックからトリガー名を拾う', () => {
    const yaml = ['name: CI', 'on:', '  push:', '    branches: [main]', '  pull_request:', ''].join(
      '\n',
    );
    expect(extractTriggers(yaml)).toEqual(['push', 'pull_request']);
  });

  it('1 行形式の on: [a, b] も読む', () => {
    expect(extractTriggers('on: [push, workflow_dispatch]')).toEqual([
      'push',
      'workflow_dispatch',
    ]);
  });

  it('on: ブロックの外にある同名の語を拾わない', () => {
    const yaml = ['on:', '  schedule:', "    - cron: '0 0 * * 1'", 'jobs:', '  push:', ''].join(
      '\n',
    );
    expect(extractTriggers(yaml)).toEqual(['schedule']);
  });

  it('空入力でも落ちない', () => {
    expect(extractTriggers('')).toEqual([]);
    expect(extractTriggers(null)).toEqual([]);
  });
});

describe('isAutomatic', () => {
  it('人が起動するしかないものは対象外', () => {
    expect(isAutomatic(['workflow_dispatch'])).toBe(false);
  });

  it.each([['schedule'], ['workflow_run'], ['issues'], ['push'], ['pull_request']])(
    '%s は自動起動とみなす',
    (trigger) => {
      expect(isAutomatic([trigger, 'workflow_dispatch'])).toBe(true);
    },
  );
});

describe('inventory.ts の読み取り', () => {
  it('definedIn を全部拾う', () => {
    const src = inventoryWith(
      { definedIn: '.github/workflows/a.yml', schedule: '毎週月曜' },
      { definedIn: '.github/dependabot.yml', schedule: null },
    );
    expect(extractDefinedIn(src)).toEqual(['.github/workflows/a.yml', '.github/dependabot.yml']);
  });

  it('schedule を宣言している項目だけを拾う', () => {
    const src = inventoryWith(
      { definedIn: '.github/workflows/a.yml', schedule: '毎週月曜 05:25' },
      { definedIn: '.github/workflows/b.yml', schedule: null },
    );
    expect(extractScheduledDefinedIn(src)).toEqual(['.github/workflows/a.yml']);
  });
});

describe('検出できること（ここが本題）', () => {
  const base = {
    dependabotExists: false,
    inventorySource: inventoryWith({ definedIn: '.github/workflows/known.yml', schedule: null }),
  };

  it('一覧に無い自動起動ワークフローを検出する', () => {
    const findings = collectFindings({
      ...base,
      workflows: [
        { path: '.github/workflows/known.yml', triggers: ['push'] },
        { path: '.github/workflows/sneaky.yml', triggers: ['schedule'] },
      ],
    });
    expect(findings.map((f) => f.id)).toContain('missing:.github/workflows/sneaky.yml');
  });

  it('schedule を持つのに一覧が schedule: null なら検出する', () => {
    const findings = collectFindings({
      dependabotExists: false,
      inventorySource: inventoryWith({ definedIn: '.github/workflows/a.yml', schedule: null }),
      workflows: [{ path: '.github/workflows/a.yml', triggers: ['schedule'] }],
    });
    expect(findings.map((f) => f.id)).toContain('schedule-not-declared:.github/workflows/a.yml');
  });

  it('dependabot が設定されているのに一覧に無ければ検出する', () => {
    const findings = collectFindings({ ...base, workflows: [], dependabotExists: true });
    expect(findings.map((f) => f.id)).toContain('missing:.github/dependabot.yml');
  });

  it('もう存在しないファイルを指す項目を検出する（一覧の腐敗）', () => {
    const findings = collectFindings({
      dependabotExists: false,
      inventorySource: inventoryWith({ definedIn: '.github/workflows/deleted.yml', schedule: null }),
      workflows: [],
    });
    expect(findings.map((f) => f.id)).toContain('stale:.github/workflows/deleted.yml');
  });

  it('理由を人が読める言葉で返す', () => {
    const findings = collectFindings({
      ...base,
      workflows: [{ path: '.github/workflows/sneaky.yml', triggers: ['issues'] }],
    });
    expect(findings[0].message).toContain('一覧に載っていない');
    expect(findings[0].message).toContain('inventory.ts');
  });
});

describe('通してよいもの', () => {
  it('workflow_dispatch だけのワークフローは一覧に無くてよい', () => {
    const findings = collectFindings({
      dependabotExists: false,
      inventorySource: inventoryWith({ definedIn: '.github/workflows/a.yml', schedule: null }),
      workflows: [
        { path: '.github/workflows/a.yml', triggers: ['push'] },
        { path: '.github/workflows/manual.yml', triggers: ['workflow_dispatch'] },
      ],
    });
    expect(findings).toEqual([]);
  });

  it('実態と一致していれば何も報告しない', () => {
    const findings = collectFindings({
      dependabotExists: true,
      inventorySource: inventoryWith(
        { definedIn: '.github/workflows/a.yml', schedule: '毎週月曜 05:25' },
        { definedIn: '.github/dependabot.yml', schedule: '毎月 1 日' },
      ),
      workflows: [{ path: '.github/workflows/a.yml', triggers: ['schedule', 'push'] }],
    });
    expect(findings).toEqual([]);
  });
});
