import type { Context, Next } from 'hono';
import { COLORS, notifyDiscord } from '../../infrastructure/discord-notify.js';

interface CronAuthOptions {
  // Log prefix (例: 'cron-fermentation') — `console.error` の `[<routeName>] ...` で使う。
  routeName: string;
  // Discord 通知タイトルの prefix (例: '発酵 cron') — `<discordTitlePrefix>: CRON_SECRET 未設定` 等。
  discordTitlePrefix: string;
}

// Vercel Cron からの `Bearer $CRON_SECRET` を検証する middleware ファクトリ。
//
// 失敗時 (未設定 / 不一致) は `console.error` + Discord webhook 通知の両方を行ってから
// HTTP レスポンスを返す。CRON_SECRET の未設定で 8 日間サイレントに 500 を返し続けた事故
// を踏まえ、すべての失敗経路で可視化することを保証する。
export function createCronAuthMiddleware(options: CronAuthOptions) {
  const { routeName, discordTitlePrefix } = options;

  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error(`[${routeName}] CRON_SECRET not configured`);
      await notifyDiscord({
        title: `${discordTitlePrefix}: CRON_SECRET 未設定`,
        description: 'Vercel 環境変数 CRON_SECRET が未設定のため cron が実行できません。',
        color: COLORS.ERROR,
      });
      return c.json({ error: 'CRON_SECRET not configured' }, 500);
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error(`[${routeName}] Unauthorized request`, {
        hasAuthHeader: Boolean(authHeader),
      });
      await notifyDiscord({
        title: `${discordTitlePrefix}: 認証失敗`,
        description: 'Authorization header が CRON_SECRET と一致しません。',
        color: COLORS.ERROR,
      });
      return c.json({ error: 'Unauthorized' }, 401);
    }

    await next();
  };
}
