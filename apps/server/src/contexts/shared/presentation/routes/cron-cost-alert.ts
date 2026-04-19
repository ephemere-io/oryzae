import { gateway } from 'ai';
import { Hono } from 'hono';
import { COLORS, notifyDiscord } from '../../infrastructure/discord-notify.js';
import { getSupabaseClient } from '../../infrastructure/supabase-client.js';

const DAILY_COST_THRESHOLD_USD = 1.0;

export const cronCostAlert = new Hono()
  .use('*', async (c, next) => {
    const authHeader = c.req.header('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return c.json({ error: 'CRON_SECRET not configured' }, 500);
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    await next();
  })
  .post('/', async (c) => {
    const supabase = getSupabaseClient();

    // Get yesterday's date range (UTC)
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dayStart = `${yesterday.toISOString().slice(0, 10)}T00:00:00.000Z`;
    const dayEnd = `${yesterday.toISOString().slice(0, 10)}T23:59:59.999Z`;

    // Fetch fermentations with cost tracking from yesterday
    const { data, error } = await supabase
      .from('fermentation_results')
      .select('generation_id')
      .not('generation_id', 'is', null)
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd);

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    // Sum costs
    let totalCost = 0;
    let trackedCount = 0;
    for (const row of data ?? []) {
      try {
        const info = await gateway.getGenerationInfo({ id: row.generation_id });
        if (typeof info?.totalCost === 'number') {
          totalCost += info.totalCost;
          trackedCount++;
        }
      } catch {
        // skip failed lookups
      }
    }

    const dateLabel = yesterday.toISOString().slice(0, 10);

    // Always send a daily summary
    if (totalCost >= DAILY_COST_THRESHOLD_USD) {
      await notifyDiscord({
        title: 'AI コスト警告 — 閾値超過',
        color: COLORS.ERROR,
        fields: [
          { name: '日付', value: dateLabel, inline: true },
          { name: '合計コスト', value: `$${totalCost.toFixed(4)}`, inline: true },
          { name: '閾値', value: `$${DAILY_COST_THRESHOLD_USD.toFixed(2)}`, inline: true },
          { name: 'トラッキング数', value: String(trackedCount) },
        ],
      });
    } else {
      await notifyDiscord({
        title: 'AI コスト日次レポート',
        color: COLORS.INFO,
        fields: [
          { name: '日付', value: dateLabel, inline: true },
          { name: '合計コスト', value: `$${totalCost.toFixed(4)}`, inline: true },
          { name: 'トラッキング数', value: String(trackedCount), inline: true },
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
  });
