-- #503: profiles の "Service role can manage all profiles" は TO 句が無いため
-- PUBLIC（anon / authenticated を含む全ロール）に適用されていた。
-- permissive ポリシーは OR 結合されるので、このポリシー 1 本で
-- "Users can read own profile" / "Users can update own profile" の絞り込みが
-- 無効化され、任意のログインユーザーが全ユーザーの profiles を
-- SELECT / UPDATE / DELETE できる状態になっていた。
--
-- service role は RLS をバイパスするため、このポリシー自体が不要。
-- signup 時の INSERT は service role クライアント経由なのでポリシーは要らない。
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;
