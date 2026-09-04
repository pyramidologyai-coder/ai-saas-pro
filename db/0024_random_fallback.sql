-- ============================================================================
-- 0024_random_fallback.sql
-- ONLY NEEDED IF `create extension if not exists pgcrypto;` FAILED.
-- Run AFTER 0023. Safe to re-run.
--
-- I used gen_random_bytes() to make access codes without checking it exists.
-- It lives in pgcrypto, which isn't enabled on every Postgres. This replaces
-- every use with a generator that needs no extension at all.
--
-- If pgcrypto DID enable, you don't need this file. It does no harm either way.
-- ============================================================================

-- The tenant_domains table has a DEFAULT that calls gen_random_bytes, so every
-- insert into it fails even when the insert itself is fine. Drop that default
-- before anything else touches the table.
alter table tenant_domains
  alter column verify_token set default md5(random()::text || clock_timestamp()::text);

-- Readable random codes. No 0/O/1/I/L, because these get read aloud, written
-- on paper, and typed by someone who isn't looking carefully.
create or replace function random_code(p_len int default 6)
returns text
language plpgsql
volatile
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  out_text text := '';
  i int;
begin
  for i in 1..greatest(p_len, 1) loop
    out_text := out_text || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return out_text;
end;
$$;

-- ── create_tenant ───────────────────────────────────────────────────────────
create or replace function create_tenant(p_payload json)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name     text := trim(p_payload->>'name');
  v_sector   text := coalesce(p_payload->>'sector', 'general');
  v_email    text := nullif(trim(p_payload->>'email'), '');
  v_phone    text := nullif(trim(p_payload->>'phone'), '');
  v_address  text := nullif(trim(p_payload->>'address'), '');
  v_tagline  text := nullif(trim(p_payload->>'tagline'), '');
  v_color    text := coalesce(nullif(p_payload->>'color',''), '#1D6A8C');
  v_agent    text := nullif(trim(p_payload->>'agent'), '');
  v_hours    jsonb := nullif(p_payload->>'hours','')::jsonb;
  v_services json := p_payload->'services';
  v_tpl      sector_templates%rowtype;
  v_slug     text; v_base text; v_n int := 1;
  v_tenant   uuid; v_agent_id uuid; v_code text; v_svc json;
begin
  if v_name is null or length(v_name) < 2 then
    return json_build_object('ok', false, 'reason', 'name_required');
  end if;

  select * into v_tpl from sector_templates where sector_id = v_sector;
  if not found then
    select * into v_tpl from sector_templates where sector_id = 'general';
    v_sector := 'general';
  end if;
  if not found then
    return json_build_object('ok', false, 'reason', 'no_sector_templates');
  end if;

  v_base := slugify(v_name);
  if v_base = '' then v_base := 'business'; end if;
  v_slug := v_base;
  while exists (select 1 from tenants where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  -- unique, readable, no extension needed
  loop
    v_code := upper(v_base) || '-' || random_code(6);
    exit when not exists (select 1 from tenants where access_code = v_code);
  end loop;

  insert into tenants (
    name, slug, email, phone, country_code, vertical, status, timezone,
    default_language, wallet_balance_usd, brand_color, brand_subtitle,
    brand_greeting, brand_suggestions, opening_hours, address, tagline, access_code
  ) values (
    v_name, v_slug, coalesce(v_email, 'owner@' || v_slug || '.local'), v_phone,
    'MY', v_sector, 'trial', 'Asia/Kuala_Lumpur', 'en', 2.0000,
    v_color, v_name || ' · replies instantly',
    v_tpl.greeting, v_tpl.suggestions,
    coalesce(v_hours, v_tpl.hours_default), v_address, v_tagline, v_code
  ) returning id into v_tenant;

  insert into ai_employees (
    tenant_id, agent_id, sector_id, persona_name, role_name,
    language_default, status, prompt_template
  ) values (
    v_tenant, 'AGENT-001', v_sector,
    coalesce(v_agent, v_tpl.agent_default), 'AI Receptionist',
    'en', 'active',
    replace(replace(replace(replace(replace(
      v_tpl.prompt_template,
      '{{AGENT}}',    coalesce(v_agent, v_tpl.agent_default)),
      '{{BUSINESS}}', v_name),
      '{{HOURS}}',    hours_sentence(coalesce(v_hours, v_tpl.hours_default))),
      '{{PHONE}}',    coalesce(v_phone, 'not listed')),
      '{{TZ}}',       'Asia/Kuala_Lumpur')
  ) returning id into v_agent_id;

  if v_services is not null and json_typeof(v_services) = 'array' then
    for v_svc in select * from json_array_elements(v_services) loop
      if nullif(trim(v_svc->>'name'), '') is not null then
        insert into items (tenant_id, name, description, price_local,
                           currency_code, duration_minutes, is_bookable)
        values (v_tenant, trim(v_svc->>'name'),
                nullif(trim(coalesce(v_svc->>'description','')), ''),
                nullif(v_svc->>'price','')::numeric,
                coalesce(nullif(v_svc->>'currency',''), 'MYR'),
                nullif(v_svc->>'minutes','')::int,
                true);
      end if;
    end loop;
  end if;

  -- Trial businesses may embed from anywhere while they're testing.
  insert into tenant_domains (tenant_id, domain, status)
  values (v_tenant, 'localhost', 'active'), (v_tenant, '*.vercel.app', 'active')
  on conflict (domain) do nothing;

  perform rebuild_prompt(v_slug);

  return json_build_object(
    'ok', true, 'slug', v_slug, 'access_code', v_code,
    'agent', coalesce(v_agent, v_tpl.agent_default), 'sector', v_sector
  );
end;
$$;

-- ── add_staff ───────────────────────────────────────────────────────────────
create or replace function add_staff(p_tenant_slug text, p_payload json)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid; v_code text; v_role text := coalesce(p_payload->>'role','staff');
  v_name text := nullif(trim(p_payload->>'name'),''); v_prefix text;
begin
  if v_name is null then return json_build_object('ok',false,'reason','name_required'); end if;
  if v_role not in ('owner','manager','staff','viewer') then
    return json_build_object('ok',false,'reason','bad_role');
  end if;

  select id into v_tenant from tenants where slug = p_tenant_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  v_prefix := upper(substr(regexp_replace(v_name,'[^a-zA-Z]','','g'),1,4));
  if v_prefix = '' then v_prefix := 'USER'; end if;

  loop
    v_code := v_prefix || '-' || random_code(5);
    exit when not exists (select 1 from staff where access_code = v_code);
  end loop;

  insert into staff (tenant_id, name, email, role, access_code)
  values (v_tenant, v_name, nullif(trim(p_payload->>'email'),''), v_role, v_code);

  return json_build_object('ok',true,'access_code',v_code,'role',v_role);
end; $$;

-- ── create_organisation ─────────────────────────────────────────────────────
create or replace function create_organisation(p_payload json)
returns json language plpgsql security definer set search_path = public as $$
declare v_name text := trim(p_payload->>'name'); v_slug text; v_base text;
        v_n int := 1; v_id uuid; v_code text;
begin
  if v_name is null or length(v_name) < 2 then
    return json_build_object('ok', false, 'reason', 'name_required');
  end if;

  v_base := slugify(v_name); if v_base = '' then v_base := 'group'; end if;
  v_slug := v_base;
  while exists (select 1 from organisations where slug = v_slug) loop
    v_n := v_n + 1; v_slug := v_base || '-' || v_n;
  end loop;

  loop
    v_code := upper(v_base) || '-GRP-' || random_code(5);
    exit when not exists (select 1 from organisations where access_code = v_code);
  end loop;

  insert into organisations (name, slug, owner_email, access_code)
  values (v_name, v_slug, nullif(trim(p_payload->>'email'),''), v_code)
  returning id into v_id;

  insert into staff (organisation_id, name, role, access_code)
  values (v_id, 'Group owner', 'owner', v_code || 'O');

  return json_build_object('ok', true, 'id', v_id, 'slug', v_slug, 'access_code', v_code);
end; $$;

-- ── claim_domain ────────────────────────────────────────────────────────────
create or replace function claim_domain(p_slug text, p_role text, p_hostname text)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_host text; v_token text; v_id uuid;
begin
  if not guard(p_role, 'settings') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;

  v_host := lower(trim(coalesce(p_hostname, '')));
  v_host := regexp_replace(v_host, '^https?://', '');
  v_host := split_part(v_host, '/', 1);
  v_host := rtrim(v_host, '.');

  if v_host !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then
    return json_build_object('ok', false, 'reason', 'bad_hostname');
  end if;
  if v_host like '%.vercel.app' then
    return json_build_object('ok', false, 'reason', 'reserved_hostname');
  end if;

  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  if exists (select 1 from domains d
              where lower(d.hostname) = v_host and d.tenant_id <> v_tenant
                and d.status <> 'removed') then
    return json_build_object('ok', false, 'reason', 'taken');
  end if;

  v_token := 'automology-verify=' || lower(random_code(16));

  insert into domains (tenant_id, hostname, verify_token)
  values (v_tenant, v_host, v_token)
  on conflict (hostname) do update
    set status = 'pending', verify_token = excluded.verify_token
  returning id into v_id;

  update tenants set custom_domain = v_host where id = v_tenant;

  return json_build_object('ok', true, 'hostname', v_host, 'token', v_token,
    'cname', 'cname.vercel-dns.com');
end; $$;

-- ── the session token in 0005 also used it ──────────────────────────────────
create or replace function new_session_token()
returns text language sql volatile as $$
  select lower(random_code(24));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Prove it works before you leave this file.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare v json;
begin
  v := create_tenant(('{"name":"Migration Self Test ' ||
        floor(random()*100000)::text || '","sector":"clinic"}')::json);
  if not (v->>'ok')::boolean then
    raise exception 'create_tenant still failing: %', v::text;
  end if;
  -- clean up after ourselves
  delete from tenants where slug = v->>'slug';
  raise notice 'create_tenant works. Access codes look like: %', v->>'access_code';
end $$;

-- ============================================================================
-- CHECK
--   select random_code(6);            → six readable characters
--   select create_tenant('{"name":"Test Clinic","sector":"clinic",
--          "services":[{"name":"Consultation","price":"50"}]}'::json);
--     → ok:true with a slug and an access code
--   select name, slug, access_code from tenants order by created_at desc limit 3;
-- ============================================================================
