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
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{ ...embed, timestamp: embed.timestamp ?? new Date().toISOString() }],
      }),
    });
  } catch {
    // Silently ignore — notification failure should never break the app
  }
}
