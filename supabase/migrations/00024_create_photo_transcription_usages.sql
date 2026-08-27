-- 写真の文字起こし（OCR）のトークン使用量。
--
-- 発酵は fermentation_results に input_tokens/output_tokens を持たせて (00017)
-- 価格表からコストを算出しているが、文字起こしには結果を保存するテーブルが無い
-- （起こした文字はユーザーが確認して本文へ入れるまで保存しない設計）。
-- そのため使用量だけを記録する専用テーブルを置く。
--
-- 起こした文字そのものは保存しない。日記の中身そのものであり、本文に入れた時点で
-- entries 側に残るため、ここに重複して置く理由が無い（docs/entry-photo-guide.md）。
--
-- model を持つのは、発酵とは別のモデルを使うため。価格表は claude-pricing.ts が
-- モデル別に持っており、モデルを差し替えても過去分が誤った単価で再計算されない。
create table photo_transcription_usages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  -- 起こせた文字数。精度の傾向を見るための指標で、本文そのものではない。
  char_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- 月次のコスト集計が created_at 範囲で引くため。
create index photo_transcription_usages_created_at_idx
  on photo_transcription_usages (created_at desc);

alter table photo_transcription_usages enable row level security;

-- 管理画面は service role で読むので RLS を通らない。ユーザー本人には自分の分だけ見せる。
create policy "photo_transcription_usages_own_data" on photo_transcription_usages
  for all using (user_id = auth.uid());
