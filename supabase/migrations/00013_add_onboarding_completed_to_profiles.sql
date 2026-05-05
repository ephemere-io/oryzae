-- Track whether a user has completed the first-run onboarding flow.
alter table public.profiles
  add column onboarding_completed boolean not null default false;

-- Existing users predate the onboarding flow, so mark them as completed.
update public.profiles set onboarding_completed = true;
