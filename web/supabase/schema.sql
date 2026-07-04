-- TERMINAL X — Supabase schema. Run in Supabase → SQL Editor.
-- Single-user, but rows are still scoped per auth.uid() via RLS.

-- 1) Per-user app state blob (portfolio, alerts, watchlist, settings, news, calendar)
create table if not exists public.app_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_state enable row level security;
drop policy if exists "own app_state" on public.app_state;
create policy "own app_state" on public.app_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) Saved research cards
create table if not exists public.research_cards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  ticker     text not null,
  report     jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists research_cards_user_idx on public.research_cards(user_id, created_at desc);
alter table public.research_cards enable row level security;
drop policy if exists "own research_cards" on public.research_cards;
create policy "own research_cards" on public.research_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) Shared quote/fundamentals cache (accessed only by the server via the service role).
--    RLS is ON with no policies, so the anon/auth clients cannot read it; the
--    service-role key used in API routes bypasses RLS.
create table if not exists public.quote_cache (
  symbol     text not null,
  kind       text not null,             -- 'quote' | 'profile' | 'fundamentals'
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (symbol, kind)
);
alter table public.quote_cache enable row level security;

-- 4) Telegram notification links — maps each user to their Telegram chat.
--    Written by the bot webhook (service role) when a user messages the bot
--    their account email; read by the alert cron. Kept out of app_state so a
--    client state-save can never overwrite it.
create table if not exists public.telegram_links (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  chat_id    text not null,
  email      text,
  linked_at  timestamptz not null default now()
);
alter table public.telegram_links enable row level security;
drop policy if exists "own telegram_link" on public.telegram_links;
create policy "own telegram_link" on public.telegram_links
  for select using (auth.uid() = user_id);
-- writes happen only via the service role (webhook), which bypasses RLS.

-- 5) Login attempt log — backs the "3 sign-in attempts per hour" rate limit.
--    Written/read only by the server (service role); RLS on with no policies.
create table if not exists public.login_attempts (
  id         bigint generated always as identity primary key,
  ident      text not null,             -- lowercased email or client IP
  at         timestamptz not null default now()
);
create index if not exists login_attempts_ident_at_idx on public.login_attempts(ident, at desc);
alter table public.login_attempts enable row level security;

-- NOTE: create users in Supabase → Authentication → Users (Add user, email +
-- password). You control who gets an account — there is no public sign-up.
