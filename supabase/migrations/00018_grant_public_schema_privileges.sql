-- public スキーマのロール権限を明示する。
--
-- ホスト版 Supabase はプロジェクト作成時に anon / authenticated / service_role へ
-- public スキーマの既定 GRANT を付与する。本番はそれに依存して動いていたが、
-- `supabase/migrations/` はこの権限を持っておらず、**リポジトリだけでは本番スキーマを
-- 再現できなかった**。実際、使い捨てインスタンス（`supabase start`）に migrations を
-- 適用しただけでは以下で落ちる:
--
--   permission denied for table questions
--   hint: Grant the required privileges to the current role with:
--         GRANT SELECT ON public.questions TO authenticated;
--
-- 行単位の保護は各 migration の RLS ポリシーが担うため、ここではホスト版と同じ粒度で
-- テーブル権限を付与する（RLS が有効なテーブルでは GRANT だけでは行を読めない）。
--
-- GRANT は冪等なので、既に権限が付いている本番に適用しても影響はない。

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- 以降に追加されるオブジェクトにも同じ既定を適用する。
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
