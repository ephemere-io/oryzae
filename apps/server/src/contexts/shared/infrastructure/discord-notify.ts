/**
 * Discord Webhook notification utility.
 *
 * Sends embed messages to Discord via webhook URL.
 * Silently fails if DISCORD_WEBHOOK_URL is not set (no-op in dev).
 */

interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
}

const COLOR_SUCCESS = 0x22c55e; // green
const COLOR_WARNING = 0xeab308; // yellow
const COLOR_ERROR = 0xef4444; // red
const COLOR_INFO = 0x3b82f6; // blue

export const COLORS = {
  SUCCESS: COLOR_SUCCESS,
  WARNING: COLOR_WARNING,
  ERROR: COLOR_ERROR,
  INFO: COLOR_INFO,
};

export async function notifyDiscord(embed: DiscordEmbed): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{ ...embed, timestamp: embed.timestamp ?? new Date().toISOString() }],
      }),
    });

    // issue #384: 送信失敗を握りつぶすと「通知が来ない」原因を追えない（cron は 200 で
    // 完了しているのに完了通知が出ない、等）。アプリは止めないが、res.ok を確認して
    // 失敗時はステータスと本文先頭をログに出し、可観測にする（Vercel ログで追える）。
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[notifyDiscord] webhook responded with non-OK status', {
        status: res.status,
        title: embed.title,
        body: body.slice(0, 500),
      });
    }
  } catch (error) {
    // 送信失敗はアプリを止めない。ただし黙殺せずログに残す（dev で URL 未設定の場合は
    // 上の early-return で到達しないため、ここに来るのは実際のネットワーク等のエラー）。
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[notifyDiscord] webhook request failed', { title: embed.title, error: message });
  }
}
