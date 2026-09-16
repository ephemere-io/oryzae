-- ニュースレターの翻訳 (issue #614 フォロー)。
--
-- 運営者は日本語で書き、配信時に受信者の言語へ翻訳して送る。日本語は原文
-- そのものなのでここには入れない（`newsletters` が持っている）。
--
-- ## なぜ受信者ごとではなく言語ごとに持つか
--
-- 200 人に送るのに 200 回翻訳する必要はない。言語は 3 つしかないので、
-- 1 配信につき最大 3 行。宛先が増えても翻訳の費用は増えない。
create table newsletter_translations (
  newsletter_id uuid not null references newsletters(id) on delete cascade,
  -- 'ja' は入らない（原文）。CHECK で構造的に弾く。
  locale text not null check (locale in ('en', 'zh', 'ko')),
  subject text not null,
  body_markdown text not null,

  -- **どの原文から訳したか** を丸ごと持つ。
  --
  -- 「翻訳済み」フラグだけだと、原文を書き換えたあとも翻訳済みに見えてしまい、
  -- 日本語だけ直った配信が他言語には古い文面で届く。原文を控えておけば、
  -- 現在の本文と突き合わせるだけで古さが分かる（無効化の書き込みが要らない）。
  source_subject text not null,
  source_body_markdown text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (newsletter_id, locale)
);

alter table newsletter_translations enable row level security;

-- newsletters と同じく運営専用データ。TO を省くと PUBLIC 扱いになるので必ず付ける。
create policy "newsletter_translations_service_role_all" on newsletter_translations
  for all to service_role using (true) with check (true);

create trigger trg_newsletter_translations_updated_at
  before update on newsletter_translations
  for each row execute function update_updated_at_column();
