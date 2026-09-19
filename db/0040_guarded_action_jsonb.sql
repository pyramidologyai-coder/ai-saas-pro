-- ============================================================================
-- 0040_guarded_action_jsonb.sql — every dashboard write was failing.
-- Run AFTER 0039. Safe to re-run.
--
-- WHY
-- The last line of guarded_action() strips two keys out of the payload before
-- writing it to the audit log:
--
--     (p_payload - 'secret' - 'chunks')
--
-- p_payload is declared json. The `-` operator that deletes a key exists only
-- on jsonb, so this raises
--
--     operator does not exist: json - unknown
--
-- That audit call runs on every action, after the work is done and before the
-- result is returned. So the price change, the automation toggle, the staff
-- invite and everything else all ran, then threw on the way out. The route
-- caught it and returned "unavailable", which reads like a permissions problem
-- and is nothing of the kind.
--
-- This is the trap already written down in CLAUDE.md — json does not carry the
-- operators jsonb does — arriving through `-` rather than `=`. The note there
-- only mentions equality. It is worth widening: if an operator works on jsonb,
-- do not assume json has it.
--
-- The fix is one cast. audit() already takes jsonb for that argument, so the
-- value wanted converting anyway.
--
-- HOW IT HID
-- The work itself succeeded before the throw, so a price edit really did save
-- and really did rebuild the prompt — the dashboard just reported a failure and
-- reloaded, showing the new value. Easy to read as "saved but complained".
-- Postgres logs showed nothing at the level being searched, and calling
-- update_item_price() directly worked perfectly, because the fault was in the
-- wrapper rather than the thing being wrapped.
-- ============================================================================

create or replace function guarded_action(p_slug text, p_role text, p_action text, p_payload json)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare v_need text; v_result json;
begin
  v_need := case p_action
    when 'price' then 'edit_prices' when 'save_item' then 'edit_prices'
    when 'remove_item' then 'edit_prices'
    when 'resolve_escalation' then 'handle_chats'
    when 'booking_status' then 'manage_bookings'
    when 'save_post' then 'marketing' when 'set_post_status' then 'marketing'
    when 'set_automation' then 'marketing' when 'save_broadcast' then 'marketing'
    when 'invoice' then 'finance' when 'invoice_status' then 'finance'
    when 'add_staff' then 'manage_team' when 'set_staff' then 'manage_team'
    else 'settings' end;

  if not guard(p_role, v_need) then
    return json_build_object('ok',false,'reason','not_allowed',
                             'needs',v_need,'your_role',p_role);
  end if;

  v_result := case p_action
    when 'price' then update_item_price((p_payload->>'id')::uuid,(p_payload->>'price')::numeric)
    when 'save_item' then save_item(p_slug, p_role, p_payload)
    when 'remove_item' then remove_item(p_slug, p_role, (p_payload->>'id')::uuid)
    when 'resolve_escalation' then resolve_escalation((p_payload->>'id')::uuid)
    when 'booking_status' then set_booking_status((p_payload->>'id')::uuid, p_payload->>'status')
    when 'save_post' then save_post(p_slug, p_payload)
    when 'set_post_status' then set_post_status((p_payload->>'id')::uuid, p_payload->>'status')
    when 'set_automation' then set_automation(p_slug, p_role, p_payload)
    when 'save_broadcast' then save_broadcast(p_slug, p_role, p_payload)
    when 'invoice' then invoice_for_booking((p_payload->>'id')::uuid)
    when 'invoice_status' then set_invoice_status((p_payload->>'id')::uuid, p_payload->>'status', null)
    when 'add_staff' then add_staff(p_slug, p_payload)
    when 'set_staff' then set_staff((p_payload->>'id')::uuid,
                                    coalesce(p_payload->>'role',''), coalesce(p_payload->>'status',''))
    when 'add_agent' then add_agent(p_slug, p_payload)
    when 'branding' then update_branding(p_slug, p_role, p_payload)
    when 'hours' then update_hours(p_slug, p_role, (p_payload->>'hours')::jsonb)
    when 'save_knowledge' then save_knowledge(p_slug, p_role, p_payload)
    when 'remove_knowledge' then remove_knowledge(p_slug, p_role, (p_payload->>'id')::uuid)
    when 'save_document' then save_document(p_slug, p_role, p_payload)
    when 'remove_document' then remove_document(p_slug, p_role, (p_payload->>'id')::uuid)
    when 'claim_domain' then claim_domain(p_slug, p_role, p_payload->>'hostname')
    when 'remove_domain' then remove_domain(p_slug, p_role, (p_payload->>'id')::uuid)
    when 'save_resource' then save_resource(p_slug, p_role, p_payload)
    when 'remove_resource' then remove_resource(p_slug, p_role, (p_payload->>'id')::uuid)
    when 'save_credential' then save_credential(p_slug, p_role, p_payload)
    when 'remove_credential' then remove_credential(p_slug, p_role, p_payload->>'provider')
    else json_build_object('ok',false,'reason','unknown_action')
  end;

  -- 'chunks' would flood the log with the whole document. The ::jsonb cast is
  -- the whole fix: `-` deletes a key on jsonb and does not exist on json, and
  -- audit() wants jsonb here regardless.
  perform audit(p_slug, coalesce(p_payload->>'actor', p_role), p_role, p_action,
                nullif(p_payload->>'id',''), (p_payload::jsonb - 'secret' - 'chunks'));

  return v_result;
end; $function$;

-- ============================================================================
-- CHECK
--   Every dashboard write goes through this, so one call proves the lot:
--
--   select guarded_action('damai-clinic','owner','price',
--     json_build_object('id','<an item id>','price',77,'actor','owner'));
--   → {"ok": true, ...} rather than an operator error
--
--   A role that may not do it should still be refused cleanly:
--   select guarded_action('damai-clinic','viewer','price',
--     json_build_object('id','<an item id>','price',77,'actor','viewer'));
--   → {"ok": false, "reason": "not_allowed", "needs": "edit_prices"}
--
--   And the audit row should now exist:
--   select action, actor, role, created_at from audit_log
--    order by created_at desc limit 3;
-- ============================================================================
