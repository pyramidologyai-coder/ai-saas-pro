-- ============================================================================
-- 0027_documents.sql — upload a document, the AI knows it.
-- Run AFTER 0026. Safe to re-run.
--
-- A business will not retype their refund policy, their FAQ sheet, or their
-- treatment list. They already have it as a PDF or a Word file. This lets them
-- upload it.
--
-- HOW THE TEXT REACHES THE AGENT
-- The server extracts plain text, splits it on natural boundaries, and stores
-- the pieces as knowledge rows. The prompt already has a {{KNOWLEDGE}} slot, so
-- nothing about the agent changes — it just has more to read.
--
-- WHY STILL NO EMBEDDINGS
-- A small business has a few pages. A few pages fit in the prompt, and putting
-- them all in beats retrieving the wrong three paragraphs. The budget guard
-- below is what tells us when that stops being true.
-- ============================================================================

create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  filename    text not null,
  mime        text,
  bytes       int,
  pages       int,
  status      text not null default 'processing',
  error       text,
  chunk_count int not null default 0,
  word_count  int not null default 0,
  uploaded_by text,
  created_at  timestamptz not null default now(),
  constraint doc_status_chk check (status in ('processing','ready','failed','removed'))
);

create index if not exists documents_tenant_idx on documents(tenant_id) where status <> 'removed';
alter table documents enable row level security;
alter table documents force row level security;
drop policy if exists tenant_isolation on documents;
create policy tenant_isolation on documents for all
  using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());

-- knowledge rows can now point back at the file they came from
alter table knowledge
  add column if not exists document_id uuid references documents(id) on delete cascade,
  add column if not exists chunk_index int;

create index if not exists knowledge_doc_idx on knowledge(document_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- The budget guard.
--
-- Every word of knowledge is read on every single message, and paid for on
-- every single message. This is the number that decides when retrieval stops
-- being premature optimisation and becomes necessary.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function knowledge_budget(p_tenant uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_words int; v_tokens int; v_entries int; v_docs int;
  v_per_msg numeric; v_state text;
begin
  select coalesce(sum(array_length(regexp_split_to_array(body, '\s+'), 1)), 0),
         ceil(coalesce(sum(length(body)), 0) / 4.0),
         count(*)
    into v_words, v_tokens, v_entries
  from knowledge where tenant_id = p_tenant and is_active;

  select count(*) into v_docs
  from documents where tenant_id = p_tenant and status = 'ready';

  -- Gemini Flash input pricing, roughly. Enough to tell a story, not a bill.
  v_per_msg := round((v_tokens / 1000000.0) * 0.30, 6);

  v_state := case
    when v_words < 2000 then 'fine'
    when v_words < 5000 then 'watch'
    else 'heavy' end;

  return json_build_object(
    'words', v_words, 'tokens', v_tokens, 'entries', v_entries, 'documents', v_docs,
    'cost_per_message_usd', v_per_msg,
    'state', v_state,
    'advice', case v_state
      when 'fine'  then 'Plenty of room.'
      when 'watch' then 'Getting long. Trim anything the AI does not need — a sharp short set answers better than a long one.'
      else 'This is a lot to read on every message. It costs more and answers less precisely. Remove what customers never ask about.'
    end);
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Store the extracted text.
--
-- Called once per document with the whole text already split by the server.
-- Doing it in one transaction means a half-imported document is impossible.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function save_document(p_slug text, p_role text, p_payload json)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid; v_doc uuid; v_chunk json; v_i int := 0;
  v_words int := 0; v_title text; v_budget json;
begin
  if not guard(p_role, 'settings') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;

  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  if json_typeof(p_payload->'chunks') <> 'array'
     or json_array_length(p_payload->'chunks') = 0 then
    return json_build_object('ok', false, 'reason', 'no_text',
      'hint', 'The file had no readable text. A scanned PDF needs OCR first.');
  end if;

  v_title := coalesce(nullif(trim(p_payload->>'filename'), ''), 'Document');

  insert into documents (tenant_id, filename, mime, bytes, pages, status, uploaded_by)
  values (v_tenant, v_title, nullif(p_payload->>'mime',''),
          nullif(p_payload->>'bytes','')::int,
          nullif(p_payload->>'pages','')::int,
          'processing', nullif(p_payload->>'by',''))
  returning id into v_doc;

  for v_chunk in select * from json_array_elements(p_payload->'chunks') loop
    if nullif(trim(v_chunk->>'text'), '') is not null then
      insert into knowledge (tenant_id, title, body, document_id, chunk_index)
      values (v_tenant,
              coalesce(nullif(trim(v_chunk->>'heading'), ''),
                       v_title || ' (' || (v_i + 1) || ')'),
              trim(v_chunk->>'text'), v_doc, v_i);
      v_words := v_words + coalesce(
        array_length(regexp_split_to_array(trim(v_chunk->>'text'), '\s+'), 1), 0);
      v_i := v_i + 1;
    end if;
  end loop;

  if v_i = 0 then
    update documents set status = 'failed', error = 'no usable text' where id = v_doc;
    return json_build_object('ok', false, 'reason', 'no_text');
  end if;

  update documents
     set status = 'ready', chunk_count = v_i, word_count = v_words
   where id = v_doc;

  perform rebuild_prompt(p_slug);
  v_budget := knowledge_budget(v_tenant);

  return json_build_object('ok', true, 'document_id', v_doc,
    'chunks', v_i, 'words', v_words, 'budget', v_budget);
end; $$;

create or replace function remove_document(p_slug text, p_role text, p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  if not guard(p_role, 'settings') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  select id into v_tenant from tenants where slug = p_slug;

  -- the cascade takes its knowledge rows with it
  delete from documents where id = p_id and tenant_id = v_tenant;
  if not found then return json_build_object('ok',false,'reason','unknown_document'); end if;

  perform rebuild_prompt(p_slug);
  return json_build_object('ok', true);
end; $$;

-- knowledge_size kept as an alias so nothing that already calls it breaks
create or replace function knowledge_size(p_tenant uuid)
returns json language sql stable security definer set search_path = public as $$
  select knowledge_budget(p_tenant);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Wire into the guard and the dashboard payload
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function guarded_action(
  p_slug text, p_role text, p_action text, p_payload json
) returns json language plpgsql security definer set search_path = public as $$
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

  -- 'chunks' would flood the log with the whole document
  perform audit(p_slug, coalesce(p_payload->>'actor', p_role), p_role, p_action,
                nullif(p_payload->>'id',''), (p_payload - 'secret' - 'chunks'));

  return v_result;
end; $$;

create or replace function platform_documents(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'documents', (select coalesce(json_agg(json_build_object(
        'id',d.id,'filename',d.filename,'status',d.status,'pages',d.pages,
        'chunks',d.chunk_count,'words',d.word_count,'bytes',d.bytes,
        'error',d.error,'created_at',d.created_at) order by d.created_at desc), '[]'::json)
      from documents d join tenants t on t.id = d.tenant_id
      where t.slug = p_slug and d.status <> 'removed'),
    'budget', (select knowledge_budget(t.id) from tenants t where t.slug = p_slug)
  );
$$;

revoke execute on function
  save_document(text,text,json), remove_document(text,text,uuid),
  knowledge_budget(uuid), platform_documents(text)
  from public, anon, authenticated;

grant execute on function
  save_document(text,text,json), remove_document(text,text,uuid),
  knowledge_budget(uuid), platform_documents(text)
  to service_role;

-- ============================================================================
-- CHECK
--   select save_document('damai-clinic','owner', '{
--     "filename":"Refund policy.pdf","mime":"application/pdf","chunks":[
--       {"heading":"Refunds","text":"Deposits are refundable up to 24 hours before an appointment."},
--       {"heading":"Late arrivals","text":"Arriving more than 15 minutes late may mean rebooking."}]}'::json);
--   → then ask the agent "what is your refund policy?"
--
--   select knowledge_budget((select id from tenants where slug='damai-clinic'));
--   select platform_documents('damai-clinic');
-- ============================================================================
