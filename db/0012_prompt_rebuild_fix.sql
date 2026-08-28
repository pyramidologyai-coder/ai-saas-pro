-- ============================================================================
-- 0012_prompt_rebuild_fix.sql — make rebuild_prompt() reliable
-- Run AFTER 0011. Safe to re-run.
--
-- THE BUG: the old version found "SERVICES AND PRICES", then looked for the
-- next blank line to mark the end of the block. That assumption broke on the
-- real stored prompt, so every price save returned 'malformed_prompt'.
--
-- THE FIX: walk the prompt line by line. Replace the run of "- ..." lines that
-- follows the heading. No guessing where the block ends — a service line starts
-- with "- ", and anything else means the block is over.
-- ============================================================================

create or replace function rebuild_prompt(p_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_agent_id  uuid;
  v_prompt    text;
  v_services  text;
  v_lines     text[];
  v_out       text[] := '{}';
  v_i         int := 1;
  v_n         int;
  v_done      boolean := false;
  v_version   int;
begin
  select id into v_tenant_id from tenants where slug = p_slug;
  if v_tenant_id is null then
    return json_build_object('ok', false, 'reason', 'unknown_tenant');
  end if;

  select id, compiled_prompt into v_agent_id, v_prompt
  from ai_employees
  where tenant_id = v_tenant_id and status = 'active'
  limit 1;

  if v_agent_id is null or v_prompt is null then
    return json_build_object('ok', false, 'reason', 'no_agent');
  end if;

  -- Regenerate the services list from live data
  select string_agg(
           '- ' || name
           || case when price_local is null then ' (price on enquiry)'
                   else ' — ' || currency_code || ' ' ||
                        trim(to_char(price_local, 'FM999999990.00')) end
           || case when duration_minutes is null then ''
                   else ', about ' || duration_minutes || ' minutes' end
           || case when description is null or description = '' then ''
                   else '. ' || description end,
           E'\n' order by price_local nulls last)
    into v_services
  from items
  where tenant_id = v_tenant_id and is_active;

  v_services := coalesce(v_services, '(none listed)');

  -- Walk the prompt, swapping only the service lines
  v_lines := string_to_array(v_prompt, E'\n');
  v_n := coalesce(array_length(v_lines, 1), 0);

  while v_i <= v_n loop
    if not v_done and upper(trim(v_lines[v_i])) = 'SERVICES AND PRICES' then
      v_out := v_out || v_lines[v_i];                          -- keep the heading
      v_out := v_out || string_to_array(v_services, E'\n');    -- new list
      v_i := v_i + 1;
      -- skip the old list: every line starting "- ", plus the empty-state line
      while v_i <= v_n
        and (v_lines[v_i] like '- %' or trim(v_lines[v_i]) = '(none listed)')
      loop
        v_i := v_i + 1;
      end loop;
      v_done := true;
      continue;
    end if;

    v_out := v_out || v_lines[v_i];
    v_i := v_i + 1;
  end loop;

  if not v_done then
    return json_build_object('ok', false, 'reason', 'no_services_block');
  end if;

  v_prompt := array_to_string(v_out, E'\n');

  update ai_employees
     set compiled_prompt = v_prompt,
         compiled_tokens = ceil(length(v_prompt) / 4.0),
         config_version  = config_version + 1,
         updated_at      = now()
   where id = v_agent_id
  returning config_version into v_version;

  return json_build_object('ok', true,
                           'config_version', v_version,
                           'tokens', ceil(length(v_prompt) / 4.0),
                           'services_listed', array_length(string_to_array(v_services, E'\n'), 1));
end;
$$;

revoke execute on function rebuild_prompt(text) from public, anon, authenticated;
grant  execute on function rebuild_prompt(text) to service_role;

-- ============================================================================
-- TEST — run these three in order.
--
--   select rebuild_prompt('damai-clinic');
--     → expect ok:true, a config_version, and services_listed matching your
--       number of active services
--
--   select substring(compiled_prompt from position('SERVICES AND PRICES' in compiled_prompt)
--                    for 400)
--     from ai_employees where sector_id = 'clinic';
--     → eyeball it: heading, then the service lines, then the next section.
--       No duplicated list, nothing swallowed.
--
--   select rebuild_prompt('sunrise-hair');   → the salon should work too
-- ============================================================================
