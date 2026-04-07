-- Fermentation results
create table fermentation_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  entry_id uuid not null references entries(id) on delete cascade,
  target_period text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz not null default now()
);

alter table fermentation_results enable row level security;
create policy "Users can manage own fermentation results" on fermentation_results
  for all using (user_id = auth.uid());

-- Analysis worksheets
create table analysis_worksheets (
  id uuid primary key default gen_random_uuid(),
  fermentation_result_id uuid not null references fermentation_results(id) on delete cascade,
  worksheet_markdown text not null,
  result_diagram_markdown text not null,
  created_at timestamptz not null default now()
);

alter table analysis_worksheets enable row level security;
create policy "Users can read own worksheets" on analysis_worksheets
  for all using (
    fermentation_result_id in (
      select id from fermentation_results where user_id = auth.uid()
    )
  );

-- Extracted snippets
create table extracted_snippets (
  id uuid primary key default gen_random_uuid(),
  fermentation_result_id uuid not null references fermentation_results(id) on delete cascade,
  snippet_type text not null check (snippet_type in ('new_perspective', 'deepen', 'core')),
  original_text text not null,
  source_date text not null,
  selection_reason text not null
);

alter table extracted_snippets enable row level security;
create policy "Users can read own snippets" on extracted_snippets
  for all using (
    fermentation_result_id in (
      select id from fermentation_results where user_id = auth.uid()
    )
  );

-- Letters
create table letters (
  id uuid primary key default gen_random_uuid(),
  fermentation_result_id uuid not null references fermentation_results(id) on delete cascade,
  body_text text not null
);

alter table letters enable row level security;
create policy "Users can read own letters" on letters
  for all using (
    fermentation_result_id in (
      select id from fermentation_results where user_id = auth.uid()
    )
  );

-- Keywords
create table keywords (
  id uuid primary key default gen_random_uuid(),
  fermentation_result_id uuid not null references fermentation_results(id) on delete cascade,
  keyword text not null,
  description text not null
);

alter table keywords enable row level security;
create policy "Users can read own keywords" on keywords
  for all using (
    fermentation_result_id in (
      select id from fermentation_results where user_id = auth.uid()
    )
  );
