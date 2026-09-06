import { Hono } from 'hono';
import {
  type ActualCostResult,
  fetchActualCost,
  type ModelActualCost,
} from '../../infrastructure/anthropic-cost-api.js';
import {
  FERMENTATION_MODEL_ID,
  FERMENTATION_MODEL_RATE,
  OCR_MODEL_ID,
} from '../../infrastructure/claude-pricing.js';
import { COLORS, notifyDiscord } from '../../infrastructure/discord-notify.js';
import {
  aggregateCost,
  fetchFermentationCostRows,
  type UserCostAggregate,
} from '../../infrastructure/fermentation-cost-query.js';
import {
  jstDayRangeUtc,
  previousJstDateKey,
  utcDateKeyOfJstFermentationRun,
  utcDayBounds,
} from '../../infrastructure/jst-day.js';
import { getSupabaseClient } from '../../infrastructure/supabase-client.js';
import { createCronAuthMiddleware } from '../middleware/cron-auth.js';

const DAILY_COST_THRESHOLD_USD = 1.0;
/** Discord の1フィールドに詰め込みすぎないための上限。 */
const TOP_USER_COUNT = 5;

function usd(value: number): string {
  return `$${value.toFixed(4)}`;
}

function tokens(value: number): string {
  return value.toLocaleString('en-US');
}

/** JSON レスポンス用。マイクロドル単位で丸める。 */
function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * モデル ID → Oryzae での用途。
 *
 * Anthropic は「用途」を知らない。モデルが分かれているから用途別に読めるだけで、
 * 同じモデルを CI 等が使えば同じバケットに混ざる。だから「そのモデルを使っている
 * 機能」を添えるだけで、「その機能のコスト」とは言い切らない。
 */
function featureOfModel(model: string): string | null {
  if (model === FERMENTATION_MODEL_ID) return '発酵';
  if (model === OCR_MODEL_ID) return 'OCR';
  return null;
}

/**
 * ユーザー別内訳。Discord は内部運用チャンネルだが、既存の発酵 cron 通知が
 * userId.slice(0, 8) 表記なのに合わせ、メールアドレスは送らない。
 * メール付きの内訳は admin の /costs 画面で見られる。
 */
function formatUserBreakdown(byUser: UserCostAggregate[]): string {
  if (byUser.length === 0) return '-';
  const top = byUser.slice(0, TOP_USER_COUNT);
  const lines = top.map(
    (u) => `${u.userId.slice(0, 8)}  ${usd(u.estimatedCostUsd)}  (${u.fermentationCount}件)`,
  );
  const rest = byUser.length - top.length;
  if (rest > 0) lines.push(`…他 ${rest} 名`);
  return lines.join('\n');
}

function formatActualField(result: ActualCostResult, utcDateKey: string): string {
  if (result.kind === 'ok') {
    const amount = `${usd(result.totalCostUsd)} (UTC ${utcDateKey})`;
    // ページング打ち切りは過少集計。黙って完全な実額のように見せない。
    return result.truncated ? `${amount} ※集計打ち切り・過少` : amount;
  }
  if (result.kind === 'not-configured') return '未設定 (ANTHROPIC_ADMIN_KEY)';
  return `取得失敗: ${result.message.slice(0, 80)}`;
}

/**
 * 実額のモデル別内訳。「OCR がいくらか」はここで読む。
 *
 * 自前トークンの推定ではなく cost_report の実額なので、キャッシュ・値引き・
 * 課金丸めも反映済み。用途名は「そのモデルを使っている機能」を指すだけで、
 * 同じモデルの他の利用（CI 等）も同じ行に混ざっている。
 */
function formatModelBreakdown(byModel: ModelActualCost[]): string {
  if (byModel.length === 0) return '-';
  return byModel
    .map((m) => {
      const feature = featureOfModel(m.model);
      return `${m.model}  ${usd(m.costUsd)}${feature ? `  ← ${feature} のモデル` : ''}`;
    })
    .join('\n');
}

/**
 * 推定コストの計算式をそのまま出す。
 *
 * 金額だけ出していると「どう出した数字か」が分からず、実請求額とズレたときに
 * 計算が壊れているのか対象範囲が違うのかを切り分けられない。式を書いておけば
 * レポートの数字だけで検算できる。
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

      // 閾値判定は実額があれば実額で、なければ推定で行う。
      const thresholdBasisUsd =
        actual.kind === 'ok' ? actual.totalCostUsd : aggregate.estimatedCostUsd;
      const thresholdExceeded = thresholdBasisUsd >= DAILY_COST_THRESHOLD_USD;

      const fields = [
        { name: '日付 (JST)', value: dateKey, inline: true },
        {
          // 実請求は org 全体の額。Oryzae のアプリ以外（CI のセキュリティレビュー・
          // 手元の検証など）も含むので、推定と一致しないのが正常。
          name: '実請求額 (org 全体)',
          value: formatActualField(actual, actualUtcDateKey),
          inline: true,
        },
        {
          name: '推定コスト (発酵・記録分)',
          value: usd(aggregate.estimatedCostUsd),
          inline: true,
        },
      ];

      if (actual.kind === 'ok') {
        // 用途別の実額。「OCR がいくらか」はここで読む（推定ではなく実額）。
        // grouping が効いていないと総額は正しいまま内訳だけ消えるので、その旨を出す。
        fields.push({
          name: '実請求額の内訳（モデル別・実額）',
          value: actual.groupingUnavailable
            ? 'Anthropic が内訳を返しませんでした（group_by が効いていない可能性）。総額は正しい値です'
            : formatModelBreakdown(actual.byModel),
          inline: false,
        });

        // 「なぜ数字が違うのか」をレポート自身に書く。毎朝これを見た人が
        // 推定の計算そのものが壊れていると誤解しないようにする。
        const gap = actual.totalCostUsd - aggregate.estimatedCostUsd;
        fields.push({
          name: '差額 (実請求 − 推定)',
          value: `${usd(gap)}\n推定は発酵のみ。差は OCR・CI のレビュー・手元の検証など`,
          inline: false,
        });
      }

      fields.push(
        {
          name: '発酵数',
          value: `${aggregate.fermentationCount} (成功 ${aggregate.completedCount} / 失敗 ${aggregate.failedCount})`,
          inline: true,
        },
        {
          name: 'トークン',
          value: `in ${tokens(aggregate.inputTokens)} / out ${tokens(aggregate.outputTokens)}`,
          inline: true,
        },
        {
          name: 'コスト未計上',
          value: `${aggregate.untrackedCount} 件`,
          inline: true,
        },
        {
          name: '推定の計算根拠',
          value: formatBasis(aggregate.inputTokens, aggregate.outputTokens),
          inline: false,
        },
        {
          name: `ユーザー別 推定コスト (上位${TOP_USER_COUNT})`,
          value: formatUserBreakdown(aggregate.byUser),
          inline: false,
        },
      );

      if (thresholdExceeded) {
        fields.push({
          name: '閾値',
          value: `$${DAILY_COST_THRESHOLD_USD.toFixed(2)}`,
          inline: true,
        });
      }
      if (rows.truncated) {
        fields.push({
          name: '⚠️ 集計打ち切り',
          value: '件数が上限を超えたため、推定は過少集計です',
          inline: false,
        });
      }

      await notifyDiscord({
        title: thresholdExceeded ? 'AI コスト警告 — 閾値超過' : 'AI コスト日次レポート',
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
