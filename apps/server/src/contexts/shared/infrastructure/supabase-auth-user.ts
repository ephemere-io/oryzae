/**
 * ユーザー本人の JWT で、そのユーザーのパスワード・メールアドレスを更新する。
 *
 * supabase-js の `auth.updateUser()` は使えない。サーバーでは Authorization ヘッダーを
 * 持たせただけのクライアントを作っていて、`updateUser()` はクライアント内部に保存された
 * セッションを要求する（`getUser()` と違ってヘッダーだけでは通らない）。その結果
 * 毎回 "Auth session missing!" が返り、パスワード再設定の画面に「セッションが切れました」が
 * 出てパスワードを変えられなかった。
 *
 * `updateUser()` が内部で送っているのと同じ `PUT /auth/v1/user` を、本人の JWT で直接送る。
 * service role は使わない（本人のトークンで本人だけを更新する）。
 */

interface AuthUserAttributes {
  password?: string;
  email?: string;
}

const REQUEST_TIMEOUT_MS = 10_000;

export async function updateAuthUser(
  accessToken: string,
  attributes: AuthUserAttributes,
): Promise<{ error: string | null }> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase env vars not set');

  const res = await fetch(`${url}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(attributes),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (res.ok) return { error: null };

  // Supabase Auth のエラーは { msg } か { message } か { error_description }。
  // クライアントはこの文言で翻訳先を決めている（error-messages.ts）ので、そのまま返す。
  const body: unknown = await res.json().catch(() => null);
  return { error: readAuthErrorMessage(body) ?? `Auth request failed (HTTP ${res.status})` };
}

function readAuthErrorMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  for (const key of ['msg', 'message', 'error_description']) {
    const value: unknown = Reflect.get(body, key);
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}
