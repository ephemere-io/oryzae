import { describe, expect, it } from 'vitest';
import type {
  ApiKeyInfo,
  KeyTokenUsage,
  WorkspaceActualCost,
  WorkspaceInfo,
} from '@/contexts/shared/infrastructure/anthropic-cost-api';
import {
  buildWorkspaceRows,
  formatTokenUsage,
  renderDailyWorkspaceTree,
  renderMonthlyWorkspaceLines,
} from '@/contexts/shared/presentation/helpers/cost-report-workspaces';

const usd = (v: number) => (Math.abs(v) >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(4)}`);

const cost = (workspaceId: string | null, workspaceName: string, costUsd: number) =>
  ({ workspaceId, workspaceName, costUsd, byModel: [] }) satisfies WorkspaceActualCost;

const usage = (
  apiKeyId: string | null,
  workspaceId: string | null,
  inputTokens: number,
  outputTokens: number,
): KeyTokenUsage => ({
  apiKeyId,
  workspaceId,
  uncachedInputTokens: inputTokens,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
  outputTokens,
});

// 2026-09-25 分のレポートの実データ（キー別トークン数は例）。
const WORKSPACES: WorkspaceInfo[] = [
  { id: 'ws_ferm', name: 'oryzae-prod-fermentation' },
  { id: 'ws_ocr', name: 'oryzae-prod-ocr' },
  { id: 'ws_dev', name: 'oryzae-dev' },
  { id: 'ws_ci', name: 'oryzae-ci' },
];
const KEYS: ApiKeyInfo[] = [
  { id: 'k_ferm', name: 'oryzae-prod-fermentation', status: 'active', workspaceId: 'ws_ferm' },
  { id: 'k_board', name: 'oryzae-prod-ocr-board', status: 'active', workspaceId: 'ws_ocr' },
  { id: 'k_entry', name: 'oryzae-prod-ocr-entry', status: 'active', workspaceId: 'ws_ocr' },
  { id: 'k_ci', name: 'oryzae-ci', status: 'active', workspaceId: 'ws_ci' },
  { id: 'k_student', name: 'waseda-class', status: 'active', workspaceId: null },
  { id: 'k_old', name: 'oryzae-fermentation', status: 'inactive', workspaceId: null },
];
const COST = [
  cost('ws_ferm', 'oryzae-prod-fermentation', 0.1356),
  cost(null, 'Default Workspace', 0.1136),
  cost('ws_ocr', 'oryzae-prod-ocr', 0.0102),
];

describe('buildWorkspaceRows', () => {
  // 9/26 のレポートへの指摘:「すべてのワークスペースが出ていない」。
  // cost_report は額のある Workspace しか返さないので、一覧で補う。
  it('$0 の Workspace も出す', () => {
    const rows = buildWorkspaceRows({
      costByWorkspace: COST,
      workspaces: WORKSPACES,
      apiKeys: null,
      usageByKey: null,
    });

    expect(rows.map((r) => [r.name, r.costUsd])).toEqual([
      ['oryzae-prod-fermentation', 0.1356],
      ['oryzae-prod-ocr', 0.0102],
      ['oryzae-ci', 0],
      ['oryzae-dev', 0],
      ['Default Workspace', 0.1136],
    ]);
  });

  it('Default Workspace は額が無くても出し、常に最後に置く', () => {
    const rows = buildWorkspaceRows({
      costByWorkspace: [],
      workspaces: WORKSPACES,
      apiKeys: null,
      usageByKey: null,
    });

    expect(rows.at(-1)).toMatchObject({ id: null, name: 'Default Workspace', costUsd: 0 });
  });

  // 同じ Workspace に 2 本のキー（ボード OCR / 写真の文字起こし）。金額では割れないので、
  // どちらがどれだけ使ったかをトークン数で見せる。
  it('Workspace の配下に active なキーを並べ、使った分のトークン数を付ける', () => {
    const rows = buildWorkspaceRows({
      costByWorkspace: COST,
      workspaces: WORKSPACES,
      apiKeys: KEYS,
      usageByKey: [usage('k_board', 'ws_ocr', 2100, 150)],
    });

    const ocr = rows.find((r) => r.name === 'oryzae-prod-ocr');
    expect(ocr?.keys).toEqual([
      { label: 'oryzae-prod-ocr-board', usage: usage('k_board', 'ws_ocr', 2100, 150) },
      { label: 'oryzae-prod-ocr-entry', usage: null },
    ]);
  });

  it('無効化したキーは出さないが、期間中に使われていれば出す', () => {
    const quiet = buildWorkspaceRows({
      costByWorkspace: COST,
      workspaces: WORKSPACES,
      apiKeys: KEYS,
      usageByKey: [],
    });
    expect(quiet.at(-1)?.keys.map((k) => k.label)).toEqual(['waseda-class']);

    const used = buildWorkspaceRows({
      costByWorkspace: COST,
      workspaces: WORKSPACES,
      apiKeys: KEYS,
      usageByKey: [usage('k_old', null, 6367, 313)],
    });
    expect(used.at(-1)?.keys.map((k) => k.label)).toEqual(['oryzae-fermentation', 'waseda-class']);
  });

  it('キー一覧が取れなかった日は、使われたキーを ID のまま出す', () => {
    const rows = buildWorkspaceRows({
      costByWorkspace: COST,
      workspaces: WORKSPACES,
      apiKeys: null,
      usageByKey: [usage('k_board', 'ws_ocr', 10, 1)],
    });

    expect(rows.find((r) => r.name === 'oryzae-prod-ocr')?.keys).toEqual([
      { label: 'k_board', usage: usage('k_board', 'ws_ocr', 10, 1) },
    ]);
  });

  it('キーを使わない利用（Console の playground）もその旨の名前で出す', () => {
    const rows = buildWorkspaceRows({
      costByWorkspace: [],
      workspaces: [],
      apiKeys: [],
      usageByKey: [usage(null, null, 500, 20)],
    });

    expect(rows.at(-1)?.keys.map((k) => k.label)).toEqual(['Console（キーなし）']);
  });
});

describe('formatTokenUsage', () => {
  it('使っていなければ 0 tok', () => {
    expect(formatTokenUsage(null)).toBe('0 tok');
    expect(formatTokenUsage(usage('k', 'w', 0, 0))).toBe('0 tok');
  });

  it('キャッシュがあるときだけ内訳を添え、入力には含める', () => {
    expect(formatTokenUsage(usage('k', 'w', 1000, 50))).toBe('入 1,000 / 出 50 tok');
    expect(
      formatTokenUsage({
        ...usage('k', 'w', 1000, 50),
        cacheReadInputTokens: 300,
        cacheCreationInputTokens: 20,
      }),
    ).toBe('入 1,320（キャッシュ 読込 300・書込 20） / 出 50 tok');
  });
});

describe('renderDailyWorkspaceTree', () => {
  it('Workspace の配下にキーを罫線でぶら下げる（最後の枝の子は点字の空白で字下げ）', () => {
    const rows = buildWorkspaceRows({
      costByWorkspace: COST,
      workspaces: WORKSPACES.slice(0, 2),
      apiKeys: KEYS.filter((k) => k.id !== 'k_ci'),
      usageByKey: [usage('k_board', 'ws_ocr', 2100, 150)],
    });

    expect(renderDailyWorkspaceTree(rows, usd)).toEqual([
      '├ oryzae-prod-fermentation: $0.1356',
      '│ └ キー oryzae-prod-fermentation: 0 tok',
      '├ oryzae-prod-ocr: $0.0102',
      '│ ├ キー oryzae-prod-ocr-board: 入 2,100 / 出 150 tok',
      '│ └ キー oryzae-prod-ocr-entry: 0 tok',
      '└ Default Workspace: $0.1136',
      '⠀⠀└ キー waseda-class: 0 tok',
    ]);
  });
});

describe('renderMonthlyWorkspaceLines', () => {
  it('上限のある Workspace は「額 / 上限（割合）」、Default は上限なしと書く', () => {
    const rows = buildWorkspaceRows({
      costByWorkspace: [
        cost('ws_ferm', 'oryzae-prod-fermentation', 3),
        cost(null, 'Default Workspace', 31.02),
      ],
      workspaces: WORKSPACES.slice(0, 1),
      apiKeys: null,
      usageByKey: null,
    });

    expect(renderMonthlyWorkspaceLines(rows, { 'oryzae-prod-fermentation': 30 }, usd)).toEqual([
      '├ oryzae-prod-fermentation: $3.00 / 上限 $30.00（10%）',
      '└ Default Workspace: $31.02（上限なし）',
    ]);
  });

  it('上限を登録していない Workspace は額だけを出す', () => {
    const rows = buildWorkspaceRows({
      costByWorkspace: [],
      workspaces: [{ id: 'ws_new', name: 'oryzae-new' }],
      apiKeys: null,
      usageByKey: null,
    });

    expect(renderMonthlyWorkspaceLines(rows, {}, usd)[0]).toBe('├ oryzae-new: $0.0000');
  });
});
