import { Hono } from 'hono';
import { COLORS, notifyDiscord } from '../../infrastructure/discord-notify.js';

/**
 * Vercel Deploy Webhook receiver.
 *
 * Vercel sends POST with a JSON body when deployment events occur.
 * We forward relevant events to Discord.
 *
 * Setup: Vercel Dashboard → Project → Settings → Webhooks
 *   URL: https://oryzae.vercel.app/api/v1/webhooks/vercel
 *   Events: deployment.created, deployment.succeeded, deployment.error
 */
export const webhookVercel = new Hono().post('/', async (c) => {
  const body = (await c.req.json()) as Record<string, unknown>;
  const type = typeof body.type === 'string' ? body.type : '';
  const payload =
    typeof body.payload === 'object' && body.payload !== null
      ? (body.payload as Record<string, unknown>)
      : {};

  const deployment =
    typeof payload.deployment === 'object' && payload.deployment !== null
      ? (payload.deployment as Record<string, unknown>)
      : payload;

  const name = typeof deployment.name === 'string' ? deployment.name : 'unknown';
  const url = typeof deployment.url === 'string' ? deployment.url : '';
  const meta =
    typeof deployment.meta === 'object' && deployment.meta !== null
      ? (deployment.meta as Record<string, unknown>)
      : {};
  const commitMessage =
    typeof meta.githubCommitMessage === 'string' ? meta.githubCommitMessage.slice(0, 100) : '';

  if (type === 'deployment.error' || type === 'deployment.failed') {
    await notifyDiscord({
      title: 'Vercel デプロイ失敗',
      color: COLORS.ERROR,
      fields: [
        { name: 'Project', value: name, inline: true },
        { name: 'URL', value: url ? `https://${url}` : '-', inline: true },
        ...(commitMessage ? [{ name: 'Commit', value: commitMessage }] : []),
      ],
    });
  } else if (type === 'deployment.succeeded' || type === 'deployment.ready') {
    await notifyDiscord({
      title: 'Vercel デプロイ成功',
      color: COLORS.SUCCESS,
      fields: [
        { name: 'Project', value: name, inline: true },
        { name: 'URL', value: url ? `https://${url}` : '-', inline: true },
        ...(commitMessage ? [{ name: 'Commit', value: commitMessage }] : []),
      ],
    });
  }

  return c.json({ ok: true });
});
