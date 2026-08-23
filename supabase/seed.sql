-- ローカル / CI 用のシードデータ（Issue #490 follow-up）
--
-- E2E が本番 DB を使わなくて済むよう、使い捨てインスタンスに必要なアカウントだけ作る。
-- `supabase start` が migrations 適用後にこのファイルを流す（config.toml の [db.seed]）。
--
-- ここに書く資格情報はローカル専用のダミーであり、秘密ではない。
-- そのためワークフローにも平文で書いてよい（本番の secrets を CI に置かずに済む）。

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

-- onboarding_completed を立てないと初回オンボーディングのモーダル（role="dialog"）が
-- 全画面に被さり、E2E のクリックを片っ端から遮る（実際に9件が落ちた）。
insert into public.profiles (id, nickname, onboarding_completed)
values ('00000000-0000-0000-0000-0000000000e1', 'e2e-ci', true);

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

insert into public.profiles (id, nickname, onboarding_completed)
values ('00000000-0000-0000-0000-0000000000a1', 'e2e-admin', true);
