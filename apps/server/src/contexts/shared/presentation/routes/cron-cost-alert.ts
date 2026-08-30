import { Hono } from 'hono';
import { fetchDailyCosts, sumDailyCosts } from '../../infrastructure/anthropic-cost-report.js';
import { computeCostFromTokens } from '../../infrastructure/claude-pricing.js';
import { COLORS, notifyDiscord } from '../../infrastructure/discord-notify.js';
import { getSupabaseClient } from '../../infrastructure/supabase-client.js';
import { createCronAuthMiddleware } from '../middleware/cron-auth.js';

const DAILY_COST_THRESHOLD_USD = 1.0;

interface TokenRow {
  input_tokens: number | null;
  output_tokens: number | null;
  model?: string | null;
}

function sumCost(rows: TokenRow[]): number {
  return rows.reduce((total, row) => {
    const cost = computeCostFromTokens(row.input_tokens, row.output_tokens, row.model);
    return total + (cost?.totalCost ?? 0);
  }, 0);
}

/**
 * 前日の AI コストを Discord に日次報告する。
 *
 * 金額は Anthropic の Cost Report（実請求額）から引く。Admin API キーが無い環境では
 * 保存済みトークン × 価格表の**概算**に落とし、その旨を通知に出す（黙って別種の数字に
 * すり替わるのを避けるため）。概算にはキャッシュ割引・tier 割引・価格改定が乗らない。
 *
 * 以前は fermentation_results の generation_id を gateway に問い合わせていたが、
 * issue #352 で Anthropic 直叩きに切替えて以降 generation_id は発行されない。
 * その結果クエリは常に 0 件で、日次レポートは毎日 $0.0000 を報告していた。
 * トークン数から出す方式に変え、写真の文字起こし分も足す。
 */
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

      // Get yesterday's date range (UTC)
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const dayStart = `${yesterday.toISOString().slice(0, 10)}T00:00:00.000Z`;
      const dayEnd = `${yesterday.toISOString().slice(0, 10)}T23:59:59.999Z`;
      const dateLabel = yesterday.toISOString().slice(0, 10);

      const [fermentations, transcriptions] = await Promise.all([
        supabase
          .from('fermentation_results')
          .select('input_tokens, output_tokens')
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd),
        supabase
          .from('photo_transcription_usages')
          .select('model, input_tokens, output_tokens')
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd),
      ]);

      const failed = fermentations.error ?? transcriptions.error;
      if (failed) {
        console.error('[cron-cost-alert] Supabase query failed', { error: failed.message });
        await notifyDiscord({
          title: 'コスト cron: Supabase クエリ失敗',
          description: failed.message,
          color: COLORS.ERROR,
        });
        return c.json({ error: failed.message }, 500);
      }

      const fermentationRows = fermentations.data ?? [];
      const transcriptionRows = transcriptions.data ?? [];

      // 実請求額が取れればそれを使う。取れなければトークンからの概算。
      const billedDaily = await fetchDailyCosts(dayStart, dayEnd);
      const billed = billedDaily !== null;
      const totalCost = billed
        ? sumDailyCosts(billedDaily)
        : sumCost(fermentationRows) + sumCost(transcriptionRows);
      const costLabel = billed ? '合計コスト（実請求）' : '合計コスト（概算）';
      // 集計に使ったレコード数（発酵 + 文字起こし）。旧実装の trackedCount は
      // 「generation_id を引けた件数」で意味が違うため、名前を変えて取り違えを防ぐ。
      const recordCount = fermentationRows.length + transcriptionRows.length;

      // Always send a daily summary
      if (totalCost >= DAILY_COST_THRESHOLD_USD) {
        await notifyDiscord({
          title: 'AI コスト警告 — 閾値超過',
          color: COLORS.ERROR,
          fields: [
            { name: '日付', value: dateLabel, inline: true },
            { name: costLabel, value: `$${totalCost.toFixed(4)}`, inline: true },
            { name: '閾値', value: `$${DAILY_COST_THRESHOLD_USD.toFixed(2)}`, inline: true },
            { name: '発酵', value: String(fermentationRows.length), inline: true },
            { name: '文字起こし', value: String(transcriptionRows.length), inline: true },
          ],
        });
      } else {
        await notifyDiscord({
          title: 'AI コスト日次レポート',
          color: COLORS.INFO,
          fields: [
            { name: '日付', value: dateLabel, inline: true },
            { name: costLabel, value: `$${totalCost.toFixed(4)}`, inline: true },
            { name: '発酵', value: String(fermentationRows.length), inline: true },
            { name: '文字起こし', value: String(transcriptionRows.length), inline: true },
          ],
        });
      }

      return c.json({
        message: 'Cost alert check completed',
        date: dateLabel,
        totalCost: Math.round(totalCost * 1000000) / 1000000,
        recordCount,
        billed,
        thresholdExceeded: totalCost >= DAILY_COST_THRESHOLD_USD,
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
