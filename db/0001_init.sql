-- ============================================================================
-- Automology MVP — migration 0001
-- 11 tables of the 115-table design. Column names kept faithful to
-- Automology-Global-Schema-v1.0 so the full schema can be layered on later
-- without renaming anything.
--
-- Scope: one agent (AI Receptionist), one vertical, one channel (webchat).
-- Deferred: agencies, branches, plans, billing, voice_numbers, follow_ups,
--           channel_verifications, rate_limits, RAG/embeddings, KPIs.
--
-- Run: Supabase Dashboard → SQL Editor → paste → Run
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ============================================================================
-- 1. TENANTS — the businesses using the platform
-- ============================================================================
create table if not exists tenants (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null unique,
  email               text not null,
  phone               text,
  country_code        char(2) not null default 'MY',
  vertical            text not null,                 -- salon | clinic | restaurant | gym | ...
  status              text not null default 'trial', -- trial | active | suspended | churned
  timezone            text not null default 'Asia/Kuala_Lumpur',
  default_language    varchar(10) not null default 'en',
  wallet_balance_usd  numeric(12,4) not null default 0,
  out_of_hours_mode   text not null default 'full_service',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint tenants_status_chk
    check (status in ('trial','active','suspended','churned'))
);

-- ============================================================================
-- 2. PROFILES — humans who log in (owner, staff). Extends auth.users.
-- ============================================================================
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid references tenants(id) on delete cascade,
  full_name   text,
  email       text not null,
  role        text not null default 'staff',   -- owner | staff | platform_admin
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint profiles_role_chk
    check (role in ('owner','staff','platform_admin'))
);
create index if not exists profiles_tenant_idx on profiles(tenant_id);

-- ============================================================================
-- 3. AI_EMPLOYEES — one configured agent instance per tenant
--    The compiled prompt is cached here, not rebuilt per message.
-- ============================================================================
create table if not exists ai_employees (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  agent_id            text not null default 'AGENT-001',   -- base role spec
  sector_id           text not null,                       -- sector patch
  persona_name        text not null,                       -- "Mia"
  role_name           text not null default 'AI Receptionist',
  status              text not null default 'active',      -- active | paused
  language_default    varchar(10) not null default 'en',
  tone                text,
  knowledge_summary   text,
  config              jsonb not null default '{}'::jsonb,  -- tenant layer: hours, services, links
  compiled_prompt     text,                                -- output of compile.py
  compiled_tokens     int,
  compiled_at         timestamptz,
  config_version      int not null default 1,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint ai_employees_status_chk check (status in ('active','paused'))
);
create index if not exists ai_employees_tenant_idx on ai_employees(tenant_id);

-- ============================================================================
-- 4. ITEMS — services and prices. The AI answers "what do you offer" from here.
-- ============================================================================
create table if not exists items (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  name              text not null,
  description       text,
  price_local       numeric(12,2),
  currency_code     char(3) not null default 'MYR',
  duration_minutes  int,
  is_bookable       boolean not null default true,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);
create index if not exists items_tenant_idx on items(tenant_id) where is_active;

-- ============================================================================
-- 5. CUSTOMERS — the tenant's end customers
-- ============================================================================
create table if not exists customers (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  external_id       text,                       -- webchat session / phone / handle
  name              text,
  phone             text,
  email             text,
  language_code     varchar(10),
  opted_out         boolean not null default false,   -- hard block, never messaged
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (tenant_id, external_id)
);
create index if not exists customers_tenant_idx on customers(tenant_id);

-- ============================================================================
-- 6. CONVERSATIONS
-- ============================================================================
create table if not exists conversations (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  ai_employee_id      uuid not null references ai_employees(id),
  customer_id         uuid not null references customers(id) on delete cascade,
  channel             text not null default 'webchat',
  status              text not null default 'open',   -- open | escalated | resolved | closed
  subject             text,
  language_code       varchar(10),
  assigned_to         uuid references profiles(id),
  escalated_at        timestamptz,
  escalation_reason   text,
  resolved_at         timestamptz,
  first_message_at    timestamptz,
  last_message_at     timestamptz,
  message_count       int not null default 0,
  ai_message_count    int not null default 0,
  human_message_count int not null default 0,
  tokens_used         bigint not null default 0,
  ai_cost_usd         numeric(10,6) not null default 0,
  csat_score          int,
  tags                text[] not null default '{}',
  created_at          timestamptz not null default now(),
  constraint conversations_status_chk
    check (status in ('open','escalated','resolved','closed')),
  constraint conversations_csat_chk
    check (csat_score is null or csat_score between 1 and 5)
);
create index if not exists conversations_tenant_idx on conversations(tenant_id, created_at desc);
create index if not exists conversations_open_idx
  on conversations(tenant_id) where status in ('open','escalated');

-- ============================================================================
-- 7. MESSAGES
-- ============================================================================
create table if not exists messages (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  conversation_id   uuid not null references conversations(id) on delete cascade,
  sender_type       text not null,        -- customer | ai | human
  sender_profile_id uuid references profiles(id),
  body              text not null,
  idempotency_key   text,                 -- pipeline step 0: dedupe inbound
  created_at        timestamptz not null default now(),
  constraint messages_sender_chk check (sender_type in ('customer','ai','human')),
  unique (tenant_id, idempotency_key)
);
create index if not exists messages_conversation_idx on messages(conversation_id, created_at);

-- ============================================================================
-- 8. BOOKINGS
-- ============================================================================
create table if not exists bookings (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  customer_id         uuid not null references customers(id) on delete cascade,
  conversation_id     uuid references conversations(id) on delete set null,
  item_id             uuid references items(id),
  ai_employee_id      uuid references ai_employees(id),
  status              text not null default 'pending',
  scheduled_at        timestamptz not null,
  duration_minutes    int,
  notes               text,
  cancelled_at        timestamptz,
  cancellation_reason text,
  created_at          timestamptz not null default now(),
  constraint bookings_status_chk
    check (status in ('pending','confirmed','cancelled','completed','no_show'))
);
create index if not exists bookings_tenant_time_idx on bookings(tenant_id, scheduled_at);

-- Optimistic lock: no double-booking the same slot (pipeline step 14 hard block).
-- MVP simplification: one booking per tenant per timestamp. A real salon with
-- several stylists needs (tenant_id, staff_id, scheduled_at) — add staff_id
-- when you add a second resource. Deliberate, not an oversight.
create unique index if not exists bookings_slot_unique
  on bookings(tenant_id, scheduled_at)
  where status in ('pending','confirmed');

-- ============================================================================
-- 9. AI_DECISION_LOG — the three-number cost model, from message one
-- ============================================================================
create table if not exists ai_decision_log (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references tenants(id) on delete cascade,
  conversation_id         uuid not null references conversations(id) on delete cascade,
  ai_employee_id          uuid not null references ai_employees(id),
  decision_type           text not null,   -- response_generated | escalated | booking_created | cache_hit
  model_used              text not null,
  tokens_in               int not null default 0,
  tokens_out              int not null default 0,
  cached_tokens           int not null default 0,
  actual_execution_cost   numeric(10,6) not null default 0,  -- number 1
  allocated_platform_cost numeric(10,6) not null default 0,  -- number 2
  billable_usage_value    numeric(10,6) not null default 0,  -- number 3
  latency_ms              int,
  confidence_score        numeric(3,2),
  tools_called            text[] not null default '{}',
  created_at              timestamptz not null default now()
);
create index if not exists ai_decision_tenant_idx on ai_decision_log(tenant_id, created_at desc);
create index if not exists ai_decision_conv_idx on ai_decision_log(conversation_id);

-- ============================================================================
-- 10. ESCALATIONS — the human inbox. Nothing else catches these.
-- ============================================================================
create table if not exists escalations (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  reason          text not null,
  trigger_source  text,             -- compliance | confidence | customer_request | keyword
  status          text not null default 'open',   -- open | claimed | resolved
  claimed_by      uuid references profiles(id),
  claimed_at      timestamptz,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  constraint escalations_status_chk check (status in ('open','claimed','resolved'))
);
create index if not exists escalations_open_idx
  on escalations(tenant_id, created_at desc) where status = 'open';

-- ============================================================================
-- 11. USAGE_LEDGER — wallet movements. WalletEmpty is a hard block at step 11.
-- ============================================================================
create table if not exists usage_ledger (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  entry_type      text not null,    -- topup | usage | adjustment
  amount_usd      numeric(12,6) not null,   -- positive = credit, negative = debit
  balance_after   numeric(12,4) not null,
  description     text,
  created_at      timestamptz not null default now(),
  constraint usage_ledger_type_chk check (entry_type in ('topup','usage','adjustment'))
);
create index if not exists usage_ledger_tenant_idx on usage_ledger(tenant_id, created_at desc);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Every tenant table. tenant_id is never supplied by the client — it is
-- derived from the caller's profile.
-- ============================================================================

alter table tenants        enable row level security;
alter table profiles       enable row level security;
alter table ai_employees   enable row level security;
alter table items          enable row level security;
alter table customers      enable row level security;
alter table conversations  enable row level security;
alter table messages       enable row level security;
alter table bookings       enable row level security;
alter table ai_decision_log enable row level security;
alter table escalations    enable row level security;
alter table usage_ledger   enable row level security;

-- Helper: the tenant of the currently authenticated user.
create or replace function auth_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from profiles where id = auth.uid()
$$;

drop policy if exists tenant_self on tenants;
create policy tenant_self on tenants
  for select using (id = auth_tenant_id());

-- NOTE: this policy must NOT call auth_tenant_id(), because that function
-- selects from profiles — which would recurse through this very policy.
-- Own row only, matched directly on auth.uid().
drop policy if exists profile_own on profiles;
create policy profile_own on profiles
  for all using (id = auth.uid())
  with check (id = auth.uid());

-- Same shape for every tenant-scoped table.
do $$
declare t text;
begin
  foreach t in array array[
    'ai_employees','items','customers','conversations','messages',
    'bookings','ai_decision_log','escalations','usage_ledger'
  ] loop
    execute format('drop policy if exists %1$s_tenant_isolation on %1$s;', t);
    execute format($f$
      create policy %1$s_tenant_isolation on %1$s
        for all
        using (tenant_id = auth_tenant_id())
        with check (tenant_id = auth_tenant_id());
    $f$, t);
  end loop;
end $$;

-- ============================================================================
-- TRIGGERS — keep conversation counters honest without app-side bookkeeping
-- ============================================================================
create or replace function bump_conversation_counters()
returns trigger
language plpgsql
security definer            -- must bypass RLS to update the parent row
set search_path = public
as $$
begin
  update conversations set
    message_count       = message_count + 1,
    ai_message_count    = ai_message_count    + (new.sender_type = 'ai')::int,
    human_message_count = human_message_count + (new.sender_type = 'human')::int,
    first_message_at    = coalesce(first_message_at, new.created_at),
    last_message_at     = new.created_at
  where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists messages_bump_counters on messages;
create trigger messages_bump_counters
  after insert on messages
  for each row execute function bump_conversation_counters();

-- ============================================================================
-- DONE. Next: run 0002_seed.sql to create the demo tenant.
-- ============================================================================
