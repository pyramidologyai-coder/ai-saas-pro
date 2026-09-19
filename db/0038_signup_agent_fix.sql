-- ============================================================================
-- 0038_signup_agent_fix.sql — give the agent that signup creates a slug.
-- Run AFTER 0037. Safe to re-run.
--
-- WHY
-- 0017 added slug, audience, department and is_primary to ai_employees, and
-- taught add_agent() to fill them. 0024 rewrote create_tenant() afterwards, to
-- drop the pgcrypto dependency, and carried the old column list across. So
-- every business created through /start since then has had an agent with a null
-- slug and is_primary false.
--
-- The public page addresses an agent by slug. With no slug there is nothing to
-- address, so the page renders the header and the price list and simply leaves
-- the chat out — no hero input, no chips, no button. Nothing errors. The
-- business looks finished and cannot answer anybody.
--
-- Found on the live deployment: pyramidology, the one tenant here created by a
-- real signup rather than a seed file, had exactly this. The two seeded tenants
-- were fine, which is why nothing caught it — the seeds set the columns by hand
-- and never went through create_tenant.
--
-- This is the failure mode the project has been bitten by twice already: a
-- check that fails quietly looks like a feature that was never built.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · create_tenant, with the four columns 0024 dropped
--
-- Taken from the live definition so nothing else drifts. The only change is the
-- ai_employees insert.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function create_tenant(p_payload json)
returns json
language plpgsql
security definer
set search_path = public
as $function$
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
  v_persona  text; v_agent_slug text;
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

  -- The agent's own name, and a slug made from it. slugify can return an empty
  -- string for a name with no latin characters, so it needs a fallback of its
  -- own — a null here is what caused this bug in the first place.
  v_persona    := coalesce(v_agent, v_tpl.agent_default);
  v_agent_slug := coalesce(nullif(slugify(v_persona), ''), 'agent');

  insert into ai_employees (
    tenant_id, agent_id, sector_id, persona_name, role_name,
    language_default, status, slug, audience, department, is_primary,
    prompt_template
  ) values (
    v_tenant, 'AGENT-001', v_sector,
    v_persona, 'AI Receptionist',
    'en', 'active', v_agent_slug, 'public', 'Front desk', true,
    replace(replace(replace(replace(replace(
      v_tpl.prompt_template,
      '{{AGENT}}',    v_persona),
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
    'agent', v_persona, 'sector', v_sector
  );
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · Repair the businesses already created this way
--
-- Only a public, active agent whose tenant has no primary yet. An internal
-- agent with is_primary false is correct and must not be touched — the owner
-- assistant is deliberately neither public nor primary.
-- ─────────────────────────────────────────────────────────────────────────────
update ai_employees e
   set slug       = coalesce(nullif(slugify(e.persona_name), ''), 'agent'),
       department = coalesce(e.department, 'Front desk'),
       is_primary = true
 where e.slug is null
   and e.audience = 'public'
   and e.status = 'active'
   and not exists (
     select 1 from ai_employees o
      where o.tenant_id = e.tenant_id and o.is_primary and o.id <> e.id
   );

-- Any remaining slugless agent has a primary sibling, so it only needs a slug.
update ai_employees e
   set slug = coalesce(nullif(slugify(e.persona_name), ''), 'agent')
 where e.slug is null;

-- ============================================================================
-- CHECK
--   select public_agents('<the slug of a business made through /start>');
--   → slug must not be null, is_primary must be true
--
--   Then load /demo/<slug> and confirm the chat is actually there: the hero
--   input, the suggestion chips, and the button bottom right. A page with a
--   header and a price list and no chat is the symptom this file exists for.
--
--   Every public agent should now be addressable:
--     select t.slug, e.persona_name, e.slug, e.is_primary
--       from ai_employees e join tenants t on t.id = e.tenant_id
--      where e.audience = 'public' and e.status = 'active';
-- ============================================================================
