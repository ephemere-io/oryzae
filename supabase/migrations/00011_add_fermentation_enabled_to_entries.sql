alter table public.entries
  add column fermentation_enabled boolean not null default false;

update public.entries set fermentation_enabled = true;
