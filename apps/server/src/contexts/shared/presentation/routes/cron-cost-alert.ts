import { Hono } from 'hono';
import { type ActualCostResult, fetchActualCost } from '../../infrastructure/anthropic-cost-api.js';
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

/**
 * ユーザー別内訳。Discord は内部運用チャンネルだが、既存の発酵 cron 通知が
 * userId.slice(0, 8) 表記なのに合わせ、メールアドレスは送らない。
 * メール付きの内訳は admin の /costs 画面で見られる。
 */
function formatUserBreakdown(byUser: UserCostAggregate[]): string {
  if (byUser.length === 0) return '-';
  const top = byUser.slice(0, TOP_USER_COUNT);
  const lines = top.map(
    (u) => `${u.userId.slice(0, 8)}  $${u.estimatedCostUsd.toFixed(4)}  (${u.fermentationCount}件)`,
  );
  const rest = byUser.length - top.length;
  if (rest > 0) lines.push(`…他 ${rest} 名`);
  return lines.join('\n');
}

function formatActualField(result: ActualCostResult, utcDateKey: string): string {
  if (result.kind === 'ok') {
    const amount = `$${result.totalCostUsd.toFixed(4)} (UTC ${utcDateKey})`;
    // ページング打ち切りは過少集計。黙って完全な実額のように見せない。
    return result.truncated ? `${amount} ※集計打ち切り・過少` : amount;
  }
  if (result.kind === 'not-configured') return '未設定 (ANTHROPIC_ADMIN_KEY)';
  return `取得失敗: ${result.message.slice(0, 80)}`;
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
          name: '実請求額',
          value: formatActualField(actual, actualUtcDateKey),
          inline: true,
        },
        {
          name: '推定コスト',
          value: `$${aggregate.estimatedCostUsd.toFixed(4)}`,
          inline: true,
        },
        {
          name: '発酵数',
          value: `${aggregate.fermentationCount} (成功 ${aggregate.completedCount} / 失敗 ${aggregate.failedCount})`,
          inline: true,
        },
        {
          name: 'トークン',
          value: `in ${aggregate.inputTokens.toLocaleString('en-US')} / out ${aggregate.outputTokens.toLocaleString('en-US')}`,
          inline: true,
        },
        {
          name: 'コスト未計上',
          value: `${aggregate.untrackedCount} 件`,
          inline: true,
        },
        {
          name: `ユーザー別 推定コスト (上位${TOP_USER_COUNT})`,
          value: formatUserBreakdown(aggregate.byUser),
        },
      ];

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
          value: '件数が上限を超えたため、上記は過少集計です',
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
                costUsd: Math.round(actual.totalCostUsd * 1000000) / 1000000,
                truncated: actual.truncated,
              }
            : { status: actual.kind },
        actualCostUtcDate: actualUtcDateKey,
        estimatedCost: Math.round(aggregate.estimatedCostUsd * 1000000) / 1000000,
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
