-- Board snippets (user-created short text notes)
create table board_snippets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table board_snippets enable row level security;
create policy "board_snippets_own_data" on board_snippets
  for all using (user_id = auth.uid());

-- Board cards (layout/position metadata for each card on the canvas)
create table board_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_type text not null check (card_type in ('entry', 'snippet')),
  ref_id uuid not null,
  date_key text not null,
  view_type text not null check (view_type in ('daily', 'weekly')),
  x double precision not null default 0,
  y double precision not null default 0,
  rotation double precision not null default 0,
  width double precision not null default 260,
  height double precision not null default 200,
  z_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_board_cards_user_date on board_cards(user_id, date_key, view_type);
create unique index idx_board_cards_unique_ref on board_cards(user_id, ref_id, date_key, view_type);

alter table board_cards enable row level security;
create policy "board_cards_own_data" on board_cards
  for all using (user_id = auth.uid());

-- Clean up board_cards when an entry is deleted
create or replace function cleanup_board_cards_on_entry_delete()
returns trigger as $$
begin
  delete from board_cards where ref_id = old.id and card_type = 'entry';
  return old;
end;
$$ language plpgsql security definer;

create trigger trg_cleanup_board_cards_on_entry_delete
  before delete on entries
  for each row
  execute function cleanup_board_cards_on_entry_delete();
