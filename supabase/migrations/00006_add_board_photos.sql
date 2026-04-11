-- Board photos (user-uploaded images with captions)
create table board_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  caption text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table board_photos enable row level security;
create policy "board_photos_own_data" on board_photos
  for all using (user_id = auth.uid());

-- Add 'photo' to board_cards card_type constraint
alter table board_cards drop constraint board_cards_card_type_check;
alter table board_cards add constraint board_cards_card_type_check
  check (card_type in ('entry', 'snippet', 'photo'));

-- Storage bucket for board photos (created via Supabase dashboard/CLI)
-- Supabase MCP cannot create storage buckets, so this must be done manually:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('board-photos', 'board-photos', true);
