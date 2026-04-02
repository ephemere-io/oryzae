create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  media_urls text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entry_snapshots (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  content text not null,
  editor_type text not null,
  editor_version text not null,
  extension jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_entries_user on entries(user_id, created_at desc);
create index idx_snapshots_entry on entry_snapshots(entry_id, created_at desc);

alter table public.entries enable row level security;
alter table public.entry_snapshots enable row level security;

create policy "entries_own_data" on public.entries
  for all using (user_id = auth.uid());

create policy "snapshots_own_data" on public.entry_snapshots
  for all using (
    entry_id in (select id from public.entries where user_id = auth.uid())
  );
