-- LLM usage events — 画像の文字起こし（ボード OCR / 写真の文字起こし）の呼び出しを
-- 1 回ごとに記録する。日次コストレポートで「誰が何回使ったか」を出すため。
--
-- 金額は持たない。実請求額は Anthropic の cost_report（Workspace 別）が正で、
-- ここに要るのは Anthropic が構造的に持てない「Oryzae のどのユーザーか」だけ。
-- トークン数は Anthropic が返した値をそのまま記録する（推定ではない）。
--
-- **本文は持たない。** 読み取った文字・画像・パスはどれも日記の中身なので、
-- 記録するのは誰が・いつ・どの機能を・どのモデルで・何トークン使ったかだけ。
--
-- 発酵は fermentation_results にユーザーとトークンが既にあるので、ここには入れない。
create table public.llm_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- ocr_board: ボードに画像を落としたときの OCR
  -- ocr_entry: エントリに写真を添えたときの文字起こし
  feature text not null check (feature in ('ocr_board', 'ocr_entry')),
  -- 失敗して応答が無かった呼び出しは null
  model text,
  input_tokens integer,
  output_tokens integer,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);

-- 日次レポートは created_at の範囲で引く
create index llm_usage_events_created_at_idx on public.llm_usage_events (created_at);

alter table public.llm_usage_events enable row level security;

-- 書き込みはユーザー本人のリクエストの中で、そのユーザーの JWT で行う
-- （service role の利用箇所を増やさないため）。他人の user_id では書けない。
create policy "llm_usage_events_insert_own" on public.llm_usage_events
  for insert to authenticated
  with check (auth.uid() = user_id);

-- 読むのは日次レポートの cron だけ（service role）。ユーザー向けの読み取りは無い。
create policy "llm_usage_events_service_role" on public.llm_usage_events
  for all to service_role
  using (true)
  with check (true);
