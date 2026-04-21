-- ============================================================
-- Abingh Client Portal — Database Schema
-- Run this entire file in Supabase → SQL Editor → New query
-- ============================================================

-- Clients table
create table public.clients (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  company_name    text not null,
  contact_first   text not null default '',
  contact_last    text not null default '',
  email           text not null default '',
  sector          text not null default '',
  -- Services
  bookkeeping_freq  text not null default 'none'
    check (bookkeeping_freq in ('monthly', 'quarterly', 'none')),
  esl_freq          text not null default 'none'
    check (esl_freq in ('monthly', 'quarterly', 'none')),
  has_vat           boolean not null default false,
  has_cit           boolean not null default false,
  has_annual_accounts boolean not null default false,
  email_cadence     text not null default 'monthly'
    check (email_cadence in ('monthly', 'quarterly')),
  notes           text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Tasks table
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  client_id     uuid references public.clients(id) on delete cascade not null,
  task_type     text not null
    check (task_type in ('bookkeeping', 'esl', 'vat', 'cit', 'annual_accounts')),
  period_label  text not null,   -- e.g. "March 2026", "Q1 2026", "2025"
  deadline      date not null,
  status        text not null default 'pending'
    check (status in ('pending', 'info_requested', 'in_progress', 'done')),
  assigned_to   text not null default '',
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Email templates table
create table public.email_templates (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid references auth.users(id) on delete cascade not null,
  name      text not null,
  cadence   text not null check (cadence in ('monthly', 'quarterly')),
  subject   text not null default '',
  body      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.clients         enable row level security;
alter table public.tasks           enable row level security;
alter table public.email_templates enable row level security;

-- Each user can only see and modify their own data
create policy "clients: owner full access"
  on public.clients for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tasks: owner full access"
  on public.tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "email_templates: owner full access"
  on public.email_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Auto-update updated_at ────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger email_templates_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

-- ── Default email templates (inserted when user first signs up via trigger) ───
-- These are seeded via the application on first login instead.
