-- ローカル / CI 用のシードデータ（Issue #490 follow-up）
--
-- E2E が本番 DB を使わなくて済むよう、使い捨てインスタンスに必要なアカウントだけ作る。
-- `supabase start` が migrations 適用後にこのファイルを流す（config.toml の [db.seed]）。
--
-- ここに書く資格情報はローカル専用のダミーであり、秘密ではない。
-- そのためワークフローにも平文で書いてよい（本番の secrets を CI に置かずに済む）。

-- ── ロール権限（本番との差分を埋める）──────────────────────────────────────
-- ホスト版 Supabase はプロジェクト作成時に public スキーマの既定 GRANT を
-- anon / authenticated に付与するが、`supabase/migrations/` はそれを持っていない。
-- そのため使い捨てインスタンスでは "permission denied for table questions" になる。
-- 行単位の保護は各 migration の RLS ポリシーが担うので、ホスト版と同じ粒度で付与する。
--
-- NOTE: これは migrations が本番スキーマを完全には再現できていないことの裏返し。
--       本筋は GRANT を migration に取り込むこと（別途対応）。
grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
grant all privileges on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- ── クライアント E2E 用アカウント ──────────────────────────────────────────
--   email    : e2e@oryzae.test
--   password : e2e-password-1234
--   nickname : e2e-ci
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000000e1',
  'authenticated', 'authenticated',
  'e2e@oryzae.test',
  crypt('e2e-password-1234', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"locale":"ja"}',
  '', '', '', ''
);

-- GoTrue はパスワードログイン時に identities を参照するため必須。
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '00000000-0000-0000-0000-0000000000e1',
  '00000000-0000-0000-0000-0000000000e1',
  '{"sub":"00000000-0000-0000-0000-0000000000e1","email":"e2e@oryzae.test"}',
  'email',
  now(), now(), now()
);

insert into public.profiles (id, nickname)
values ('00000000-0000-0000-0000-0000000000e1', 'e2e-ci');

-- ── 管理画面 E2E 用アカウント ──────────────────────────────────────────────
--   email    : test@oryzae.dev
--   password : TestAdmin2026!
--   管理権限は user_metadata.is_admin で判定される（admin-auth ミドルウェア）
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000000a1',
  'authenticated', 'authenticated',
  'test@oryzae.dev',
  crypt('TestAdmin2026!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"locale":"ja","is_admin":true}',
  '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000a1',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"test@oryzae.dev"}',
  'email',
  now(), now(), now()
);

insert into public.profiles (id, nickname)
values ('00000000-0000-0000-0000-0000000000a1', 'e2e-admin');
