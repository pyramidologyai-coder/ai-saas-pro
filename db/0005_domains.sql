-- ============================================================================
-- 0005_domains.sql — domain whitelist
-- Run AFTER 0001-0004.
--
-- WHY: without this, anyone who finds a tenant's widget URL can chat with
-- their agent and spend their wallet. The widget runs in a browser, so the
-- only thing we can trust is the Origin header the browser sets itself.
--
-- WHAT IT DOES: a tenant lists the domains their widget may be embedded on.
-- The chat API checks the request's Origin against that list before spending
-- a cent. Not on the list, no answer.
-- ============================================================================

create table if not exists tenant_domains (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,

  domain        text not null,          -- 'sunrisehair.com' — host only, no https://, no path
  status        text not null default 'active',   -- active | paused
  is_primary    boolean not null default false,   -- the one shown in the dashboard

  -- Simple self-serve verification. The customer adds a TXT record OR uploads
  -- a file containing this token, then clicks Verify. Not enforced for MVP —
  -- you'll add domains manually — but the column exists so the flow can be
  -- turned on without another migration.
  verify_token  text not null default encode(gen_random_bytes(16), 'hex'),
  verified_at   timestamptz,

  created_at    timestamptz not null default now(),

  constraint tenant_domains_status_chk check (status in ('active','paused')),
  -- one row per domain globally: two businesses cannot claim the same site
  constraint tenant_domains_domain_uniq unique (domain)
);

comment on table tenant_domains is
  'Domains allowed to embed a tenant''s chat widget. Checked against the request Origin.';

create index if not exists tenant_domains_tenant_idx
  on tenant_domains(tenant_id) where status = 'active';

-- ----------------------------------------------------------------------------
-- RLS: same rule as every other table — you see only your own rows.
-- ----------------------------------------------------------------------------
alter table tenant_domains enable row level security;

drop policy if exists tenant_domains_own on tenant_domains;
create policy tenant_domains_own on tenant_domains
  for all
  using (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

-- ----------------------------------------------------------------------------
-- is_domain_allowed(slug, origin) → boolean
--
-- The chat route calls this at step 3, before any spending.
-- Normalises the Origin header: strips scheme, port, www., lowercases.
--
-- localhost and *.vercel.app are allowed ONLY while a tenant is in demo mode
-- (tenants.status = 'trial'), so your own testing works without opening a hole
-- for live customers.
-- ----------------------------------------------------------------------------
create or replace function is_domain_allowed(p_slug text, p_origin text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant_id     uuid;
  v_tenant_status text;
  v_host          text;
begin
  select id, status into v_tenant_id, v_tenant_status
  from tenants where slug = p_slug;

  if v_tenant_id is null then
    return false;                         -- unknown tenant
  end if;

  -- No Origin at all (curl, server-to-server, your own tests).
  -- Allowed only for trial tenants.
  if p_origin is null or length(trim(p_origin)) = 0 then
    return v_tenant_status = 'trial';
  end if;

  -- normalise: https://WWW.Site.com:443/path  ->  site.com
  v_host := lower(p_origin);
  v_host := regexp_replace(v_host, '^https?://', '');
  v_host := split_part(v_host, '/', 1);
  v_host := split_part(v_host, ':', 1);
  v_host := regexp_replace(v_host, '^www\.', '');

  -- development hosts: trial tenants only
  if v_tenant_status = 'trial'
     and (v_host = 'localhost'
          or v_host like '%.vercel.app'
          or v_host = '127.0.0.1') then
    return true;
  end if;

  -- the actual whitelist check
  return exists (
    select 1 from tenant_domains d
    where d.tenant_id = v_tenant_id
      and d.status = 'active'
      and (d.domain = v_host                      -- exact match
           or v_host like '%.' || d.domain)       -- subdomain: booking.site.com
  );
end;
$$;

revoke execute on function is_domain_allowed(text, text) from public, anon, authenticated;
grant  execute on function is_domain_allowed(text, text) to service_role;

-- ----------------------------------------------------------------------------
-- add_tenant_domain(slug, domain) — the onboarding helper.
-- Cleans the input so 'https://WWW.Site.com/' and 'site.com' both work.
-- ----------------------------------------------------------------------------
create or replace function add_tenant_domain(p_slug text, p_domain text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_clean     text;
  v_id        uuid;
begin
  select id into v_tenant_id from tenants where slug = p_slug;
  if v_tenant_id is null then
    raise exception 'add_tenant_domain: no tenant with slug %', p_slug;
  end if;

  v_clean := lower(trim(p_domain));
  v_clean := regexp_replace(v_clean, '^https?://', '');
  v_clean := split_part(v_clean, '/', 1);
  v_clean := split_part(v_clean, ':', 1);
  v_clean := regexp_replace(v_clean, '^www\.', '');

  if v_clean = '' or v_clean not like '%.%' then
    raise exception 'add_tenant_domain: % is not a valid domain', p_domain;
  end if;

  insert into tenant_domains (tenant_id, domain)
  values (v_tenant_id, v_clean)
  on conflict (domain) do nothing
  returning id into v_id;

  if v_id is null then
    raise exception 'add_tenant_domain: % is already claimed', v_clean;
  end if;

  return v_id;
end;
$$;

revoke execute on function add_tenant_domain(text, text) from public, anon, authenticated;
grant  execute on function add_tenant_domain(text, text) to service_role;

-- ----------------------------------------------------------------------------
-- Mark the seed tenant as trial so localhost/vercel testing works.
-- Real customers become 'active' and must whitelist a real domain.
-- ----------------------------------------------------------------------------
update tenants set status = 'trial' where slug = 'sunrise-hair';

-- ============================================================================
-- HOW TO ONBOARD A CUSTOMER (the whole flow, 3 lines)
--
--   1. create the tenant + agent  (0002_seed.sql is the template)
--   2. select add_tenant_domain('their-slug', 'theirsite.com');
--   3. give them the embed snippet with their slug in it
--
-- CHECK IT WORKS:
--   select is_domain_allowed('sunrise-hair', 'https://sunrisehair.com');  -- expect true once added
--   select is_domain_allowed('sunrise-hair', 'https://attacker.com');     -- expect false
-- ============================================================================
