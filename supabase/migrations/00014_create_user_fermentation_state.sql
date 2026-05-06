-- 発酵プロセスの自動発火条件 (issue #268) を保持するユーザー単位の状態テーブル。
-- 直前の発酵実行時刻、次回までのランダム X 時間 (24-168h)、最終実行以降に書かれた
-- 文字数、現在の発火条件達成度 (readiness 0.00-1.00) を記録する。
-- readiness は admin ダッシュボード表示と Jar アニメーションへの反映を意図する。

create table user_fermentation_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_run_at timestamptz null,
  next_eligible_at timestamptz null,
  next_random_hours smallint null
    check (next_random_hours is null or (next_random_hours between 24 and 168)),
  chars_since_last bigint not null default 0
    check (chars_since_last >= 0),
  readiness_score numeric(3, 2) not null default 0.00
    check (readiness_score >= 0 and readiness_score <= 1),
  updated_at timestamptz not null default now()
);

-- next_eligible_at で「もうすぐ発火する」ユーザーを admin で抽出するためのインデックス。
create index user_fermentation_state_next_eligible_idx
  on user_fermentation_state (next_eligible_at)
  where next_eligible_at is not null;

alter table user_fermentation_state enable row level security;

create policy "Users can read own fermentation state" on user_fermentation_state
  for select using (user_id = auth.uid());

-- 既存の update_updated_at_column() (00004 で定義) を流用。
create trigger trg_user_fermentation_state_updated_at
  before update on user_fermentation_state
  for each row execute function update_updated_at_column();
