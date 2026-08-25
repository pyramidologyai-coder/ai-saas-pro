-- ============================================================================
-- 0003_functions.sql — wallet + compile helpers
-- Run AFTER 0001_init.sql and 0002_seed.sql.
--
-- Why this file exists: app/api/chat/route.ts calls debit_wallet() at step 8.
-- Without this, every message errors at the ledger step.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- debit_wallet: charge a tenant for one message, atomically.
--   * inserts a usage_ledger row (negative amount = debit)
--   * updates tenants.wallet_balance_usd
--   * returns the new balance
-- One transaction. The ledger row and the balance can never disagree.
-- ----------------------------------------------------------------------------
create or replace function debit_wallet(
  p_tenant_id       uuid,
  p_conversation_id uuid,
  p_amount_usd      numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance numeric(12,4);
begin
  if p_amount_usd is null or p_amount_usd < 0 then
    raise exception 'debit_wallet: amount must be >= 0, got %', p_amount_usd;
  end if;

  -- lock the tenant row so two messages can't race the balance
  update tenants
     set wallet_balance_usd = wallet_balance_usd - p_amount_usd
   where id = p_tenant_id
  returning wallet_balance_usd into v_new_balance;

  if not found then
    raise exception 'debit_wallet: tenant % not found', p_tenant_id;
  end if;

  insert into usage_ledger (tenant_id, conversation_id, entry_type,
                            amount_usd, balance_after, description)
  values (p_tenant_id, p_conversation_id, 'usage',
          -p_amount_usd, v_new_balance, 'AI message');

  return v_new_balance;
end;
$$;

-- ----------------------------------------------------------------------------
-- topup_wallet: add credit. Used manually for the demo tenant.
--   select topup_wallet('<tenant-id>', 10.00, 'demo top-up');
-- ----------------------------------------------------------------------------
create or replace function topup_wallet(
  p_tenant_id   uuid,
  p_amount_usd  numeric,
  p_description text default 'top-up'
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance numeric(12,4);
begin
  if p_amount_usd is null or p_amount_usd <= 0 then
    raise exception 'topup_wallet: amount must be > 0, got %', p_amount_usd;
  end if;

  update tenants
     set wallet_balance_usd = wallet_balance_usd + p_amount_usd
   where id = p_tenant_id
  returning wallet_balance_usd into v_new_balance;

  if not found then
    raise exception 'topup_wallet: tenant % not found', p_tenant_id;
  end if;

  insert into usage_ledger (tenant_id, entry_type, amount_usd,
                            balance_after, description)
  values (p_tenant_id, 'topup', p_amount_usd, v_new_balance, p_description);

  return v_new_balance;
end;
$$;

-- ----------------------------------------------------------------------------
-- save_compiled_prompt: store the compiler's output for an agent.
-- Called by the compile step (Gate 1, task 1.2), never per message.
--   select save_compiled_prompt('<ai_employee_id>', 'PROMPT TEXT', 744);
-- Bumps config_version so you can tell which prompt answered which message.
-- ----------------------------------------------------------------------------
create or replace function save_compiled_prompt(
  p_ai_employee_id uuid,
  p_prompt         text,
  p_tokens         int
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version int;
begin
  if p_prompt is null or length(trim(p_prompt)) = 0 then
    raise exception 'save_compiled_prompt: prompt is empty';
  end if;

  update ai_employees
     set compiled_prompt = p_prompt,
         compiled_tokens = p_tokens,
         config_version  = config_version + 1,
         updated_at      = now()
   where id = p_ai_employee_id
  returning config_version into v_version;

  if not found then
    raise exception 'save_compiled_prompt: ai_employee % not found', p_ai_employee_id;
  end if;

  return v_version;
end;
$$;

-- ----------------------------------------------------------------------------
-- Lock these down: only the server (service role) may call them.
-- The browser's anon key gets nothing.
-- ----------------------------------------------------------------------------
revoke execute on function debit_wallet(uuid, uuid, numeric)      from public, anon, authenticated;
revoke execute on function topup_wallet(uuid, numeric, text)      from public, anon, authenticated;
revoke execute on function save_compiled_prompt(uuid, text, int)  from public, anon, authenticated;

grant  execute on function debit_wallet(uuid, uuid, numeric)      to service_role;
grant  execute on function topup_wallet(uuid, numeric, text)      to service_role;
grant  execute on function save_compiled_prompt(uuid, text, int)  to service_role;

-- Done. Verify with:
--   select topup_wallet(id, 10.00, 'demo top-up') from tenants where slug = 'sunrise-hair';
--   select wallet_balance_usd from tenants where slug = 'sunrise-hair';   -- expect 10 more
--   select * from usage_ledger order by created_at desc limit 2;
