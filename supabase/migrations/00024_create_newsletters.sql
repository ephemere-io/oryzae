-- Newsletter — 登録使用者へ一斉配信するお知らせ (issue #614)。
--
-- 日記データとは無関係の **運営者が書く文章** なので、ユーザー単位の行という
-- 概念が無い。したがって RLS は「service_role だけ」に閉じる。admin API は
-- adminAuthMiddleware が is_admin を検証したうえで service role クライアントを
-- 渡すため、ここで anon / authenticated に開ける必要はまったく無い。
create table newsletters (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body_markdown text not null default '',
  -- draft → sending → sent の一方向。sending は二重送信を防ぐための中間状態で、
  -- 送信中にもう一度 /send が来ても弾ける（下の send usecase が status を見る）。
  -- 送信そのものが落ちたときは draft に戻し、last_error に理由を残す。
  status text not null default 'draft'
    check (status in ('draft', 'sending', 'sent')),
  -- 書いた admin。ユーザー削除で配信履歴まで消えると監査できないので set null。
  created_by uuid references auth.users(id) on delete set null,
  -- 送信時点の宛先数 / 実際に送れた数 / 失敗した数。送信後の事実を残す欄なので
  -- draft の間は 0。宛先数は「送るとき何名に送られるか」の確認画面とは別物
  -- （あちらはその場で数え直す）。
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 「前回の配信はいつか」を引くための索引。LLM 下書き生成が
-- 「前回配信以降に merge された PR」を取るのに使う。
create index newsletters_sent_at_idx
  on newsletters (sent_at desc)
  where sent_at is not null;

-- 一覧は新しい順に出す。
create index newsletters_created_at_idx on newsletters (created_at desc);

alter table newsletters enable row level security;

-- service_role は RLS をバイパスするロールなので、このポリシー自体は実質
-- ドキュメントだが、RLS 有効 + ポリシー 0 件は「全拒否」になるため必要。
-- TO を省略すると PUBLIC 扱いになり anon/authenticated にも効いてしまう
-- （scripts/check-rls-policies.mjs のルール 3）。必ず TO service_role を付ける。
create policy "newsletters_service_role_all" on newsletters
  for all to service_role using (true) with check (true);

create trigger trg_newsletters_updated_at
  before update on newsletters
  for each row execute function update_updated_at_column();

-- 配信停止の意思表示。一斉メールは日記の通知と違って「読みたくない人にも届く」
-- ので、止める口が無いまま送り始めない。UI はまだ無く、問い合わせを受けた運営が
-- ここを立てる運用（メール本文のフッターに連絡先を載せる）。
-- 既定 false = 配信対象。
alter table public.profiles
  add column if not exists newsletter_opt_out boolean not null default false;
