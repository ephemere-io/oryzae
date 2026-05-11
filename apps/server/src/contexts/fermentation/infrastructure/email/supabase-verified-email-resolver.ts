import type { SupabaseClient } from '@supabase/supabase-js';

export function createSupabaseVerifiedEmailResolver(
  supabase: SupabaseClient,
): (userId: string) => Promise<string | null> {
  return async (userId: string): Promise<string | null> => {
    const { data } = await supabase.auth.admin.getUserById(userId);
    const user = data?.user;
    if (!user?.email) return null;
    if (!user.email_confirmed_at) return null;
    return user.email;
  };
}

// issue #290 フォロー: admin デバッグ用に「未検証メールにも送信したい」場面で
// 使う resolver。本番のスケジューラー / 通常フローでは使わない。
// email_confirmed_at の制約だけ外し、email 自体が存在しないユーザーは null。
export function createSupabaseAnyEmailResolver(
  supabase: SupabaseClient,
): (userId: string) => Promise<string | null> {
  return async (userId: string): Promise<string | null> => {
    const { data } = await supabase.auth.admin.getUserById(userId);
    const user = data?.user;
    if (!user?.email) return null;
    return user.email;
  };
}
