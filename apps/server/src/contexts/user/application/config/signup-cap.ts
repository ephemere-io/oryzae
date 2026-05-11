import { DEFAULT_MAX_USER_COUNT } from '../../domain/policies/signup-capacity.policy.js';

/**
 * MAX_USER_COUNT 環境変数を解決する。
 *
 * Vercel/Supabase 等の env で運用変更できる。
 * 値が未設定・非数値・0 以下のいずれかなら DEFAULT_MAX_USER_COUNT (= 100) を返す。
 */
export function resolveMaxUserCount(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.MAX_USER_COUNT;
  if (!raw) return DEFAULT_MAX_USER_COUNT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_USER_COUNT;
  return parsed;
}
