-- Questions: ユーザーの「問い」の親レコード
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  is_archived boolean not null default false,
  is_validated_by_user boolean not null default true,
  is_proposed_by_oryzae boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- QuestionTransactions: 問いの文面の版管理（append-only）
create table public.question_transactions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  string text not null,
  question_version integer not null,
  is_validated_by_user boolean not null default true,
  is_proposed_by_oryzae boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, question_version),
  constraint chk_string_length check (char_length(string) <= 64)
);

-- EntryQuestionLinks: Entry と Question の N:M 紐付け
create table public.entry_question_links (
  entry_id uuid not null references public.entries(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  primary key (entry_id, question_id)
);

-- Indexes
create index idx_questions_user_active
  on questions(user_id)
  where is_archived = false and is_validated_by_user = true;

create index idx_questions_user_all
  on questions(user_id, created_at desc);

create index idx_question_transactions_question
  on question_transactions(question_id, question_version desc);

create index idx_entry_question_links_entry
  on entry_question_links(entry_id);

create index idx_entry_question_links_question
  on entry_question_links(question_id);

-- RLS
alter table public.questions enable row level security;
alter table public.question_transactions enable row level security;
alter table public.entry_question_links enable row level security;

create policy "questions_own_data" on public.questions
  for all using (user_id = auth.uid());

create policy "question_transactions_own_data" on public.question_transactions
  for all using (
    question_id in (select id from public.questions where user_id = auth.uid())
  );

create policy "entry_question_links_own_data" on public.entry_question_links
  for all using (
    entry_id in (select id from public.entries where user_id = auth.uid())
  );
