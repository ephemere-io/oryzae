import { Hono } from 'hono';
import {
  type ActualCostResult,
  ANTHROPIC_COST_CONSOLE_URL,
  fetchActualCost,
  type ModelActualCost,
} from '../../infrastructure/anthropic-cost-api.js';
import {
  FERMENTATION_MODEL_ID,
  FERMENTATION_MODEL_RATE,
  featureOfModel,
} from '../../infrastructure/claude-pricing.js';
import { type ActualCostTrend, summarizeActualCostTrend } from '../../infrastructure/cost-trend.js';
import { COLORS, notifyDiscord } from '../../infrastructure/discord-notify.js';
import {
  aggregateCost,
  type CostAggregate,
  fetchFermentationCostRows,
  type UserCostAggregate,
} from '../../infrastructure/fermentation-cost-query.js';
import {
  jstDayRangeUtc,
  previousJstDateKey,
  previousUtcDateKey,
  utcDateKeyOfJstFermentationRun,
  utcDayBounds,
  utcMonthBounds,
} from '../../infrastructure/jst-day.js';
import { getSupabaseClient } from '../../infrastructure/supabase-client.js';
import { createCronAuthMiddleware } from '../middleware/cron-auth.js';

const DAILY_COST_THRESHOLD_USD = 1.0;
/** Discord の1フィールドに詰め込みすぎないための上限。 */
const TOP_USER_COUNT = 5;
/**
 * 推定と実額の乖離を「要確認」と計算根拠の表示に回す閾値。
 *
 * 推定は前提（単一モデル・キャッシュ無し）が崩れると静かにズレる。ズレたときだけ
 * 計算の中身を出せば、平常時のレポートを短く保ったまま切り分けができる。
 */
const DIVERGENCE_NOTICE_RATIO = 0.05;

interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

/**
 * 金額表記。発酵 1 件は $0.06 規模なので $1 未満は 4 桁で出す。$1 以上は 2 桁——
 * 月末の見込みを `$9.4275` と書いても、下 2 桁は読む人にとって意味を持たない。
 */
function usd(value: number): string {
  return Math.abs(value) >= 1 ? `$${value.toFixed(2)}` : `$${value.toFixed(4)}`;
}

function tokens(value: number): string {
  return value.toLocaleString('en-US');
}

/** JSON レスポンス用。マイクロドル単位で丸める。 */
function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** M/D 表記。フィールド名に YYYY-MM-DD を並べると幅を食って折り返す。 */
function shortDate(dateKey: string): string {
  return `${Number(dateKey.slice(5, 7))}/${Number(dateKey.slice(8, 10))}`;
}

function percent(ratio: number): string {
  const sign = ratio >= 0 ? '+' : '-';
  return `${sign}${Math.abs(ratio * 100).toFixed(0)}%`;
}

/**
 * モデル ID → Oryzae での用途。
 *
 * Anthropic は「用途」を知らない。モデルが分かれているから用途別に読めるだけで、
 * 同じモデルを CI 等が使えば同じバケットに混ざる。だから「そのモデルを使っている
 * 機能」を添えるだけで、「その機能のコスト」とは言い切らない。
 */

function fermentationActualUsd(byModel: ModelActualCost[]): number {
  return byModel.find((m) => m.model === FERMENTATION_MODEL_ID)?.costUsd ?? 0;
}

/** 推定と実額のズレ。実額が 0 のときは比率にならないので null。 */
function divergenceRatio(estimatedUsd: number, actualUsd: number): number | null {
  if (actualUsd <= 0) return null;
  return (estimatedUsd - actualUsd) / actualUsd;
}

/**
 * ユーザー別内訳。Discord は内部運用チャンネルだが、既存の発酵 cron 通知が
 * userId.slice(0, 8) 表記なのに合わせ、メールアドレスは送らない。
 * メール付きの内訳は admin の /costs 画面で見られる。
 *
 * 末尾の注記は「なぜここだけ推定なのか」の説明。実額と並んだときに、注記の無い
 * 推定値は「意味の分からない2つ目の金額」にしか見えない。
 */
function formatUserBreakdown(byUser: UserCostAggregate[]): string {
  if (byUser.length === 0) return 'この日の発酵は 0 件';
  const top = byUser.slice(0, TOP_USER_COUNT);
  const lines = top.map(
    (u) => `${u.userId.slice(0, 8)}  ${usd(u.estimatedCostUsd)}  ${u.fermentationCount} 件`,
  );
  const rest = byUser.length - top.length;
  if (rest > 0) lines.push(`…他 ${rest} 名`);
  lines.push('※ 実額はユーザー別に取れないため、ここだけトークン×単価の推定');
  return lines.join('\n');
}

/**
 * 実請求額。前日と並べて出す——単日の金額だけでは多いのか少ないのか判断できない。
 * 取得できないときに $0 を出さない方針は変えていない。
 */
function formatActualHeadline(result: ActualCostResult, trend: ActualCostTrend | null): string {
  if (result.kind === 'not-configured') return '未設定 (ANTHROPIC_ADMIN_KEY)';
  if (result.kind === 'error') return `取得失敗: ${result.message.slice(0, 80)}`;

  // ページング打ち切りは過少集計。黙って完全な実額のように見せない。
  const amount = result.truncated
    ? `${usd(result.totalCostUsd)} ※集計打ち切り・過少`
    : usd(result.totalCostUsd);
  if (!trend) return amount;

  const previous =
    trend.previousUsd === null
      ? '前日 データなし'
      : `前日 ${usd(trend.previousUsd)}${trend.changeRatio === null ? '' : ` (${percent(trend.changeRatio)})`}`;
  return `${amount}\n${previous}`;
}

/**
 * 今月の累計と月末の見込み。日次レポートに全体感が無かった理由がここで、
 * 「$0.1220」とだけ言われても、それが多いのか少ないのかは判断できない。
 *
 * 見込みは平均の単純延長であって予測モデルではない。式をそのまま添えて、
 * どう出した数字かをレポート内で読み切れるようにする。
 */
function buildTrendFields(trend: ActualCostTrend, utcDateKey: string): DiscordField[] {
  const monthStartKey = utcMonthBounds(utcDateKey).start.toISOString().slice(0, 10);
  return [
    {
      name: `今月の累計 (UTC ${shortDate(monthStartKey)}〜${shortDate(utcDateKey)})`,
      value: `${usd(trend.monthToDateUsd)}\n${trend.elapsedDays}/${trend.daysInMonth} 日経過`,
      inline: true,
    },
    {
      name: '月末の見込み',
      value: `${usd(trend.projectedMonthEndUsd)}\n平均 ${usd(trend.dailyAverageUsd)}/日 × ${trend.daysInMonth} 日`,
      inline: true,
    },
  ];
}

/**
 * 実額のモデル別内訳と、発酵ぶんの推定との突き合わせ。
 *
 * 旧版は「実請求額 (org 全体)」「推定コスト (発酵のみ)」「差額」を別々のフィールドに
 * 並べていた。スコープの違う2つを引き算した数字は、毎回1文の言い訳を添えないと
 * 読めない。同じスコープ同士（発酵モデルの実額 ↔ 発酵の推定）を並べれば言い訳が
 * 要らず、フィールドも1つで済む。
 */
function formatModelBreakdown(
  byModel: ModelActualCost[],
  groupingUnavailable: boolean,
  estimatedUsd: number,
): string {
  const lines: string[] = [];

  // grouping が効いていないと総額は正しいまま内訳だけ消えるので、その旨を出す。
  if (groupingUnavailable) {
    lines.push(
      'Anthropic が内訳を返しませんでした（group_by が効いていない可能性）。総額は正しい値です',
    );
  } else if (byModel.length === 0) {
    lines.push('この日の課金なし');
  } else {
    for (const m of byModel) {
      const feature = featureOfModel(m.model);
      lines.push(`${m.model}  ${usd(m.costUsd)}${feature ? `  ← ${feature}のモデル` : ''}`);
    }
  }

  const actual = fermentationActualUsd(byModel);
  if (actual > 0 || estimatedUsd > 0) {
    const ratio = divergenceRatio(estimatedUsd, actual);
    lines.push(
      `発酵の推定 ${usd(estimatedUsd)} ↔ 同モデルの実額 ${usd(actual)}${ratio === null ? '' : ` (差 ${percent(ratio)})`}`,
    );
  }
  lines.push('※ 実額は org 全体。同じモデルを CI・手元の検証が使えば同じ行に混ざる');
  lines.push(`[Anthropic Console で照合](${ANTHROPIC_COST_CONSOLE_URL})`);
  return lines.join('\n');
}

/**
 * 推定コストの計算式をそのまま出す。
 *
 * 平常時は出さない。トークン数と単価はトークン欄に載っているので、合っている限り
 * これは4行の再掲でしかない。**実額とズレたとき**と**実額が取れないとき**——
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
 * 発酵の中身（何件・何人に・1件いくら）。金額だけでは使われ方の変化が読めない。
 *
 * 0 件の日は「0 人」「1 件あたり -」を並べても読むものが無いので 1 枚に畳む。
 */
function buildUsageFields(aggregate: CostAggregate): DiscordField[] {
  const count = aggregate.fermentationCount;
  if (count === 0) return [{ name: '発酵', value: '0 件', inline: true }];

  return [
    {
      name: '発酵',
      value: `${count} 件\n成功 ${aggregate.completedCount} / 失敗 ${aggregate.failedCount}`,
      inline: true,
    },
    { name: '利用者', value: `${aggregate.byUser.length} 人`, inline: true },
    {
      name: '1 発酵あたり (推定)',
      value: `${usd(aggregate.estimatedCostUsd / count)}\n入 ${tokens(Math.round(aggregate.inputTokens / count))} / 出 ${tokens(Math.round(aggregate.outputTokens / count))} tok`,
      inline: true,
    },
  ];
}

/**
 * トークンが「誰の何か」を書く。`in 5,336 / out 7,069` だけでは読めない。
 * 単価も併記して、この欄だけで推定コストを検算できるようにする。
 */
function buildTokenField(aggregate: CostAggregate): DiscordField {
  const rate = FERMENTATION_MODEL_RATE;
  return {
    name: 'トークン (発酵・JST の日合計)',
    value: [
      `入力 ${tokens(aggregate.inputTokens)} — 日記本文＋指示文`,
      `出力 ${tokens(aggregate.outputTokens)} — ワークシート・切片・レター・キーワード`,
      `単価 in $${rate.inputUsdPerMTok.toFixed(2)} / out $${rate.outputUsdPerMTok.toFixed(2)} per MTok`,
    ].join('\n'),
    inline: false,
  };
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
  if (divergence !== null && Math.abs(divergence) >= DIVERGENCE_NOTICE_RATIO) {
    notices.push(
      `発酵の推定が実額と ${percent(divergence)} ずれている — モデル変更・プロンプトキャッシュ・単価改定を確認`,
    );
  }
  if (aggregate.untrackedCount > 0) {
    notices.push(`トークン未記録 ${aggregate.untrackedCount} 件 — その分は推定に乗っていない`);
  }
  if (rowsTruncated) {
    notices.push('発酵の件数が上限を超えた — 件数・トークン・内訳は過少');
  }
  if (actual.kind === 'ok' && actual.truncated) {
    notices.push('実額のページングを打ち切った — 実請求額は過少');
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
  actualUtcDateKey: string,
): Promise<ActualCostTrend | null> {
  if (actual.kind !== 'ok') return null;

  const { start: monthStart } = utcMonthBounds(actualUtcDateKey);
  const { start: previousDayStart } = utcDayBounds(previousUtcDateKey(actualUtcDateKey));
  const { end: targetDayEnd } = utcDayBounds(actualUtcDateKey);
  const rangeStart = previousDayStart < monthStart ? previousDayStart : monthStart;

  const monthly = await fetchActualCost(rangeStart, targetDayEnd);
  if (monthly.kind !== 'ok') return null;
  return summarizeActualCostTrend(monthly.daily, actualUtcDateKey);
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

      // 対象は JST 前日。発酵 cron が JST 03:00 に走るので、JST 日で切らないと
      // 「8/9 のレポート」に JST 8/10 未明の発酵が混ざる（旧実装は UTC 日だった）。
      const dateKey = previousJstDateKey(new Date());
      const { startIso, endIso } = jstDayRangeUtc(dateKey);

      // issue #352 以降 generation_id は NULL 固定。旧実装はこれを NOT NULL で
      // 絞っていたため対象が常に0件になり、レポートが毎日 $0.0000 になっていた。
      // 保存済みトークンから推定コストを出す方式に切替える。
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

      // 実請求額は Anthropic の cost_report が正（推定と混同させない）。
      // cost_report は UTC 日バケット固定なので、その JST 日の定期発酵が実際に
      // 走った UTC 日 (= JST日 - 1) を対応付けて取得する。
      const actualUtcDateKey = utcDateKeyOfJstFermentationRun(dateKey);
      const { start, end } = utcDayBounds(actualUtcDateKey);
      const actual = await fetchActualCost(start, end);

      // 前日比・今月の累計・月末の見込み。モデル別内訳（対象日ぶん）と混ざらないよう、
      // 月ぶんの日別バケットは別呼び出しで取る。
      const trend = await fetchTrend(actual, actualUtcDateKey);

      // 閾値判定は実額があれば実額で、なければ推定で行う。
      const thresholdBasisUsd =
        actual.kind === 'ok' ? actual.totalCostUsd : aggregate.estimatedCostUsd;
      const thresholdExceeded = thresholdBasisUsd >= DAILY_COST_THRESHOLD_USD;

      const divergence =
        actual.kind === 'ok'
          ? divergenceRatio(aggregate.estimatedCostUsd, fermentationActualUsd(actual.byModel))
          : null;

      const fields: DiscordField[] = [
        {
          // 実請求は org 全体の額。Oryzae のアプリ以外（CI のセキュリティレビュー・
          // 手元の検証など）も含むので、発酵の推定と一致しないのが正常。
          name: `実請求額 (org 全体・UTC ${shortDate(actualUtcDateKey)})`,
          value: formatActualHeadline(actual, trend),
          inline: true,
        },
      ];

      if (trend) fields.push(...buildTrendFields(trend, actualUtcDateKey));

      if (actual.kind === 'ok') {
        // 用途別の実額。「OCR がいくらか」はここで読む（推定ではなく実額）。
        fields.push({
          name: '実額の内訳（モデル別）',
          value: formatModelBreakdown(
            actual.byModel,
            actual.groupingUnavailable,
            aggregate.estimatedCostUsd,
          ),
          inline: false,
        });
      } else {
        // 実額が取れない日だけ、推定が実額の代用として前に出る。
        fields.push({
          name: '推定コスト (発酵・記録分)',
          value: `${usd(aggregate.estimatedCostUsd)}\nトークン×単価。実額の代用`,
          inline: true,
        });
      }

      fields.push(...buildUsageFields(aggregate));
      // 0 件の日はトークンもユーザー別も 0 の再掲にしかならない（発酵 0 件で伝わる）。
      if (aggregate.fermentationCount > 0) {
        fields.push(buildTokenField(aggregate));
        fields.push({
          name: `ユーザー別 推定コスト (上位${TOP_USER_COUNT})`,
          value: formatUserBreakdown(aggregate.byUser),
          inline: false,
        });
      }

      // 計算そのものを疑う場面でだけ式を出す（平常時はトークン欄の再掲になる）。
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

      await notifyDiscord({
        title: thresholdExceeded
          ? `AI コスト警告 — ${dateKey} (JST) が閾値超過`
          : `AI コスト日次レポート — ${dateKey} (JST)`,
        // 毎回同じ一文だが、JST と UTC が混ざる理由はここでしか説明できない。
        description: `JST ${shortDate(dateKey)} の定期発酵は UTC ${shortDate(actualUtcDateKey)} に走る。実額はその UTC 日、発酵の件数とトークンは JST 日で集計。`,
        color: thresholdExceeded ? COLORS.ERROR : COLORS.INFO,
        fields,
      });

      return c.json({
        message: 'Cost alert check completed',
        date: dateKey,
        actualCost:
          actual.kind === 'ok'
            ? {
                status: 'ok',
                costUsd: round6(actual.totalCostUsd),
                truncated: actual.truncated,
                byModel: actual.byModel.map((m) => ({
                  model: m.model,
                  costUsd: round6(m.costUsd),
                  feature: featureOfModel(m.model),
                })),
              }
            : { status: actual.kind },
        actualCostUtcDate: actualUtcDateKey,
        previousDayCost: trend?.previousUsd == null ? null : round6(trend.previousUsd),
        monthToDateCost: trend ? round6(trend.monthToDateUsd) : null,
        projectedMonthEndCost: trend ? round6(trend.projectedMonthEndUsd) : null,
        /** 発酵のみの推定。用途別の実額は actualCost.byModel を見る。 */
        estimatedCost: round6(aggregate.estimatedCostUsd),
        fermentationCount: aggregate.fermentationCount,
        completedCount: aggregate.completedCount,
        failedCount: aggregate.failedCount,
        untrackedCount: aggregate.untrackedCount,
        inputTokens: aggregate.inputTokens,
        outputTokens: aggregate.outputTokens,
        userCount: aggregate.byUser.length,
        truncated: rows.truncated,
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
