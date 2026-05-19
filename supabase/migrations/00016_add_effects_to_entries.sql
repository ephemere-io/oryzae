alter table public.entries
  add column effects jsonb not null default '{}'::jsonb;
