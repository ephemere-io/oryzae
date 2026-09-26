import { Hono } from 'hono';
import { type AiUsageResult, fetchAiUsage } from '../../infrastructure/ai-usage-query.js';
import {
  type ActualCostResult,
  ANTHROPIC_COST_CONSOLE_URL,
  fetchActualCost,
  fetchUsageDetail,
  type UsageDetailResult,
  type WorkspaceActualCost,
} from '../../infrastructure/anthropic-cost-api.js';
import {
  FERMENTATION_MODEL_ID,
  FERMENTATION_MODEL_RATE,
} from '../../infrastructure/claude-pricing.js';
import { type ActualCostTrend, summarizeActualCostTrend } from '../../infrastructure/cost-trend.js';
import { COLORS, notifyDiscord } from '../../infrastructure/discord-notify.js';
import {
  aggregateCost,
  type CostAggregate,
  fetchFermentationCostRows,
  resolveUserEmails,
  resolveUserNicknames,
  type UserCostAggregate,
} from '../../infrastructure/fermentation-cost-query.js';
import {
  jstClockLabel,
  jstTimeRange,
  jstTimeRangeOfUtcDay,
  previousUtcDateKey,
  toUtcDateKey,
  utcDayBounds,
  utcDayRangeIso,
  utcMonthBounds,
} from '../../infrastructure/jst-day.js';
import { getSupabaseClient } from '../../infrastructure/supabase-client.js';
import {
  buildWorkspaceRows,
  renderDailyWorkspaceTree,
  renderMonthlyWorkspaceLines,
  type WorkspaceRow,
} from '../helpers/cost-report-workspaces.js';
import { createCronAuthMiddleware } from '../middleware/cron-auth.js';

const DAILY_COST_THRESHOLD_USD = 1.0;
/**
 * ユーザー別に載せる人数の上限。Discord の 1 フィールドは 1024 文字なので、
 * 「名前 (メール): $0.0000（n 件）」1 行 50 文字前後 × 10 で余裕を残す。
 * 5 では足りないという指摘（9/14 のレポート）で 10 にした。
 */
const TOP_USER_COUNT = 10;
/**
 * 推定と実額の乖離を「要確認」と計算根拠の表示に回す閾値。
 *
 * 推定は前提（単一モデル・キャッシュ無し）が崩れると静かにズレる。ズレたときだけ
 * 計算の中身を出せば、平常時のレポートを短く保ったまま切り分けができる。
 */
const DIVERGENCE_NOTICE_RATIO = 0.05;
/**
 * 「この金額は何から発生したか」を確かめに行く先。
 *
 * 管理画面 (Observability → AI Spend) は用途別の実額と発酵の推定を並べて出す。
 * Anthropic Console は原本で、モデル別に加えて API キー別にも割れる。
 * 本番 URL の直書きは send-fermentation-digest.usecase.ts と同じ扱い。
 */
const ADMIN_SPEND_URL = 'https://oryzae-admin.vercel.app/observability/spend';

interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

type ActualCostOk = Extract<ActualCostResult, { kind: 'ok' }>;

/**
 * 金額表記。発酵 1 件は $0.06 規模なので $1 未満は 4 桁で出す。$1 以上は 2 桁——
 * 月末の見込みを `$9.4275` と書いても、下 2 桁は読む人にとって意味を持たない。
 */
function usd(value: number): string {
  // 使われなかった Workspace を全部並べるので、$0 は桁を付けずに書く（$0.0000 が並ぶと読みにくい）。
  if (value === 0) return '$0';
  return Math.abs(value) >= 1 ? `$${value.toFixed(2)}` : `$${value.toFixed(4)}`;
}

function tokens(value: number): string {
  return value.toLocaleString('en-US');
}

/** JSON レスポンス用。マイクロドル単位で丸める。 */
function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** M/D 表記。タイトルに YYYY-MM-DD を置くと幅を食う。 */
function shortDate(dateKey: string): string {
  return `${Number(dateKey.slice(5, 7))}/${Number(dateKey.slice(8, 10))}`;
}

function percent(ratio: number): string {
  const sign = ratio >= 0 ? '+' : '-';
  return `${sign}${Math.abs(ratio * 100).toFixed(0)}%`;
}

/**
 * 発酵の実額が乗る Workspace 名（Anthropic Console で付けた名前そのもの）。
 *
 * 推定（DB のトークン × 単価）と実額を突き合わせるのに、発酵だけの実額が要る。
 * モデル ID では引けない——同じモデルを CI や他の機能が使えば混ざるし、実際
 * 2026-09-23 のレポートは発酵 2 件（$0.12）の行に org 全体の $6.44 を載せていた。
 *
 * Console で Workspace を改名したらここも直すこと。直し忘れても**嘘は出ない**:
 * 一致しなければ null を返し、突き合わせ自体を見送る（下の注記が出る）。
 */
const FERMENTATION_WORKSPACE_NAME = 'oryzae-prod-fermentation';

/**
 * 発酵 Workspace の実額。見つからなければ null。
 *
 * **0 にフォールバックしてはいけない。** 0 と比べると「推定 $0.12 が実額 $0 と
 * ずれている」＝ -100% という嘘の指摘が毎日出る。
 */
function fermentationActualUsd(byWorkspace: WorkspaceActualCost[]): number | null {
  const ws = byWorkspace.find((w) => w.workspaceName === FERMENTATION_WORKSPACE_NAME);
  return ws ? ws.costUsd : null;
}

/**
 * 推定と実額のズレ。比率にならない場合は null（＝突き合わせを見送る）。
 *  - 実額が 0 以下: 割れない
 *  - 実額が null: 発酵 Workspace が見つからなかった（改名・未作成）
 */
function divergenceRatio(estimatedUsd: number, actualUsd: number | null): number | null {
  if (actualUsd === null || actualUsd <= 0) return null;
  return (estimatedUsd - actualUsd) / actualUsd;
}

/**
 * 「合計」の配下であることを罫線で見せる。最後の行だけ └、それ以外は ├。
 * 空白のインデントは Discord が埋め込み内で削るため、字形で階層を出す。
 */
function treeLines(lines: string[]): string[] {
  return lines.map((line, i) => `${i === lines.length - 1 ? '└' : '├'} ${line}`);
}

/**
 * 金額と前日。単日の金額だけでは多いのか少ないのか判断できない。
 * ページング打ち切りは過少集計なので、黙って完全な実額のように見せない。
 */
function formatHeadline(actual: ActualCostOk, trend: ActualCostTrend | null): string {
  const amount = actual.truncated
    ? `${usd(actual.totalCostUsd)} ※集計打ち切り・過少`
    : usd(actual.totalCostUsd);
  if (!trend) return amount;
  if (trend.previousUsd === null) return `${amount}（前日 データなし）`;
  const change = trend.changeRatio === null ? '' : ` ${percent(trend.changeRatio)}`;
  return `${amount}（前日 ${usd(trend.previousUsd)}${change}）`;
}

/**
 * Discord の 1 フィールドは 1024 文字まで。超えると通知ごと失敗するので、
 * 行単位で切って「…以下略」を添える（途中の行を半端に切らない）。
 */
const FIELD_VALUE_LIMIT = 1024;
function clampFieldValue(lines: string[]): string {
  const tail = '…以下略（管理画面・Console で全件）';
  const kept: string[] = [];
  let length = 0;
  for (const line of lines) {
    const next = length + (kept.length > 0 ? 1 : 0) + line.length;
    if (next + 1 + tail.length > FIELD_VALUE_LIMIT) {
      kept.push(tail);
      return kept.join('\n');
    }
    kept.push(line);
    length = next;
  }
  return kept.join('\n');
}

/**
 * 請求額の欄。「合計: 金額」の配下に **すべての Workspace** を並べ、その配下に
 * 各 Workspace のキーとトークン数をぶら下げる。
 *
 *   合計: $0.2594（前日 $6.74 -96%）
 *   ├ oryzae-prod-fermentation: $0.1356
 *   │ └ キー oryzae-prod-fermentation: 入 6,210 / 出 7,796 tok
 *   ├ oryzae-prod-ocr: $0.0102
 *   │ ├ キー oryzae-prod-ocr-board: 入 2,100 / 出 150 tok
 *   │ └ キー oryzae-prod-ocr-entry: 0 tok
 *   ├ oryzae-ci: $0.0000
 *   ├ oryzae-dev: $0.0000
 *   └ Default Workspace: $0.1136
 *   ⠀⠀└ キー waseda-class: 入 31,000 / 出 4,200 tok
 *
 * 9/26 のレポートへの指摘「すべてのワークスペースが出ていない」: cost_report は額のある
 * Workspace しか返さないので、Workspace 一覧で $0 のものも補う。金額は Workspace 単位の
 * 実額だけで、キーの行はトークン数（cost_report はキー別に割れない）。
 * 期間は欄の名前に置く（どの数字がどの窓の話かを、欄ごとに読めるようにする）。
 */
function buildActualField(
  actual: ActualCostResult,
  trend: ActualCostTrend | null,
  detail: UsageDetailResult,
  window: string,
): DiscordField {
  const lines: string[] = [];
  if (actual.kind === 'not-configured') {
    lines.push('取得できません（ANTHROPIC_ADMIN_KEY 未設定）');
  } else if (actual.kind === 'error') {
    lines.push(`取得失敗: ${actual.message.slice(0, 80)}`);
  } else if (actual.groupingUnavailable) {
    // grouping が効いていないと合計は正しいまま内訳だけ消えるので、その旨を出す。
    lines.push(`合計: ${formatHeadline(actual, trend)}`);
    lines.push(
      ...treeLines(['内訳が取れませんでした（group_by が効いていない可能性）。合計は正しい値です']),
    );
  } else {
    lines.push(`合計: ${formatHeadline(actual, trend)}`);
    const rows = buildWorkspaceRows({
      costByWorkspace: actual.byWorkspace,
      workspaces: detail.kind === 'ok' ? detail.workspaces : null,
      apiKeys: detail.kind === 'ok' ? detail.apiKeys : null,
      usageByKey: detail.kind === 'ok' ? detail.usageByKey : null,
    });
    lines.push(...renderDailyWorkspaceTree(rows, usd));
    // 名前が引けなかった日は id が並ぶ。理由を書かないと「知らない Workspace に
    // 課金されている」ように読める。
    if (actual.workspaceNamesUnavailable) {
      lines.push('※ Workspace 名を取得できず、一部は ID 表示（金額は正しい）');
    }
    if (detail.kind === 'ok' && (detail.apiKeys === null || detail.usageByKey === null)) {
      lines.push('※ キー別の内訳を一部取得できなかった（Workspace の金額は正しい）');
    }
  }
  lines.push(
    `確認先: [管理画面](${ADMIN_SPEND_URL})・[Anthropic Console](${ANTHROPIC_COST_CONSOLE_URL})`,
  );
  return {
    name: `請求額（${window}・Workspace 別の実額）`,
    value: clampFieldValue(lines),
    inline: false,
  };
}

/**
 * 今月の累計（Workspace 別）と月末の見込み。
 * 見込みは平均の単純延長であって予測モデルではない。式をそのまま添えて、
 * どう出した数字かをレポート内で読み切れるようにする。
 */
function buildMonthField(
  trend: ActualCostTrend,
  monthlyRows: WorkspaceRow[] | null,
  window: string,
  monthEndLabel: string,
): DiscordField {
  const lines = [`合計: ${usd(trend.monthToDateUsd)}（${trend.elapsedDays} 日分）`];
  if (monthlyRows) {
    lines.push(...renderMonthlyWorkspaceLines(monthlyRows, usd));
  }
  lines.push(
    `月末（${monthEndLabel}）までの見込み: ${usd(trend.projectedMonthEndUsd)}（1 日平均 ${usd(trend.dailyAverageUsd)} × ${trend.daysInMonth} 日）`,
  );
  return { name: `今月の累計（${window}）`, value: clampFieldValue(lines), inline: false };
}

/** ユーザーの表示名。名前もメールも引けなければ ID の先頭 8 桁に縮退する。 */
function userLabel(labels: Map<string, string>, userId: string): string {
  return labels.get(userId) ?? userId.slice(0, 8);
}

/** 上位 N 人を罫線で並べ、溢れた人数を添える。 */
function userTree<T extends { userId: string }>(
  users: T[],
  labels: Map<string, string>,
  describe: (user: T) => string,
): string[] {
  const top = users.slice(0, TOP_USER_COUNT);
  const lines = top.map((u) => `${userLabel(labels, u.userId)}: ${describe(u)}`);
  const rest = users.length - top.length;
  if (rest > 0) lines.push(`…他 ${rest} 名`);
  return treeLines(lines);
}

/**
 * 発酵の中身（何件・何人に・1 件いくら・誰が）。金額だけでは使われ方の変化が読めない。
 * 誰の発酵かは名前（profiles.nickname）とメールで書く（#591 のレポートへの指摘）。
 * Discord は内部運用チャンネルで、載せるのは本人を特定する最低限の情報だけ（日記本文は載せない）。
 *
 * ユーザー別の金額は推定。実額と並んだときに注記の無い推定値は「意味の分からない
 * 2 つ目の金額」にしか見えないので、なぜ推定なのかを 1 行添える。
 */
function buildFermentationField(
  aggregate: CostAggregate,
  labels: Map<string, string>,
  window: string,
): DiscordField {
  const name = `発酵（${window}）`;
  const count = aggregate.fermentationCount;
  if (count === 0) return { name, value: '0 件', inline: false };

  const perRun = usd(aggregate.estimatedCostUsd / count);
  const inPerRun = tokens(Math.round(aggregate.inputTokens / count));
  const outPerRun = tokens(Math.round(aggregate.outputTokens / count));
  const lines = [
    `${count} 件（成功 ${aggregate.completedCount} / 失敗 ${aggregate.failedCount}）・${aggregate.byUser.length} 人`,
    `1 件あたり 推定 ${perRun}（入 ${inPerRun} / 出 ${outPerRun} tok）`,
    ...userTree(
      aggregate.byUser,
      labels,
      (u: UserCostAggregate) => `${u.fermentationCount} 件・推定 ${usd(u.estimatedCostUsd)}`,
    ),
    '※ ユーザー別の金額はトークン×単価の推定（実額はユーザー別に取れない）',
  ];
  return { name, value: clampFieldValue(lines), inline: false };
}

/**
 * ボード OCR / 写真の文字起こしの「誰が何回使ったか」。ai_usage が材料。
 *
 * 金額は出さない（OCR のモデルは価格表に載せていない。実額は Workspace 別に上で出ている）。
 * 記録を読めなかったときは 0 回と書かない（migration 未適用だと表が無い）。
 */
function buildOcrUsageField(
  title: string,
  feature: 'ocr_board' | 'ocr_entry',
  usage: AiUsageResult,
  labels: Map<string, string>,
  window: string,
): DiscordField {
  const name = `${title}（${window}）`;
  if (usage.kind === 'error') {
    return {
      name,
      value: `記録を取得できません: ${usage.message.slice(0, 80)}`,
      inline: false,
    };
  }
  const agg = usage.byFeature[feature];
  if (agg.count === 0) return { name, value: '0 回', inline: false };
  const lines = [
    `${agg.count} 回・${agg.byUser.length} 人・入 ${tokens(agg.inputTokens)} / 出 ${tokens(agg.outputTokens)} tok`,
    ...userTree(
      agg.byUser,
      labels,
      (u) => `${u.count} 回・入 ${tokens(u.inputTokens)} / 出 ${tokens(u.outputTokens)} tok`,
    ),
  ];
  return { name, value: clampFieldValue(lines), inline: false };
}

/**
 * userId → 表示名「nickname (email)」。片方しか無ければある方。両方無ければ載せない
 * （呼び出し側が ID の先頭 8 桁に縮退する）。
 *
 * 発酵・OCR・写真の文字起こしのユーザーをまとめて 1 回で引く。listUsers はページングで
 * 最大 20 往復するので、欄ごとに引き直さない。解決に失敗してもレポートは出す。
 */
async function resolveUserLabels(
  supabase: ReturnType<typeof getSupabaseClient>,
  userIds: string[],
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  const targets = Array.from(new Set(userIds));
  if (targets.length === 0) return labels;
  try {
    const [emails, nicknames] = await Promise.all([
      resolveUserEmails(supabase),
      resolveUserNicknames(supabase, targets),
    ]);
    for (const userId of targets) {
      const nickname = nicknames.get(userId) ?? '';
      const email = emails.get(userId) ?? '';
      const label = nickname && email ? `${nickname} (${email})` : nickname || email;
      if (label) labels.set(userId, label);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[cron-cost-alert] user lookup failed', { error: message });
  }
  return labels;
}

/**
 * 推定コストの計算式をそのまま出す。
 *
 * 平常時は出さない。**実額とズレたとき**と**実額が取れないとき**——
 * つまり計算そのものを疑う場面でだけ出す。
 */
function formatBasis(inputTokens: number, outputTokens: number): string {
  const rate = FERMENTATION_MODEL_RATE;
  const inUsd = (inputTokens * rate.inputUsdPerMTok) / 1_000_000;
  const outUsd = (outputTokens * rate.outputUsdPerMTok) / 1_000_000;
  return [
    `発酵 (${FERMENTATION_MODEL_ID})`,
    `  in  ${tokens(inputTokens)} × $${rate.inputUsdPerMTok.toFixed(2)}/MTok = $${inUsd.toFixed(6)}`,
    `  out ${tokens(outputTokens)} × $${rate.outputUsdPerMTok.toFixed(2)}/MTok = $${outUsd.toFixed(6)}`,
    `  → $${(inUsd + outUsd).toFixed(6)}`,
  ].join('\n');
}

/**
 * 平常時は出さず、確認が要るときだけ出す。毎日「未計上 0 件」を出していると、
 * 本当に 1 件出た日に読み飛ばす。
 */
function buildNotices(params: {
  aggregate: CostAggregate;
  actual: ActualCostResult;
  divergence: number | null;
  rowsTruncated: boolean;
  thresholdExceeded: boolean;
}): string[] {
  const { aggregate, actual, divergence, rowsTruncated, thresholdExceeded } = params;
  const notices: string[] = [];

  if (thresholdExceeded) {
    notices.push(`日次閾値 $${DAILY_COST_THRESHOLD_USD.toFixed(2)} を超えた`);
  }
  if (
    actual.kind === 'ok' &&
    divergence !== null &&
    Math.abs(divergence) >= DIVERGENCE_NOTICE_RATIO
  ) {
    // 比べた 2 つの数字をここに書く。平常時のレポートからは突き合わせの行を消したので、
    // ズレた日に読む人が探さなくて済むようにする。
    const actualUsd = fermentationActualUsd(actual.byWorkspace);
    notices.push(
      `発酵の推定 ${usd(aggregate.estimatedCostUsd)} が ${FERMENTATION_WORKSPACE_NAME} の実額 ${usd(actualUsd ?? 0)} と ${percent(divergence)} ずれている — モデル変更・プロンプトキャッシュ・単価改定を確認`,
    );
  }
  // 突き合わせができなかった理由を出す。黙って出さないと「今日はズレなかった」と
  // 読めてしまう（実際には比べていない）。発酵が 0 件の日は比べるものが無いので黙る。
  if (
    actual.kind === 'ok' &&
    aggregate.fermentationCount > 0 &&
    fermentationActualUsd(actual.byWorkspace) === null
  ) {
    notices.push(
      `Workspace「${FERMENTATION_WORKSPACE_NAME}」が実額に無く、推定との突き合わせができていない — Console での改名・キーの設定先を確認`,
    );
  }
  if (actual.kind === 'ok' && actual.workspaceNamesUnavailable) {
    notices.push('Workspace 名を取得できなかった — 内訳の一部が ID 表示（金額は正しい）');
  }
  if (aggregate.untrackedCount > 0) {
    notices.push(`トークン未記録 ${aggregate.untrackedCount} 件 — その分は推定に乗っていない`);
  }
  if (rowsTruncated) {
    notices.push('発酵の件数が上限を超えた — 件数・トークン・内訳は過少');
  }
  if (actual.kind === 'ok' && actual.truncated) {
    notices.push('実額のページングを打ち切った — 請求額は過少');
  }
  return notices;
}

/**
 * 月初からの日別バケットを取って前日比・累計・見込みを作る。
 *
 * 対象日の実額が取れていないとき（未設定・失敗）は、月の傾向だけ出しても読めないので
 * 取りに行かない。取得に失敗しても対象日のレポートは出したいので、失敗は null に
 * 落として縮退する。対象が 1 日のときは前日が先月になるため、前日ぶんだけ範囲を広げる。
 */
async function fetchTrend(
  actual: ActualCostResult,
  dateKey: string,
): Promise<{ trend: ActualCostTrend; monthlyByWorkspace: WorkspaceActualCost[] } | null> {
  if (actual.kind !== 'ok') return null;

  const { start: monthStart } = utcMonthBounds(dateKey);
  const { start: previousDayStart } = utcDayBounds(previousUtcDateKey(dateKey));
  const { end: targetDayEnd } = utcDayBounds(dateKey);
  const rangeStart = previousDayStart < monthStart ? previousDayStart : monthStart;

  const monthly = await fetchActualCost(rangeStart, targetDayEnd);
  if (monthly.kind !== 'ok') return null;
  return {
    trend: summarizeActualCostTrend(monthly.daily, dateKey),
    // 月の 1 日は前日比のために前月の 1 日ぶんまで取っている。その日の Workspace 別は
    // 月ぶんではなくなるので、対象日の内訳（= 今月ぶんのすべて）を使う。
    monthlyByWorkspace: rangeStart < monthStart ? actual.byWorkspace : monthly.byWorkspace,
  };
}

export const cronCostAlert = new Hono()
  .use(
    '*',
    createCronAuthMiddleware({
      routeName: 'cron-cost-alert',
      discordTitlePrefix: 'コスト cron',
    }),
  )
  .post('/', async (c) => {
    try {
      const supabase = getSupabaseClient();

      // 対象は実行時刻の直前に閉じた UTC 日。JST 10:00 (= UTC 01:00) 実行なので
      // 「JST 前日 9:00 〜 当日 9:00」を、閉じてから 1 時間後に読む
      // （cost_report の反映ラグは通常 5 分程度）。
      //
      // 実額（UTC 日固定）と発酵の件数を **同じ窓** で切るのが肝。旧版は件数だけ JST 日で
      // 切っていたため、冒頭で毎回 JST と UTC の対応を説明することになり、読む人には
      // 何時から何時の話か分からなかった。定期発酵（JST 03:00）はこの窓の中に入る。
      const dateKey = previousUtcDateKey(toUtcDateKey(new Date()));
      const { startIso, endIso } = utcDayRangeIso(dateKey);

      // 発酵の件数は fermentation_results、トークン数は ai_usage から読む。
      let rows: Awaited<ReturnType<typeof fetchFermentationCostRows>>;
      try {
        rows = await fetchFermentationCostRows(supabase, { startIso, endIso });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[cron-cost-alert] Supabase query failed', { error: message });
        await notifyDiscord({
          title: 'コスト cron: Supabase クエリ失敗',
          description: message,
          color: COLORS.ERROR,
        });
        return c.json({ error: message }, 500);
      }

      const aggregate = aggregateCost(rows.rows);

      // 請求額は Anthropic の cost_report が正（推定と混同させない）。
      const { start, end } = utcDayBounds(dateKey);
      const actual = await fetchActualCost(start, end);

      // 前日比・今月の累計・月末の見込み。対象日の内訳と混ざらないよう、月ぶんは別呼び出し。
      // キー別のトークン数・Workspace 一覧・OCR の利用記録も、どれも独立なので並行に取る。
      const [trendResult, detail, aiUsage] = await Promise.all([
        fetchTrend(actual, dateKey),
        actual.kind === 'ok'
          ? fetchUsageDetail(start, end)
          : Promise.resolve<UsageDetailResult>({ kind: 'not-configured' }),
        fetchAiUsage(supabase, { startIso, endIso }),
      ]);
      const trend = trendResult?.trend ?? null;

      // 閾値判定は実額があれば実額で、なければ推定で行う。
      const thresholdBasisUsd =
        actual.kind === 'ok' ? actual.totalCostUsd : aggregate.estimatedCostUsd;
      const thresholdExceeded = thresholdBasisUsd >= DAILY_COST_THRESHOLD_USD;

      const divergence =
        actual.kind === 'ok'
          ? divergenceRatio(aggregate.estimatedCostUsd, fermentationActualUsd(actual.byWorkspace))
          : null;

      // 欄ごとに期間を名前に置く（「どの数字がいつからいつの話か」を欄単位で読めるように）。
      const dayWindow = jstTimeRangeOfUtcDay(dateKey);
      const { start: monthStart, end: monthEnd } = utcMonthBounds(dateKey);

      // 誰が使ったか: 発酵・ボード OCR・写真の文字起こしのユーザーを 1 回でまとめて引く。
      const usageUserIds =
        aiUsage.kind === 'ok'
          ? [...aiUsage.byFeature.ocr_board.byUser, ...aiUsage.byFeature.ocr_entry.byUser].map(
              (u) => u.userId,
            )
          : [];
      const labels = await resolveUserLabels(supabase, [
        ...aggregate.byUser.map((u) => u.userId),
        ...usageUserIds,
      ]);

      // すべて縦に並べる（inline を使わない）。3 カラムは幅次第で崩れて読めない。
      const fields: DiscordField[] = [buildActualField(actual, trend, detail, dayWindow)];
      if (trendResult) {
        const monthlyRows = buildWorkspaceRows({
          costByWorkspace: trendResult.monthlyByWorkspace,
          workspaces: detail.kind === 'ok' ? detail.workspaces : null,
          apiKeys: null,
          usageByKey: null,
        });
        fields.push(
          buildMonthField(
            trendResult.trend,
            monthlyRows,
            jstTimeRange(monthStart, end),
            jstClockLabel(monthEnd),
          ),
        );
      }
      if (actual.kind !== 'ok') {
        // 実額が取れない日だけ、推定が実額の代用として前に出る。
        fields.push({
          name: '推定コスト（発酵のみ・実額の代用）',
          value: `${usd(aggregate.estimatedCostUsd)}（トークン×単価）`,
          inline: false,
        });
      }

      fields.push(buildFermentationField(aggregate, labels, dayWindow));
      fields.push(buildOcrUsageField('ボード OCR', 'ocr_board', aiUsage, labels, dayWindow));
      fields.push(buildOcrUsageField('写真の文字起こし', 'ocr_entry', aiUsage, labels, dayWindow));

      // 計算そのものを疑う場面でだけ式を出す。
      const basisNeeded =
        actual.kind !== 'ok' ||
        (divergence !== null && Math.abs(divergence) >= DIVERGENCE_NOTICE_RATIO);
      if (basisNeeded && aggregate.fermentationCount > 0) {
        fields.push({
          name: '推定の計算根拠',
          value: formatBasis(aggregate.inputTokens, aggregate.outputTokens),
          inline: false,
        });
      }

      const notices = buildNotices({
        aggregate,
        actual,
        divergence,
        rowsTruncated: rows.truncated,
        thresholdExceeded,
      });
      if (notices.length > 0) {
        fields.push({
          name: '要確認',
          value: notices.map((n) => `・${n}`).join('\n'),
          inline: false,
        });
      }

      const period = jstTimeRangeOfUtcDay(dateKey);
      const dayLabel = `${shortDate(dateKey)} 分`;
      await notifyDiscord({
        title: thresholdExceeded
          ? `AI コスト警告 — ${dayLabel}が閾値超過`
          : `AI コスト日次レポート — ${dayLabel}`,
        // 冒頭は「何時から何時の話か」だけを言う。UTC と JST の対応は読む人の仕事ではない。
        description: `${period} に発生したコストのレポートです。`,
        color: thresholdExceeded ? COLORS.ERROR : COLORS.INFO,
        fields,
      });

      return c.json({
        message: 'Cost alert check completed',
        /** 対象の UTC 日。JST では period のとおり「その日 9:00 〜 翌日 9:00」。 */
        date: dateKey,
        period,
        actualCost:
          actual.kind === 'ok'
            ? {
                status: 'ok',
                costUsd: round6(actual.totalCostUsd),
                truncated: actual.truncated,
                /** 用途別の実額。読むならこちら。 */
                byWorkspace: actual.byWorkspace.map((w) => ({
                  workspaceId: w.workspaceId,
                  workspaceName: w.workspaceName,
                  costUsd: round6(w.costUsd),
                })),
                /** モデル別。用途とは一致しない（同じモデルを複数の用途が使う）。 */
                byModel: actual.byModel.map((m) => ({
                  model: m.model,
                  costUsd: round6(m.costUsd),
                })),
                workspaceNamesUnavailable: actual.workspaceNamesUnavailable,
              }
            : { status: actual.kind },
        previousDayCost: trend?.previousUsd == null ? null : round6(trend.previousUsd),
        monthToDateCost: trend ? round6(trend.monthToDateUsd) : null,
        projectedMonthEndCost: trend ? round6(trend.projectedMonthEndUsd) : null,
        /** 発酵のみの推定。用途別の実額は actualCost.byWorkspace を見る。 */
        estimatedCost: round6(aggregate.estimatedCostUsd),
        fermentationCount: aggregate.fermentationCount,
        completedCount: aggregate.completedCount,
        failedCount: aggregate.failedCount,
        untrackedCount: aggregate.untrackedCount,
        inputTokens: aggregate.inputTokens,
        outputTokens: aggregate.outputTokens,
        userCount: aggregate.byUser.length,
        truncated: rows.truncated,
        /** ボード OCR / 写真の文字起こしの回数とユーザー数（ai_usage）。 */
        ocrUsage:
          aiUsage.kind === 'ok'
            ? Object.fromEntries(
                (['ocr_board', 'ocr_entry'] as const).map((f) => [
                  f,
                  {
                    count: aiUsage.byFeature[f].count,
                    userCount: aiUsage.byFeature[f].byUser.length,
                  },
                ]),
              )
            : { status: 'error', message: aiUsage.message },
        thresholdExceeded,
        notices,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[cron-cost-alert] execution failed', { error: message });
      await notifyDiscord({
        title: 'コスト cron: 実行中にエラー',
        description: message,
        color: COLORS.ERROR,
      });
      return c.json({ error: 'Internal Server Error', message }, 500);
    }
  });
