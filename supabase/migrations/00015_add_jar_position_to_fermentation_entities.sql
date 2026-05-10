-- Issue #231: persist drag-and-drop positions for the Jar view.
-- Each percentage is relative to its parent container:
--   - questions.jar_x/jar_y → relative to JarView viewport
--   - keywords/extracted_snippets/letters .jar_x/jar_y → relative to the 280px QuestionCircle
-- NULL means "use the hardcoded fallback position" — that's how brand-new and pre-migration
-- rows behave, so existing data needs no backfill.

alter table public.questions
  add column jar_x double precision,
  add column jar_y double precision;

alter table public.keywords
  add column jar_x double precision,
  add column jar_y double precision;

alter table public.extracted_snippets
  add column jar_x double precision,
  add column jar_y double precision;

alter table public.letters
  add column jar_x double precision,
  add column jar_y double precision;
