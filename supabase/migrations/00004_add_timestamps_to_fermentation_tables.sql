-- Add updated_at to fermentation_results (already has created_at)
alter table fermentation_results
  add column updated_at timestamptz not null default now();

-- Add updated_at to analysis_worksheets (already has created_at)
alter table analysis_worksheets
  add column updated_at timestamptz not null default now();

-- Add created_at and updated_at to extracted_snippets
alter table extracted_snippets
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

-- Add created_at and updated_at to letters
alter table letters
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

-- Add created_at and updated_at to keywords
alter table keywords
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

-- Auto-update updated_at on row modification
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_fermentation_results_updated_at
  before update on fermentation_results
  for each row execute function update_updated_at_column();

create trigger trg_analysis_worksheets_updated_at
  before update on analysis_worksheets
  for each row execute function update_updated_at_column();

create trigger trg_extracted_snippets_updated_at
  before update on extracted_snippets
  for each row execute function update_updated_at_column();

create trigger trg_letters_updated_at
  before update on letters
  for each row execute function update_updated_at_column();

create trigger trg_keywords_updated_at
  before update on keywords
  for each row execute function update_updated_at_column();
