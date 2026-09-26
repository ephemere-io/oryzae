-- AI usage — ユーザーが AI の機能を 1 回使うごとに 1 行残す。
--
-- 「誰が・いつ・どの機能を・何に対して・何トークン使ったか」の置き場はここ 1 か所。
-- 発酵・ボード OCR・写真の文字起こしのどれも同じ形で書く。機能を足すときは
-- feature に値を 1 つ足すだけで、表は増やさない。
--
-- これまで発酵のトークン数は fermentation_results の列に書いていた。結果の表に
-- 利用量が混ざる・再試行で前の試行の数字が上書きされる・OCR はどこにも残らない、
-- を解消するため、利用量はこの表に寄せる（fermentation_results の列は別の migration で消す）。
--
-- 金額は持たない。実請求額は Anthropic の cost_report（Workspace 別）が正で、
-- ユーザー別の推定は読むときにトークン × 単価で出す。
--
-- **日記の中身は持たない。** 本文・読み取った文字・画像・プロンプトはどれも入れない。
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- どの機能か。API キーの分け方と同じ。
  --   fermentation: 発酵（キー oryzae-prod-fermentation）
  --   ocr_board:    ボードに画像を落としたときの OCR（キー oryzae-prod-ocr-board）
  --   ocr_entry:    エントリに添えた写真の文字起こし（キー oryzae-prod-ocr-entry）
  feature text not null check (feature in ('fermentation', 'ocr_board', 'ocr_entry')),
  -- 何に対する利用か。発酵なら fermentation_results の id。OCR は保存物が無いので null。
  -- board_cards.ref_id と同じく、feature によって指す先が変わるので外部キーは張らない。
  ref_id uuid,
  input_tokens integer not null,
  output_tokens integer not null,
  created_at timestamptz not null default now()
);

-- 日次レポート・月次集計は created_at の範囲で引く
create index ai_usage_created_at_idx on public.ai_usage (created_at);
-- 管理画面は発酵の id からその発酵のトークン数を引く
create index ai_usage_ref_id_idx on public.ai_usage (ref_id);

alter table public.ai_usage enable row level security;

-- OCR はユーザー本人のリクエストの中で、そのユーザーの JWT で書く
-- （service role の利用箇所を増やさないため）。他人の user_id では書けない。
create policy "ai_usage_insert_own" on public.ai_usage
  for insert to authenticated
  with check (auth.uid() = user_id);

-- 発酵の cron・日次レポート・管理画面は service role で書く・読む。
-- ユーザー向けの読み取りは無い（「今月の使用量」を本人に見せるときに足す）。
create policy "ai_usage_service_role" on public.ai_usage
  for all to service_role
  using (true)
  with check (true);

-- これまで fermentation_results に書いていた発酵のトークン数を移す。
-- トークンが残っていない行（AI Gateway 時代・失敗）は移さない。推測で埋めない。
-- 時刻は発酵の created_at に揃える（これまでの集計と同じ日に数えるため）。
insert into public.ai_usage (user_id, feature, ref_id, input_tokens, output_tokens, created_at)
select user_id, 'fermentation', id, input_tokens, coalesce(output_tokens, 0), created_at
from public.fermentation_results
where input_tokens is not null;
