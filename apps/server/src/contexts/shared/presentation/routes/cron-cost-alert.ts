import { Hono } from 'hono';
import { fetchDailyCosts, sumDailyCosts } from '../../infrastructure/anthropic-cost-report.js';
import { COLORS, notifyDiscord } from '../../infrastructure/discord-notify.js';
import { createCronAuthMiddleware } from '../middleware/cron-auth.js';

const DAILY_COST_THRESHOLD_USD = 1.0;

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
      // Get yesterday's date range (UTC)
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const dayStart = `${yesterday.toISOString().slice(0, 10)}T00:00:00.000Z`;
      const dayEnd = `${yesterday.toISOString().slice(0, 10)}T23:59:59.999Z`;
      const dateLabel = yesterday.toISOString().slice(0, 10);

      // Anthropic の Cost Report から前日の実請求額を引く。
      //
      // 以前は fermentation_results の generation_id を gateway に問い合わせていたが、
      // issue #352 で Anthropic 直叩きに切替えて以降 generation_id は発行されない。
      // その結果このクエリは常に 0 件で、日次レポートは毎日 $0.0000 を報告していた。
      // Cost Report なら発酵・文字起こしを含む組織全体の実費がそのまま取れる。
      const dailyCosts = await fetchDailyCosts(dayStart, dayEnd);

      if (dailyCosts === null) {
        console.error('[cron-cost-alert] cost report unavailable', { date: dateLabel });
        await notifyDiscord({
          title: 'コスト cron: Cost Report を取得できません',
          description:
            'ANTHROPIC_ADMIN_KEY が未設定か、Admin API がエラーを返しました。日次コストを報告できません。',
          color: COLORS.ERROR,
        });
        return c.json({ error: 'Cost report unavailable' }, 500);
      }

      const totalCost = sumDailyCosts(dailyCosts);
      const trackedCount = dailyCosts.length;

      // Always send a daily summary
      if (totalCost >= DAILY_COST_THRESHOLD_USD) {
        await notifyDiscord({
          title: 'AI コスト警告 — 閾値超過',
          color: COLORS.ERROR,
          fields: [
            { name: '日付', value: dateLabel, inline: true },
            { name: '合計コスト', value: `$${totalCost.toFixed(4)}`, inline: true },
            { name: '閾値', value: `$${DAILY_COST_THRESHOLD_USD.toFixed(2)}`, inline: true },
            { name: '集計日数', value: String(trackedCount) },
          ],
        });
      } else {
        await notifyDiscord({
          title: 'AI コスト日次レポート',
          color: COLORS.INFO,
          fields: [
            { name: '日付', value: dateLabel, inline: true },
            { name: '合計コスト', value: `$${totalCost.toFixed(4)}`, inline: true },
            { name: '集計日数', value: String(trackedCount), inline: true },
          ],
        });
      }

      return c.json({
        message: 'Cost alert check completed',
        date: dateLabel,
        totalCost: Math.round(totalCost * 1000000) / 1000000,
        trackedCount,
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
