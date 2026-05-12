import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * OAuth サインインの「profile が無ければ作る」共通処理。
 *
 * 同一ロジックを `/oauth/callback` (PKCE flow) と `/oauth/finalize` (implicit flow)
 * の両方が呼ぶ。Issue #307 の原因はサーバ側 Supabase クライアントが implicit flow
 * デフォルトのため、callback 側だけに profile 作成があり SSO 新規ユーザーの
 * profile が永久に作られなかったこと。両 flow をこの helper に束ねて防ぐ。
 *
 * shared 層は user context を import できない（dep-cruise: shared-context-independence）
 * ため、capacity 上限 env の読みと profiles 件数取得は inline で実装する。
 */

const DEFAULT_LIMIT = 100;

interface EnsureOAuthProfileSuccess {
  status: 'ok';
  profile: { nickname: string; avatarUrl: string | null };
  /** 今回の呼び出しで profile を新規作成したか */
  created: boolean;
}

interface EnsureOAuthProfileCapacity {
  status: 'capacity_reached';
  limit: number;
}

type EnsureOAuthProfileResult = EnsureOAuthProfileSuccess | EnsureOAuthProfileCapacity;

/**
 * Supabase user_metadata からニックネームを生成する。
 *
 * - `full_name` があれば空白を `_` に変換し 30 文字で切る
 * - 無ければ `user_<uuid8>` にフォールバック
 */
export function computeOAuthNickname(user: User): string {
  const meta = user.user_metadata ?? {};
  if (typeof meta.full_name === 'string' && meta.full_name.trim().length > 0) {
    return meta.full_name.replace(/\s+/g, '_').slice(0, 30);
  }
  return `user_${user.id.slice(0, 8)}`;
}

export function extractOAuthAvatarUrl(user: User): string | null {
  const meta = user.user_metadata ?? {};
  return typeof meta.avatar_url === 'string' ? meta.avatar_url : null;
}

/**
 * MAX_USER_COUNT を解決する。空・非数値・0以下なら 100 にフォールバック。
 *
 * 同等関数が `user/application/config/signup-cap.ts` にあるが shared 層からは
 * import できないため重複している（Issue #300 で意図的に分離した経緯）。
 */
export function resolveMaxUserCountForOAuth(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.MAX_USER_COUNT;
  if (!raw) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return parsed;
}

/**
 * 認証済み OAuth ユーザーに対して profile 行を idempotent に保証する。
 *
 * - profile が既にあれば現状を返す
 * - 無ければ Research Preview 上限を確認のうえ insert
 * - 上限超過なら `auth.users` 行を巻き戻し削除して 409 用の結果を返す
 *
 * @param serviceSupabase  service-role クライアント（profiles への直接書き込みが必要なので RLS バイパス）
 * @param user             auth.users から取得済みのユーザー
 * @param maxUserCount     Research Preview 登録枠の上限
 */
export async function ensureOAuthProfile(
  serviceSupabase: SupabaseClient,
  user: User,
  maxUserCount: number,
): Promise<EnsureOAuthProfileResult> {
  const { data: existing } = await serviceSupabase
    .from('profiles')
    .select('nickname, avatar_url')
    .eq('id', user.id)
    .single();

  if (existing) {
    return {
      status: 'ok',
      profile: { nickname: existing.nickname, avatarUrl: existing.avatar_url ?? null },
      created: false,
    };
  }

  const { count } = await serviceSupabase
    .from('profiles')
    .select('id', { count: 'exact', head: true });

  if ((count ?? 0) >= maxUserCount) {
    // たった今 auth に作成された user を巻き戻して整合性を保つ
    await serviceSupabase.auth.admin.deleteUser(user.id);
    return { status: 'capacity_reached', limit: maxUserCount };
  }

  const nickname = computeOAuthNickname(user);
  const avatarUrl = extractOAuthAvatarUrl(user);

  await serviceSupabase.from('profiles').insert({
    id: user.id,
    nickname,
    avatar_url: avatarUrl,
  });

  return {
    status: 'ok',
    profile: { nickname, avatarUrl },
    created: true,
  };
}
