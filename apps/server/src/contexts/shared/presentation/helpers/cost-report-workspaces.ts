import {
  type ApiKeyInfo,
  DEFAULT_WORKSPACE_LABEL,
  type KeyTokenUsage,
  type WorkspaceActualCost,
  type WorkspaceInfo,
} from '../../infrastructure/anthropic-cost-api.js';

/**
 * 日次コストレポートの「Workspace ごと」の部分を組み立てる。
 *
 * 材料は 3 つで、どれも Anthropic の Admin API が返した事実:
 *   - cost_report の Workspace 別の実額（金額はここだけ）
 *   - Workspace 一覧（$0 の Workspace も出すため）
 *   - API キー一覧と、キー別のトークン数（1 つの Workspace に複数のキーがいるとき、
 *     どちらがどれだけ使ったか。金額には割らない——cost_report はキー別に割れない）
 *
 * **用途名への読み替えはしない。** Workspace 名・キー名は Console で付けた名前をそのまま出す。
 */

/**
 * Discord は埋め込みの行頭の空白を削るので、最後の枝の子を字下げできない。
 * 点字の空白（U+2800）は空白として扱われないので、見た目の字下げとして残る。
 */
const INDENT = '⠀⠀';

interface KeyRow {
  /** Console で付けたキー名。一覧が取れなかったときはキー ID。 */
  label: string;
  /** この期間のトークン数。使っていなければ null。 */
  usage: KeyTokenUsage | null;
}

export interface WorkspaceRow {
  /** default workspace は null（cost_report と同じ表現）。 */
  id: string | null;
  name: string;
  costUsd: number;
  keys: KeyRow[];
}

function tokens(value: number): string {
  return value.toLocaleString('en-US');
}

/**
 * キー 1 本ぶんのトークン数。入力にはキャッシュの読込・書込も含め、あるときだけ内訳を添える
 * （キャッシュは単価が違うので、混ざっていれば実額と推定のズレの説明になる）。
 */
export function formatTokenUsage(usage: KeyTokenUsage | null): string {
  if (!usage) return '0 tok';
  const cache = usage.cacheReadInputTokens + usage.cacheCreationInputTokens;
  const input = usage.uncachedInputTokens + cache;
  if (input === 0 && usage.outputTokens === 0) return '0 tok';
  const cacheNote =
    cache > 0
      ? `（キャッシュ 読込 ${tokens(usage.cacheReadInputTokens)}・書込 ${tokens(usage.cacheCreationInputTokens)}）`
      : '';
  return `入 ${tokens(input)}${cacheNote} / 出 ${tokens(usage.outputTokens)} tok`;
}

/**
 * 実額・Workspace 一覧・キー一覧・キー別トークン数を 1 本の表にまとめる。
 *
 *   - Workspace 一覧にある Workspace は **$0 でも出す**（使われなかったことも情報）
 *   - 一覧に無いが実額に出てきた Workspace（アーカイブ済み等）も落とさない
 *   - Default Workspace は常に出す。Oryzae のキーは置いていないので、額が出たら Oryzae 外
 *   - キーは active なものと、この期間に使われたものを出す（無効化済みでも使われていれば出す）
 *
 * 並びは金額の多い順・同額は名前順。Default Workspace だけは常に最後に置く。
 */
export function buildWorkspaceRows(input: {
  costByWorkspace: WorkspaceActualCost[];
  workspaces: WorkspaceInfo[] | null;
  apiKeys: ApiKeyInfo[] | null;
  usageByKey: KeyTokenUsage[] | null;
}): WorkspaceRow[] {
  const rows = new Map<string | null, WorkspaceRow>();
  const rowOf = (id: string | null, name: string): WorkspaceRow => {
    const existing = rows.get(id);
    if (existing) return existing;
    const created: WorkspaceRow = { id, name, costUsd: 0, keys: [] };
    rows.set(id, created);
    return created;
  };

  for (const w of input.workspaces ?? []) rowOf(w.id, w.name);
  for (const c of input.costByWorkspace) {
    rowOf(c.workspaceId, c.workspaceName).costUsd += c.costUsd;
  }
  rowOf(null, DEFAULT_WORKSPACE_LABEL);

  const keyById = new Map((input.apiKeys ?? []).map((k) => [k.id, k]));
  // 同じ名前のキーが 2 本あっても取り違えないよう、行はキー ID × Workspace で引く。
  const keyRows = new Map<string, KeyRow>();
  const keyRowId = (apiKeyId: string | null, workspaceId: string | null) =>
    `${apiKeyId ?? '-'}|${workspaceId ?? '-'}`;

  // active なキーは使っていなくても出す（どの Workspace に何のキーがいるか自体が情報）。
  for (const key of input.apiKeys ?? []) {
    if (key.status !== 'active') continue;
    const row = rows.get(key.workspaceId);
    if (!row) continue;
    const keyRow: KeyRow = { label: key.name, usage: null };
    row.keys.push(keyRow);
    keyRows.set(keyRowId(key.id, key.workspaceId), keyRow);
  }

  for (const usage of input.usageByKey ?? []) {
    const existing = keyRows.get(keyRowId(usage.apiKeyId, usage.workspaceId));
    if (existing) {
      existing.usage = usage;
      continue;
    }
    const known = usage.apiKeyId ? keyById.get(usage.apiKeyId) : undefined;
    const label = usage.apiKeyId === null ? 'Console（キーなし）' : (known?.name ?? usage.apiKeyId);
    const row = rowOf(usage.workspaceId, usage.workspaceId ?? DEFAULT_WORKSPACE_LABEL);
    row.keys.push({ label, usage });
  }

  for (const row of rows.values()) row.keys.sort((a, b) => a.label.localeCompare(b.label));

  const ordered = Array.from(rows.values()).filter((r) => r.id !== null);
  ordered.sort((a, b) => b.costUsd - a.costUsd || a.name.localeCompare(b.name));
  const defaultRow = rows.get(null);
  if (defaultRow) ordered.push(defaultRow);
  return ordered;
}

/**
 * 日次の内訳。Workspace の配下にキーをぶら下げる。
 *
 *   ├ oryzae-prod-ocr: $0.0102
 *   │ ├ キー oryzae-prod-ocr-board: 入 2,100 / 出 150 tok
 *   │ └ キー oryzae-prod-ocr-entry: 0 tok
 *   └ Default Workspace: $0.1136
 *   ⠀⠀└ キー waseda-class: 入 31,000 / 出 4,200 tok
 */
export function renderDailyWorkspaceTree(
  rows: WorkspaceRow[],
  formatUsd: (value: number) => string,
): string[] {
  const lines: string[] = [];
  rows.forEach((row, i) => {
    const lastRow = i === rows.length - 1;
    lines.push(`${lastRow ? '└' : '├'} ${row.name}: ${formatUsd(row.costUsd)}`);
    const continuation = lastRow ? INDENT : '│ ';
    row.keys.forEach((key, j) => {
      const lastKey = j === row.keys.length - 1;
      lines.push(
        `${continuation}${lastKey ? '└' : '├'} キー ${key.label}: ${formatTokenUsage(key.usage)}`,
      );
    });
  });
  return lines;
}

/**
 * 今月の Workspace 別。上限を持つ Workspace には「使った額 / 上限（割合）」を出す。
 *
 * 上限は Anthropic の API では読めない（支出上限 API は Enterprise 契約専用）。
 * 渡される値は Console の設定を手で写したもので、ずれていれば古い上限が出る。
 */
export function renderMonthlyWorkspaceLines(
  rows: WorkspaceRow[],
  limitsUsd: Readonly<Record<string, number>>,
  formatUsd: (value: number) => string,
): string[] {
  return rows.map((row, i) => {
    const branch = i === rows.length - 1 ? '└' : '├';
    const limit = limitsUsd[row.name];
    let suffix = '';
    if (row.id === null) {
      // Default Workspace には上限を設定できない（Anthropic の仕様）。
      suffix = '（上限なし）';
    } else if (limit !== undefined && limit > 0) {
      suffix = ` / 上限 ${formatUsd(limit)}（${Math.round((row.costUsd / limit) * 100)}%）`;
    }
    return `${branch} ${row.name}: ${formatUsd(row.costUsd)}${suffix}`;
  });
}
