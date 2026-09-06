-- ============================================================================
-- 0032_roles_fix.sql — make permissions visible.
-- Run AFTER 0031. Safe to re-run.
--
-- THE BUG THIS ACCOMPANIES
-- The dashboard asked for your role in a separate request that middleware
-- blocked. The failed response had no role, the code defaulted to 'viewer',
-- and every edit control went read-only. Worse, it failed silently — the page
-- looked fine, it just didn't let you do anything. Fixed in the app; this adds
-- the tools to see it next time.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- whoami() — what does this key actually give you?
--
-- Paste a key, see the business, the role, and every permission it carries.
-- This is the first thing to run when someone says "I can't edit anything".
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function whoami(p_code text)
returns json language plpgsql stable security definer set search_path = public as $$
declare v json; v_role text; v_actions text[]; a text; v_perms json[] := '{}';
begin
  v := resolve_key(p_code);
  if not (v->>'ok')::boolean then
    return json_build_object('ok', false,
      'reason', coalesce(v->>'reason', 'no_match'),
      'hint', 'No business or staff member has that key. Check for a typo, '
              'or list them: select name, slug, access_code from tenants;');
  end if;

  v_role := v->>'role';
  v_actions := array['view','handle_chats','manage_bookings','edit_prices',
                     'marketing','finance','manage_team','settings'];

  foreach a in array v_actions loop
    v_perms := array_append(v_perms, json_build_object('action', a, 'allowed', role_can(v_role, a)));
  end loop;

  return json_build_object(
    'ok', true,
    'scope', coalesce(v->>'scope', 'tenant'),
    'business', v->>'business',
    'slug', coalesce(v->>'slug', v->>'org_slug'),
    'name', v->>'name',
    'role', v_role,
    'can', array_to_json(v_perms),
    'summary', case v_role
      when 'owner'   then 'Everything, including team and settings.'
      when 'manager' then 'Prices, marketing, finance and bookings. Not team or settings.'
      when 'staff'   then 'Chats and bookings only.'
      when 'viewer'  then 'Read only — cannot change anything.'
      else 'Unrecognised role: ' || v_role end);
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Anyone stored with a role the system doesn't recognise can't do anything,
-- because role_can returns false for everything. Find them.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function audit_roles()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'ok', true,
    'staff', (select coalesce(json_agg(json_build_object(
        'business', coalesce(t.name, o.name), 'name', s.name, 'role', s.role,
        'status', s.status, 'code', s.access_code,
        'recognised', s.role in ('owner','manager','staff','viewer'),
        'can_edit_prices', role_can(s.role, 'edit_prices'),
        'can_change_settings', role_can(s.role, 'settings'))
        order by s.role, s.name), '[]'::json)
      from staff s
      left join tenants t on t.id = s.tenant_id
      left join organisations o on o.id = s.organisation_id),
    'businesses_without_owner', (select coalesce(json_agg(t.name), '[]'::json)
      from tenants t
      where not exists (select 1 from staff s
                         where s.tenant_id = t.id and s.role = 'owner'
                           and s.status = 'active')),
    'note', 'A business with no owner staff row still works — its access_code '
            'signs in as owner. The staff row only matters for per-person keys.');
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- "admin" is what people call it. Accept it rather than silently denying
-- everything, and normalise it to manager.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function role_can(p_role text, p_action text)
returns boolean language sql immutable as $$
  select case lower(coalesce(p_role, ''))
           when 'admin' then 'manager'
           when 'administrator' then 'manager'
           when 'employee' then 'staff'
           when 'readonly' then 'viewer'
           when 'read_only' then 'viewer'
           else lower(coalesce(p_role, 'viewer'))
         end
    in (select unnest(case p_action
      when 'view'            then array['owner','manager','staff','viewer']
      when 'handle_chats'    then array['owner','manager','staff']
      when 'manage_bookings' then array['owner','manager','staff']
      when 'edit_prices'     then array['owner','manager']
      when 'marketing'       then array['owner','manager']
      when 'finance'         then array['owner','manager']
      when 'manage_team'     then array['owner']
      when 'settings'        then array['owner']
      else array[]::text[] end));
$$;

-- let the constraint accept what people type, then normalise on the way in
alter table staff drop constraint if exists staff_role_chk;
alter table staff add constraint staff_role_chk
  check (lower(role) in ('owner','manager','staff','viewer',
                         'admin','administrator','employee','readonly','read_only'));

create or replace function add_staff(p_tenant_slug text, p_payload json)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid; v_code text; v_name text := nullif(trim(p_payload->>'name'),'');
  v_role text; v_prefix text;
begin
  if v_name is null then return json_build_object('ok',false,'reason','name_required'); end if;

  -- normalise on the way in, so what's stored is what the checks expect
  v_role := case lower(coalesce(p_payload->>'role','staff'))
    when 'admin' then 'manager' when 'administrator' then 'manager'
    when 'employee' then 'staff' when 'readonly' then 'viewer'
    when 'read_only' then 'viewer'
    else lower(coalesce(p_payload->>'role','staff')) end;

  if v_role not in ('owner','manager','staff','viewer') then
    return json_build_object('ok',false,'reason','bad_role',
      'hint','Use owner, manager, staff or viewer.');
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

-- tidy anything already stored under a synonym
update staff set role = 'manager' where lower(role) in ('admin','administrator');
update staff set role = 'staff'   where lower(role) = 'employee';
update staff set role = 'viewer'  where lower(role) in ('readonly','read_only');

revoke execute on function whoami(text), audit_roles() from public, anon, authenticated;
grant execute on function whoami(text), audit_roles() to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Report what's there now
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  raise notice '── KEYS AND WHAT THEY OPEN ─────────────';
  for r in select name, slug, access_code from tenants order by created_at loop
    raise notice '% (%) → % [owner]', r.name, r.slug, r.access_code;
  end loop;
  for r in select s.name, s.role, s.access_code, t.slug
             from staff s left join tenants t on t.id = s.tenant_id
            order by t.slug, s.role loop
    raise notice '  % → % [%]', r.name, r.access_code, r.role;
  end loop;
end $$;

-- ============================================================================
-- WHEN SOMEONE SAYS "I CAN'T EDIT ANYTHING"
--
--   select whoami('THEIR-KEY');
--     → shows the role and every permission it carries
--
--   select audit_roles();
--     → every staff member, and whether their role is recognised
--
--   select name, slug, access_code from tenants;
--     → the owner key for each business
--
-- If whoami says owner and the UI still won't let you edit, the problem is in
-- the app, not the database — check that /api/platform returns a "role" field.
-- ============================================================================
