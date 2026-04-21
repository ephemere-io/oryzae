-- 発酵プロセスが走査したエントリ一覧を保持する join テーブル
-- これまでは fermentation_results.entry_id に先頭エントリだけ記録していたが、
-- ScheduledFermentationUsecase は複数エントリを結合して LLM に渡しており、
-- 走査対象の完全な一覧が失われていた。本マイグレーションで解消する。

create table fermentation_scanned_entries (
  id uuid primary key default gen_random_uuid(),
  fermentation_result_id uuid not null references fermentation_results(id) on delete cascade,
  entry_id uuid not null references entries(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (fermentation_result_id, entry_id)
);

create index fermentation_scanned_entries_fermentation_idx
  on fermentation_scanned_entries (fermentation_result_id);

alter table fermentation_scanned_entries enable row level security;
create policy "Users can read own scanned entries" on fermentation_scanned_entries
  for all using (
    fermentation_result_id in (
      select id from fermentation_results where user_id = auth.uid()
    )
  );

-- 既存レコードをバックフィル（entry_id は NOT NULL だったので必ず存在する）
insert into fermentation_scanned_entries (fermentation_result_id, entry_id)
select id, entry_id from fermentation_results
on conflict (fermentation_result_id, entry_id) do nothing;

-- 冗長になった entry_id カラムを削除
alter table fermentation_results drop column entry_id;
