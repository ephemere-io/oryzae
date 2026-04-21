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
