import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveUserEmails, resolveUserNicknames } from './fermentation-cost-query.js';

/**
 * userId → 表示名「nickname (email)」。片方しか無ければある方。両方無ければ載せない
 * （呼び出し側が ID の先頭 8 桁などに縮退する）。
 *
 * 対象のユーザーをまとめて 1 回で引く。listUsers はページングで最大 20 往復するので、
 * 欄ごとに引き直さない。解決に失敗しても例外にしない（空の Map を返す）。
 */
export async function resolveUserLabels(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  const targets = Array.from(new Set(userIds));
  if (targets.length === 0) return labels;
  try {
    const [emails, nicknames] = await Promise.all([
      resolveUserEmails(supabase),
      resolveUserNicknames(supabase, targets),
    ]);
    for (const userId of targets) {
      const nickname = nicknames.get(userId) ?? '';
      const email = emails.get(userId) ?? '';
      const label = nickname && email ? `${nickname} (${email})` : nickname || email;
      if (label) labels.set(userId, label);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[user-labels] user lookup failed', { error: message });
  }
  return labels;
}
