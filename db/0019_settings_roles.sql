-- ============================================================================
-- 0019_settings_roles.sql — make it editable, and make roles real.
-- Run AFTER 0018. Safe to re-run.
--
-- Three gaps closed:
--   1. The owner can edit their own page — name, brand, greeting, hours.
--   2. Services can be added and removed, not just repriced.
--   3. Roles are enforced in the database, not just drawn in the UI.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · WHO IS ASKING
--
-- A key belongs either to a business (the owner key) or to one member of
-- staff. This resolves either into a tenant and a role, so every action can be
-- checked against what that role is allowed to do.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function resolve_key(p_code text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_code text := upper(trim(coalesce(p_code, ''))); v_row record;
begin
  if v_code = '' then return json_build_object('ok', false); end if;

  -- a staff key
  select s.id, s.name, s.role, s.status, t.slug, t.name as business
    into v_row
  from staff s join tenants t on t.id = s.tenant_id
  where upper(s.access_code) = v_code limit 1;

  if found then
    if v_row.status <> 'active' then
      return json_build_object('ok', false, 'reason', 'suspended');
    end if;
    return json_build_object('ok', true, 'slug', v_row.slug, 'role', v_row.role,
                             'name', v_row.name, 'business', v_row.business,
                             'staff_id', v_row.id);
  end if;

  -- the business owner key
  select t.slug, t.name into v_row from tenants t
  where upper(t.access_code) = v_code limit 1;

  if found then
    return json_build_object('ok', true, 'slug', v_row.slug, 'role', 'owner',
                             'name', 'Owner', 'business', v_row.name);
  end if;

  return json_build_object('ok', false);
end;
$$;

-- Can this role do this? One source of truth, used by every write below.
create or replace function guard(p_role text, p_action text)
returns boolean language sql stable as $$
  select role_can(coalesce(p_role, 'viewer'), p_action);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · EDIT YOUR OWN PAGE
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function update_branding(p_slug text, p_role text, p_payload json)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_tenant uuid; v_agent uuid;
begin
  if not guard(p_role, 'settings') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;

  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok', false, 'reason', 'unknown_tenant'); end if;

  update tenants set
    name           = coalesce(nullif(trim(p_payload->>'name'), ''), name),
    brand_color    = coalesce(nullif(trim(p_payload->>'color'), ''), brand_color),
    tagline        = coalesce(nullif(trim(p_payload->>'tagline'), ''), tagline),
    address        = coalesce(nullif(trim(p_payload->>'address'), ''), address),
    phone          = coalesce(nullif(trim(p_payload->>'phone'), ''), phone),
    map_url        = coalesce(nullif(trim(p_payload->>'map_url'), ''), map_url),
    brand_greeting = coalesce(nullif(trim(p_payload->>'greeting'), ''), brand_greeting),
    logo_url       = coalesce(nullif(trim(p_payload->>'logo_url'), ''), logo_url),
    brand_suggestions = coalesce(
      (select array_agg(value::text)
         from json_array_elements_text(p_payload->'suggestions')
        where trim(value::text) <> ''),
      brand_suggestions)
  where id = v_tenant;

  -- the agent's name lives on the agent, not the tenant
  if nullif(trim(p_payload->>'agent'), '') is not null then
    select id into v_agent from ai_employees
     where tenant_id = v_tenant and status = 'active'
     order by is_primary desc limit 1;
    if v_agent is not null then
      update ai_employees set persona_name = trim(p_payload->>'agent') where id = v_agent;
      -- keep the prompt in step with the new name
      update ai_employees
         set prompt_template = regexp_replace(
               prompt_template, '^You are [^,]+,', 'You are ' || trim(p_payload->>'agent') || ',')
       where id = v_agent;
      perform rebuild_agent(v_agent);
    end if;
  end if;

  return json_build_object('ok', true);
end;
$$;

create or replace function update_hours(p_slug text, p_role text, p_hours jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_tenant uuid; v_agent uuid;
begin
  if not guard(p_role, 'settings') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;

  update tenants set opening_hours = p_hours where slug = p_slug
  returning id into v_tenant;
  if v_tenant is null then return json_build_object('ok', false, 'reason', 'unknown_tenant'); end if;

  -- the agent quotes hours from its prompt, so it has to be rewritten too
  for v_agent in select id from ai_employees where tenant_id = v_tenant and status = 'active' loop
    update ai_employees
       set prompt_template = regexp_replace(
             prompt_template, 'Hours: [^\n]*', 'Hours: ' || hours_sentence(p_hours))
     where id = v_agent;
    perform rebuild_agent(v_agent);
  end loop;

  return json_build_object('ok', true);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · SERVICES — add and remove, not only reprice
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function save_item(p_slug text, p_role text, p_payload json)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_tenant uuid; v_id uuid := nullif(p_payload->>'id','')::uuid; v_name text;
begin
  if not guard(p_role, 'edit_prices') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;

  v_name := nullif(trim(p_payload->>'name'), '');
  if v_name is null then return json_build_object('ok', false, 'reason', 'name_required'); end if;

  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok', false, 'reason', 'unknown_tenant'); end if;

  if v_id is null then
    insert into items (tenant_id, name, description, price_local, currency_code,
                       duration_minutes, is_bookable)
    values (v_tenant, v_name,
            nullif(trim(coalesce(p_payload->>'description','')), ''),
            nullif(p_payload->>'price','')::numeric,
            coalesce(nullif(p_payload->>'currency',''), 'MYR'),
            nullif(p_payload->>'minutes','')::int, true)
    returning id into v_id;
  else
    update items set
      name             = v_name,
      description      = nullif(trim(coalesce(p_payload->>'description','')), ''),
      price_local      = coalesce(nullif(p_payload->>'price','')::numeric, price_local),
      duration_minutes = coalesce(nullif(p_payload->>'minutes','')::int, duration_minutes)
    where id = v_id and tenant_id = v_tenant;
    if not found then return json_build_object('ok', false, 'reason', 'unknown_item'); end if;
  end if;

  perform rebuild_prompt(p_slug);
  return json_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function remove_item(p_slug text, p_role text, p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_tenant uuid;
begin
  if not guard(p_role, 'edit_prices') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;

  select id into v_tenant from tenants where slug = p_slug;

  -- kept, not deleted: past bookings still point at it
  update items set is_active = false where id = p_id and tenant_id = v_tenant;
  if not found then return json_build_object('ok', false, 'reason', 'unknown_item'); end if;

  perform rebuild_prompt(p_slug);
  return json_build_object('ok', true);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · ROLE CHECKS ON THE EXISTING ACTIONS
-- Wrappers, so the originals keep working and nothing already built breaks.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function guarded_action(
  p_slug text, p_role text, p_action text, p_payload json
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_need text;
begin
  v_need := case p_action
    when 'price'              then 'edit_prices'
    when 'save_item'          then 'edit_prices'
    when 'remove_item'        then 'edit_prices'
    when 'resolve_escalation' then 'handle_chats'
    when 'booking_status'     then 'manage_bookings'
    when 'save_post'          then 'marketing'
    when 'set_post_status'    then 'marketing'
    when 'invoice'            then 'finance'
    when 'invoice_status'     then 'finance'
    when 'add_staff'          then 'manage_team'
    when 'set_staff'          then 'manage_team'
    when 'add_agent'          then 'settings'
    when 'branding'           then 'settings'
    when 'hours'              then 'settings'
    else 'view' end;

  if not guard(p_role, v_need) then
    return json_build_object('ok', false, 'reason', 'not_allowed',
                             'needs', v_need, 'your_role', p_role);
  end if;

  return case p_action
    when 'price'              then update_item_price((p_payload->>'id')::uuid,
                                                     (p_payload->>'price')::numeric)
    when 'save_item'          then save_item(p_slug, p_role, p_payload)
    when 'remove_item'        then remove_item(p_slug, p_role, (p_payload->>'id')::uuid)
    when 'resolve_escalation' then resolve_escalation((p_payload->>'id')::uuid)
    when 'booking_status'     then set_booking_status((p_payload->>'id')::uuid,
                                                      p_payload->>'status')
    when 'save_post'          then save_post(p_slug, p_payload)
    when 'set_post_status'    then set_post_status((p_payload->>'id')::uuid,
                                                   p_payload->>'status')
    when 'invoice'            then invoice_for_booking((p_payload->>'id')::uuid)
    when 'invoice_status'     then set_invoice_status((p_payload->>'id')::uuid,
                                                      p_payload->>'status', null)
    when 'add_staff'          then add_staff(p_slug, p_payload)
    when 'set_staff'          then set_staff((p_payload->>'id')::uuid,
                                             coalesce(p_payload->>'role',''),
                                             coalesce(p_payload->>'status',''))
    when 'add_agent'          then add_agent(p_slug, p_payload)
    when 'branding'           then update_branding(p_slug, p_role, p_payload)
    when 'hours'              then update_hours(p_slug, p_role, (p_payload->>'hours')::jsonb)
    else json_build_object('ok', false, 'reason', 'unknown_action')
  end;
end;
$$;

-- platform_data should also return the services and hours the settings page edits
create or replace function platform_data(p_slug text)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_result json;
begin
  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  perform ensure_social_rows(v_tenant);

  select json_build_object(
    'ok', true,
    'business', (select json_build_object(
        'name',t.name,'slug',t.slug,'color',coalesce(t.brand_color,'#1D6A8C'),
        'plan',t.plan,'wallet',t.wallet_balance_usd,'domain',t.custom_domain,
        'tagline',t.tagline,'address',t.address,'phone',t.phone,'map_url',t.map_url,
        'greeting',t.brand_greeting,'suggestions',t.brand_suggestions,
        'hours',t.opening_hours,'logo_url',t.logo_url,'access_code',t.access_code)
      from tenants t where t.id = v_tenant),
    'items', (select coalesce(json_agg(i order by i.price nulls last),'[]'::json) from (
        select id, name, description, price_local as price, currency_code as currency,
               duration_minutes as minutes
        from items where tenant_id = v_tenant and is_active order by price_local nulls last) i),
    'agents', list_agents(p_slug),
    'team', (select coalesce(json_agg(s order by s.role, s.name),'[]'::json) from (
        select id, name, email, role, status, access_code from staff
        where tenant_id = v_tenant order by role, name) s),
    'social', (select coalesce(json_agg(a order by a.platform),'[]'::json) from (
        select id, platform, handle, status, followers from social_accounts
        where tenant_id = v_tenant) a),
    'posts', (select coalesce(json_agg(p order by p.created_at desc),'[]'::json) from (
        select id, body, platforms, status, scheduled_at, published_at, reach, clicks
        from posts where tenant_id = v_tenant order by created_at desc limit 30) p),
    'invoices', (select coalesce(json_agg(i order by i.issued_on desc),'[]'::json) from (
        select inv.id, inv.number, inv.amount, inv.currency, inv.status, inv.issued_on,
               coalesce(c.name,'Walk-in') as customer
        from invoices inv left join customers c on c.id = inv.customer_id
        where inv.tenant_id = v_tenant order by inv.issued_on desc limit 30) i),
    'finance', (select json_build_object(
        'paid',   coalesce(sum(amount) filter (where status='paid'),0),
        'unpaid', coalesce(sum(amount) filter (where status='unpaid'),0),
        'count',  count(*))
      from invoices where tenant_id = v_tenant),
    'stats', (select json_build_object(
        'conversations',(select count(*) from conversations where tenant_id = v_tenant),
        'bookings',(select count(*) from bookings where tenant_id = v_tenant
                     and status in ('pending','confirmed')),
        'needs_you',(select count(*) from escalations where tenant_id = v_tenant
                      and status='open')))
  ) into v_result;

  return v_result;
end; $$;

revoke execute on function
  resolve_key(text), update_branding(text,text,json), update_hours(text,text,jsonb),
  save_item(text,text,json), remove_item(text,text,uuid), guarded_action(text,text,text,json)
  from public, anon, authenticated;

grant execute on function
  resolve_key(text), update_branding(text,text,json), update_hours(text,text,jsonb),
  save_item(text,text,json), remove_item(text,text,uuid), guarded_action(text,text,text,json),
  guard(text,text)
  to service_role;

-- ============================================================================
-- CHECK
--   select resolve_key('DAMAI-DEMO');          → owner
--   select resolve_key('DAMAI-CLINIC-OWNER');  → owner (staff row)
--   select guarded_action('damai-clinic','viewer','price','{"id":"x","price":1}'::json);
--     → not_allowed, needs edit_prices
--   select update_hours('damai-clinic','owner',
--     '{"mon":["08:00","17:00"],"tue":["08:30","18:00"],"wed":["08:30","18:00"],
--       "thu":["08:30","18:00"],"fri":["08:30","18:00"],"sat":["09:00","13:00"],
--       "sun":null}'::jsonb);
--   → then ask the agent "what are your opening hours" — it should say 08:00 Monday
-- ============================================================================
