-- ============================================================================
-- 0031_verify.sql — does this database actually have everything?
-- Run LAST, after 0030. Safe to re-run any time.
--
-- WHY THIS EXISTS
-- Over this build I shipped errors in 0017, 0021, 0022, 0024 and 0025. Each
-- one failed halfway, which in Postgres means everything before the error
-- applied and everything after it silently didn't. You then found out from a
-- blank dashboard rather than from the migration.
--
-- This checks every table, column and function the app expects and names
-- exactly what's missing. Run it after any migration and you know where you
-- stand in one query instead of five.
-- ============================================================================

create or replace function verify_schema()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_missing_tables  text[] := '{}';
  v_missing_columns text[] := '{}';
  v_missing_funcs   text[] := '{}';
  v_warnings        text[] := '{}';
  t text; c text; f text; parts text[];
  v_ok boolean;

  -- every table the app reads or writes
  tables text[] := array[
    'tenants','ai_employees','items','customers','conversations','messages',
    'bookings','escalations','profiles','usage_ledger','ai_decision_log',
    'tenant_domains','sector_templates','staff','social_accounts','campaigns',
    'posts','invoices','knowledge','email_log','subscriptions','plans',
    'organisations','audit_log','automations','broadcasts','domains','outbox',
    'signup_attempts','resources','resource_items','resource_blocks',
    'tenant_credentials','documents'
  ];

  -- columns added by later migrations, where a missing one means a half-run file
  columns text[] := array[
    'tenants.access_code','tenants.opening_hours','tenants.custom_domain',
    'tenants.organisation_id','tenants.plan','tenants.logo_url','tenants.tagline',
    'ai_employees.prompt_template','ai_employees.slug','ai_employees.audience',
    'ai_employees.is_primary','ai_employees.department',
    'bookings.resource_id','bookings.manage_token','bookings.rescheduled_from',
    'knowledge.document_id','knowledge.chunk_index',
    'staff.organisation_id'
  ];

  -- functions the app calls by name
  funcs text[] := array[
    'create_tenant','rebuild_prompt','rebuild_agent','create_booking',
    'dashboard_data','platform_data','platform_extras','update_item_price',
    'add_agent','list_agents','public_agents','guarded_action','guard','role_can',
    'resolve_key','add_staff','set_staff','update_branding','update_hours',
    'save_item','remove_item','save_knowledge','remove_knowledge',
    'save_post','set_post_status','set_automation','save_broadcast',
    'invoice_for_booking','set_invoice_status','billing_state','set_subscription',
    'create_organisation','add_branch','organisation_data','audit','audit_trail',
    'claim_domain','remove_domain','tenant_for_host','queue_automations',
    'claim_outbox','finish_outbox','analytics','check_signup_limit',
    'save_resource','remove_resource','free_resources','queue_booking_alert',
    'save_credential','list_credentials','get_credential',
    'set_tenant','current_tenant','tenant_guard','test_isolation',
    'save_document','remove_document','knowledge_budget','platform_documents',
    'master_overview','master_businesses','shareholder_report','master_health',
    'tenant_health','ask_business','business_briefing',
    'booking_by_token','cancel_by_token','reschedule_by_token','open_slots',
    'booking_manage_url','random_code','slugify','hours_sentence'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      v_missing_tables := array_append(v_missing_tables, t);
    end if;
  end loop;

  foreach c in array columns loop
    parts := string_to_array(c, '.');
    if to_regclass('public.' || parts[1]) is not null
       and not exists (select 1 from information_schema.columns
                        where table_schema = 'public'
                          and table_name = parts[1]
                          and column_name = parts[2]) then
      v_missing_columns := array_append(v_missing_columns, c);
    end if;
  end loop;

  foreach f in array funcs loop
    if not exists (select 1 from pg_proc p
                    join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = f) then
      v_missing_funcs := array_append(v_missing_funcs, f);
    end if;
  end loop;

  -- things that are present but wrong, which a table check won't catch
  if to_regclass('public.sector_templates') is not null then
    if (select count(*) from sector_templates) < 5 then
      v_warnings := array_append(v_warnings, 'sector_templates has fewer than 5 rows — signup will fail for some sectors');
    end if;
  end if;

  if to_regclass('public.ai_employees') is not null then
    if exists (select 1 from ai_employees
                where status = 'active'
                  and (compiled_prompt is null or compiled_prompt = '')) then
      v_warnings := array_append(v_warnings, 'an active agent has no compiled prompt — run: select rebuild_prompt(<slug>)');
    end if;
    if exists (select 1 from ai_employees
                where compiled_prompt like '%{{SERVICES}}%'
                   or compiled_prompt like '%{{KNOWLEDGE}}%') then
      v_warnings := array_append(v_warnings, 'a prompt still has an unrendered placeholder — rebuild_prompt did not run');
    end if;
  end if;

  if to_regclass('public.tenants') is not null then
    if exists (select 1 from tenants where access_code is null) then
      v_warnings := array_append(v_warnings, 'a business has no access code — its owner cannot sign in');
    end if;
    if exists (select 1 from tenants t
                where not exists (select 1 from ai_employees e
                                   where e.tenant_id = t.id and e.status = 'active')) then
      v_warnings := array_append(v_warnings, 'a business has no active agent');
    end if;
  end if;

  -- pgcrypto: the thing that broke signup for an hour
  begin
    perform gen_random_bytes(1);
  exception when others then
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = 'random_code') then
      v_warnings := array_append(v_warnings, 'pgcrypto is not installed and random_code() is missing — run 0024_random_fallback.sql');
    end if;
  end;

  v_ok := cardinality(v_missing_tables) = 0
      and cardinality(v_missing_columns) = 0
      and cardinality(v_missing_funcs) = 0;

  return json_build_object(
    'ok', v_ok,
    'verdict', case
      when v_ok and cardinality(v_warnings) = 0 then 'Everything is in place.'
      when v_ok then 'Schema complete, but check the warnings.'
      else 'Something did not run. See what is missing below.' end,
    'checked', json_build_object(
      'tables', cardinality(tables),
      'columns', cardinality(columns),
      'functions', cardinality(funcs)),
    'missing_tables', to_json(v_missing_tables),
    'missing_columns', to_json(v_missing_columns),
    'missing_functions', to_json(v_missing_funcs),
    'warnings', to_json(v_warnings),
    -- which file to re-run, worked out from what's absent
    'next_step', case
      when 'sector_templates' = any(v_missing_tables) then 'Re-run 0016_self_serve.sql'
      when 'ai_employees.slug' = any(v_missing_columns) then 'Re-run 0017_multi_agent.sql'
      when 'staff' = any(v_missing_tables) then 'Re-run 0018_platform.sql'
      when 'guarded_action' = any(v_missing_funcs) then 'Re-run 0019_settings_roles.sql'
      when 'knowledge' = any(v_missing_tables) then 'Re-run 0020_knowledge_email_billing.sql'
      when 'audit_log' = any(v_missing_tables) then 'Re-run 0021_branches_audit_automation.sql'
      when 'outbox' = any(v_missing_tables) then 'Re-run 0022_domains_sending_analytics.sql'
      when 'resources' = any(v_missing_tables) then 'Re-run 0023_resources_notify_credentials.sql'
      when 'random_code' = any(v_missing_funcs) then 'Re-run 0024_random_fallback.sql'
      when 'set_tenant' = any(v_missing_funcs) then 'Re-run 0026_rls.sql'
      when 'documents' = any(v_missing_tables) then 'Re-run 0027_documents.sql'
      when 'master_overview' = any(v_missing_funcs) then 'Re-run 0028_master_portal.sql'
      when 'ask_business' = any(v_missing_funcs) then 'Re-run 0029_owner_agent.sql'
      when 'booking_by_token' = any(v_missing_funcs) then 'Re-run 0030_self_service.sql'
      when not v_ok then 'Something is missing — see the lists above.'
      else 'Nothing to do.' end);
end;
$$;

grant execute on function verify_schema() to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- A shorter check that the live paths actually run, not just that they exist.
-- A function can be present and still throw the moment it's called.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function smoke_test()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text; v_results json[] := '{}'; v_r json; v_pass int := 0; v_fail int := 0;
begin
  select slug into v_slug from tenants order by created_at limit 1;
  if v_slug is null then
    return json_build_object('ok', false, 'reason', 'no_tenants',
      'hint', 'Create a business first, then run this.');
  end if;

  -- each one is wrapped: a throw is a failure, not the end of the test
  begin
    perform platform_data(v_slug);
    v_results := array_append(v_results, json_build_object('check','platform_data','ok',true));
    v_pass := v_pass + 1;
  exception when others then
    v_results := array_append(v_results, json_build_object('check','platform_data','ok',false,'error',sqlerrm));
    v_fail := v_fail + 1;
  end;

  begin
    perform dashboard_data(v_slug);
    v_results := array_append(v_results, json_build_object('check','dashboard_data','ok',true));
    v_pass := v_pass + 1;
  exception when others then
    v_results := array_append(v_results, json_build_object('check','dashboard_data','ok',false,'error',sqlerrm));
    v_fail := v_fail + 1;
  end;

  begin
    perform get_widget_config(v_slug);
    v_results := array_append(v_results, json_build_object('check','get_widget_config','ok',true));
    v_pass := v_pass + 1;
  exception when others then
    v_results := array_append(v_results, json_build_object('check','get_widget_config','ok',false,'error',sqlerrm));
    v_fail := v_fail + 1;
  end;

  begin
    perform rebuild_prompt(v_slug);
    v_results := array_append(v_results, json_build_object('check','rebuild_prompt','ok',true));
    v_pass := v_pass + 1;
  exception when others then
    v_results := array_append(v_results, json_build_object('check','rebuild_prompt','ok',false,'error',sqlerrm));
    v_fail := v_fail + 1;
  end;

  begin
    perform analytics(v_slug, 7);
    v_results := array_append(v_results, json_build_object('check','analytics','ok',true));
    v_pass := v_pass + 1;
  exception when others then
    v_results := array_append(v_results, json_build_object('check','analytics','ok',false,'error',sqlerrm));
    v_fail := v_fail + 1;
  end;

  begin
    perform list_agents(v_slug);
    v_results := array_append(v_results, json_build_object('check','list_agents','ok',true));
    v_pass := v_pass + 1;
  exception when others then
    v_results := array_append(v_results, json_build_object('check','list_agents','ok',false,'error',sqlerrm));
    v_fail := v_fail + 1;
  end;

  begin
    perform master_overview();
    v_results := array_append(v_results, json_build_object('check','master_overview','ok',true));
    v_pass := v_pass + 1;
  exception when others then
    v_results := array_append(v_results, json_build_object('check','master_overview','ok',false,'error',sqlerrm));
    v_fail := v_fail + 1;
  end;

  begin
    perform business_briefing(v_slug, 7);
    v_results := array_append(v_results, json_build_object('check','business_briefing','ok',true));
    v_pass := v_pass + 1;
  exception when others then
    v_results := array_append(v_results, json_build_object('check','business_briefing','ok',false,'error',sqlerrm));
    v_fail := v_fail + 1;
  end;

  -- create and immediately delete a business: the whole signup path, safely
  begin
    v_r := create_tenant(('{"name":"Smoke Test ' || floor(random()*1000000)::text ||
                          '","sector":"clinic","services":[{"name":"Check","price":"1"}]}')::json);
    if (v_r->>'ok')::boolean then
      delete from tenants where slug = v_r->>'slug';
      v_results := array_append(v_results, json_build_object('check','create_tenant','ok',true));
      v_pass := v_pass + 1;
    else
      v_results := array_append(v_results, json_build_object('check','create_tenant','ok',false,
                                                  'error', v_r::text));
      v_fail := v_fail + 1;
    end if;
  exception when others then
    v_results := array_append(v_results, json_build_object('check','create_tenant','ok',false,'error',sqlerrm));
    v_fail := v_fail + 1;
  end;

  return json_build_object(
    'ok', v_fail = 0,
    'passed', v_pass, 'failed', v_fail,
    'verdict', case when v_fail = 0
      then 'Every path runs.'
      else v_fail || ' of ' || (v_pass + v_fail) || ' failed — see below.' end,
    'checks', array_to_json(v_results));
end;
$$;

grant execute on function smoke_test() to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Run both now and say plainly what the state is.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare v json; s json;
begin
  v := verify_schema();
  raise notice '── SCHEMA ──────────────────────────────';
  raise notice '%', v->>'verdict';
  if not (v->>'ok')::boolean then
    raise notice 'missing tables:    %', v->>'missing_tables';
    raise notice 'missing columns:   %', v->>'missing_columns';
    raise notice 'missing functions: %', v->>'missing_functions';
    raise notice 'NEXT: %', v->>'next_step';
  end if;
  if coalesce(v->>'warnings', '[]') <> '[]' then
    raise notice 'warnings: %', v->>'warnings';
  end if;

  s := smoke_test();
  raise notice '── LIVE PATHS ──────────────────────────';
  raise notice '%', s->>'verdict';
  if not (s->>'ok')::boolean then
    raise notice 'details: %', s->>'checks';
  end if;
end $$;

-- ============================================================================
-- USE IT ANY TIME
--   select verify_schema();   → is everything present?
--   select smoke_test();      → does everything actually run?
--
-- Run these after any migration. Between them they catch the failure mode that
-- has cost the most time here: a file that errored halfway, leaving the
-- database in a state where the next five files appear to work and the app
-- doesn't.
-- ============================================================================
