-- OCR (画像→文字起こし) の LLM トークン使用量を記録する。
--
-- ボードの OCR は claude-opus-5 を叩いており実際に課金されているが、usage は
-- gateway が返した時点で捨てられていた。結果、admin の推定コストにも Discord の
-- 日次レポートにも $0 しか乗らず、実請求額との差が「原因不明の乖離」に見えていた。
--
-- 発酵は fermentation_results に列を足す形 (00017) でトークンを持っているが、OCR は
-- 呼び出しごとに残るレコードが無い（スニペットを作るかはユーザーが決めるので、
-- 読み取っただけで保存しない場合もある。それでも課金は発生している）。よって専用テーブルにする。
--
-- model を列に持つのは、単価がモデルで変わるため。過去分を後から別単価で読み直せるよう、
-- 「どのモデルで何トークン使ったか」を事実として残す（金額は保存しない）。
create table ocr_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  created_at timestamptz not null default now()
);

-- 期間集計 (admin の /spend と日次レポート) が毎回この列で絞る。
create index ocr_usage_created_at_idx on ocr_usage (created_at);

alter table ocr_usage enable row level security;

-- 書き込みはユーザー自身のリクエスト経路から行う（サーバーは anon key + ユーザー JWT の
-- クライアントを使うため RLS が認可境界になる）。他人の user_id では insert できない。
create policy "Users can insert own ocr usage" on ocr_usage
  for insert to authenticated with check (user_id = auth.uid());

create policy "Users can read own ocr usage" on ocr_usage
  for select to authenticated using (user_id = auth.uid());
