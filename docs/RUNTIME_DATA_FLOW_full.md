# RUNTIME_DATA_FLOW.md
**Version:** 1.1.1  
**Status:** Foundation Approved  
**Authority:** Ash (Founder)  
**Date:** 2026-07-09  
**Layer:** 3 — Runtime  

---

## Who reads this

Hermes reads this to understand the deterministic execution model before implementing any agent behaviour. Codex reads this to implement every component, service call, database write, and event in the correct order with the correct failure handling. Any ambiguity in agent behaviour is resolved by this document first.

## What this eliminates

After reading this document, neither Hermes nor Codex needs to ask:
- In what order do steps execute?
- What happens when authentication fails at step 2 vs step 7?
- Which component owns each write?
- When is a customer record created vs looked up?
- Where does memory load relative to LLM routing?
- What events fire and at what step?
- What constitutes a hard block and how is it enforced?
- What gets logged and when?

---

## 1. Pipeline Overview

Every inbound message — regardless of channel (WhatsApp, Voice, Webchat, SMS, Email, Instagram, TikTok, Telegram, Messenger, WebForm) — passes through the same 22-step pipeline in the same order. No step is optional. No step may be reordered.

```
══════════════════════════════════════════════════════════════════════
AUTOMOLOGY REQUEST PIPELINE — v1.0.0
══════════════════════════════════════════════════════════════════════

INBOUND MESSAGE
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ [0] EDGE ENTRY                                                  │
│     TLS termination · request_id generation · timestamp stamp   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ [1] RATE LIMITING                                               │
│     Per-tenant · per-channel · per-IP · per-phone-number        │
└────────────────────┬──────────────────┬─────────────────────────┘
                     │                  │
                   PASS              429 REJECT ──────────────────▶ END
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ [2] AUTHENTICATION                                              │
│     JWT verify · session check · API key (webhook sources)      │
└────────────────────┬──────────────────┬─────────────────────────┘
                     │                  │
                   PASS             401 REJECT ──────────────────▶ END
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ [3] TENANT RESOLUTION                                           │
│     Validate tenantId · load tenant config · plan check         │
└────────────────────┬──────────────────┬─────────────────────────┘
                     │                  │
                   PASS            403/404 REJECT ───────────────▶ END
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ [4] CHANNEL CLASSIFICATION                                      │
│     Infer channel from request source · normalise payload        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ [5] AGENT SELECTION                                             │
│     channel + intent_hint → AGENT-XXX                          │
└────────────────────┬──────────────────┬─────────────────────────┘
                     │                  │
                  MATCHED          NO AGENT ──── fallback_response ▶ END
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ [6] ROLE COMPILATION                                            │
│     Base Role Spec + Sector Patch + Tenant Config → LiveAgent   │
└────────────────────┬──────────────────┬─────────────────────────┘
                     │                  │
                   VALID          COMPILE ERR ── ALERT + fallback ▶ END
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ [7] CUSTOMER RESOLUTION                                         │
│     Lookup by phone/email · create if new · BOLA check          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ [8] MEMORY LOAD                                                 │
│     agent_memory: STM → LTM → Shared · token budget enforced    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ [9] CONVERSATION HISTORY LOAD                                   │
│     Last N turns · recency weighted · token budget cap          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ [10] INPUT CLASSIFICATION                                       │
│      Intent detection · confidence tier C1–C4 · urgency flag    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ [11] COMPLIANCE PRE-CHECK                                       │
│      Opt-out · WalletEmpty · active sanctions · hard blocks      │
└────────────────────┬──────────────────┬─────────────────────────┘
                     │                  │
                   CLEAR          BLOCKED ──── block_response ───▶ END
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ [12] LLM ROUTING                                                │
│      C1→claude-haiku · C2→claude-sonnet · C3→claude-sonnet/opus │
└────────────────────┬──────────────────┬─────────────────────────┘
                     │                  │
                  C1/C2/C3           C4 ──────── ESCALATION PATH ▶ [17]
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ [13] COGNITIVE LOOP                                             │
│      Reasoning + tool call planning · max 5 tool hops           │
└────────────────────┬──────────────────┬─────────────────────────┘
                     │                  │
                  PLANNED          TIMEOUT ── retry(3) → DLQ ───▶ END
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ [14] TOOL / ACTION EXECUTION                                    │
│      Calendar · Payment · CRM · Knowledge Base · Notifications   │
└────────────────────┬──────────────────┬─────────────────────────┘
                     │                  │
                  SUCCESS         TOOL FAIL ── compensation event
                     │                  │
                     │◀─────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ [15] RESPONSE FORMATION                                         │
│      Draft customer-facing reply · apply tone + persona          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ [16] COMPLIANCE POST-CHECK                                      │
│      PII redaction · template compliance · content safety        │
└────────────────────┬──────────────────┬─────────────────────────┘
                     │                  │
                  PASSES            FAILS ──── redact/escalate
                     │                  │
                     │◀─────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ [17] CONFIDENCE GATE                                            │
│      C3 below threshold or C4 → EscalationTriggered             │
└────────────────────┬──────────────────┬─────────────────────────┘
                     │                  │
                CONFIDENT          ESCALATE ─── EscalationTriggered
                     │                  │      (still persists + delivers)
                     │◀─────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ [18] PERSIST                                                    │
│      conversation turn · customer record · agent_memory writes   │
└────────────────────┬──────────────────┬─────────────────────────┘
                     │                  │
                  WRITTEN          WRITE ERR ── retry(3) → ALERT
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ [19] EVENT PUBLICATION                                          │
│      Publish domain events to event bus · idempotency key check  │
└────────────────────┬──────────────────┬─────────────────────────┘
                     │                  │
                 PUBLISHED          PUBLISH ERR ── DLQ
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ [20] RESPONSE DELIVERY                                          │
│      Channel adapter → customer · webhook / API send             │
└────────────────────┬──────────────────┬─────────────────────────┘
                     │                  │
                DELIVERED          DELIVERY FAIL ── retry(3) → ALERT
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ [21] OBSERVABILITY CLOSE                                        │
│      Close trace span · emit metrics · write audit_log           │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                           OUTBOUND RESPONSE

══════════════════════════════════════════════════════════════════════
```

---

## 2. Step Reference

Each step is documented with the same 8 fields. Every field is required for every step.

---

### Step 0 — Edge Entry

**Purpose:** Accept the inbound request, terminate TLS, stamp a unique request_id, and record the wall-clock arrival time. This is the single point of entry for all channels.

**Input:** Raw HTTP request or WebSocket frame from channel provider (Meta, Twilio, WhatsApp Business API, etc.)

**Output:**
```typescript
{
  request_id: string        // UUID v4 — unique for this request lifecycle
  received_at: string       // ISO8601 UTC — wall clock at ingress
  channel_raw: string       // raw source identifier before classification
  payload_raw: object       // original provider payload, unmodified
  ip_address: string        // originating IP
}
```

**Component:** API Gateway / Edge Function (`/api/inbound/[channel].ts`)

**Validation:**
- Request must arrive over TLS (HTTPS/WSS) — reject plain HTTP at infrastructure level
- Payload size limit: 10MB hard max — reject with 413 before processing

**Failure handling:**
- TLS failure: reject at infrastructure layer, no logging (not our error)
- Oversized payload: 413 response, log `inbound.oversized` metric

**Events produced:** None

**Observability:**
- Open trace span: `request.lifecycle` with `request_id`, `received_at`, `channel_raw`
- Log: `{ event: "ingress.received", request_id, channel_raw, ip_address, received_at }`

---

### Step 1 — Rate Limiting

**Purpose:** Enforce per-tenant, per-channel, per-IP, and per-phone-number rate limits before any compute or database access occurs. Rate limiting is the first line of abuse prevention.

**Input:** `request_id`, `ip_address`, `channel_raw`, `tenantId` (extracted from URL path or webhook signature header)

**Output:** `{ allowed: boolean, retry_after_ms?: number }`

**Component:** `rate-limiter.ts` (Upstash Redis sliding window)

**Rate limits (defaults — overridable per tenant plan):**

| Scope | Limit | Window |
|---|---|---|
| Per IP | 100 requests | 1 minute |
| Per tenant (all channels) | 1,000 requests | 1 minute |
| Per tenant per channel | 200 requests | 1 minute |
| Per phone number | 20 requests | 1 minute |
| Per phone number (voice) | 5 concurrent calls | — |

**Validation:**
- tenantId extracted from URL path must be present — if missing, treat as per-IP limit only
- Phone number extracted from provider payload header if available

**Failure handling:**
- Rate limit exceeded: return 429 with `Retry-After` header, log `rate_limit.exceeded` metric
- Redis unavailable: **fail open** — allow the request, log `rate_limit.redis_unavailable` alert (never reject customers because our rate limiter is down)

**Events produced:** None

**Observability:**
- Metric: `rate_limit.checked`, `rate_limit.exceeded` (with tenant_id label)
- Log on exceeded: `{ event: "rate_limit.exceeded", tenant_id, channel, ip_address, limit_type }`

---

### Step 2 — Authentication

**Purpose:** Verify that the request originates from a legitimate source. Channel providers (Meta, Twilio, WhatsApp) use webhook signatures. End-user sessions use JWTs. Internal service calls use API keys.

**Input:** Request headers (`Authorization`, `X-Hub-Signature-256`, `X-Twilio-Signature`, etc.), `request_id`

**Output:** `{ authenticated: boolean, auth_type: "jwt" | "webhook_signature" | "api_key", tenant_id?: string }`

**Component:** `auth-middleware.ts`

**Validation rules by auth type:**

| Auth Type | Source | Verification Method |
|---|---|---|
| `webhook_signature` | Meta / WhatsApp / Twilio | HMAC-SHA256 against provider secret stored in Vault |
| `jwt` | Browser / mobile session | Supabase JWT verify with project JWT secret |
| `api_key` | Internal / partner | Constant-time comparison against `api_keys` table (hashed) |

**Security rules:**
- Never log the raw token, signature, or API key
- JWT: verify `exp` claim — reject expired tokens
- Webhook: verify signature before reading payload body
- tenantId from JWT `sub` claim takes precedence over URL path tenantId — if they differ, reject with 403 (BOLA attempt)

**Failure handling:**
- Auth failure: 401, log `auth.failed` with `auth_type` and `failure_reason` (never include credential material)
- Missing header: 401 `{ error: "authentication_required" }`
- JWT expired: 401 `{ error: "token_expired" }`

**Events produced:** None

**Observability:**
- Log: `{ event: "auth.verified", request_id, auth_type, tenant_id }`
- Metric: `auth.success`, `auth.failure` (labelled by `auth_type`)

---

### Step 3 — Tenant Resolution

**Purpose:** Load the full tenant configuration, validate plan entitlements, and confirm the tenant is active. This is the point at which the request becomes tenant-scoped. Every subsequent step has access to `tenantConfig`.

**Input:** `tenant_id` (confirmed from step 2), `request_id`

**Output:**
```typescript
{
  tenant_id: string
  tenant_name: string
  plan: "starter" | "growth" | "business" | "enterprise"
  sector_id: string                     // e.g. "salon", "clinic", "restaurant"
  active_channels: Channel[]
  active_agents: AgentId[]
  locale: string                        // e.g. "en-US", "ar-SA"
  timezone: string                      // e.g. "Asia/Dubai"
  wallet_balance: number                // cents
  wallet_threshold_low: number          // cents — below this = WalletLow event
  wallet_threshold_empty: number        // cents — below this = WalletEmpty hard block
  tenant_overrides: TenantOverride[]   // from tenant_config table
  rls_context: { tenant_id: string }   // set on DB connection for RLS
}
```

**Component:** `tenant-resolver.ts` + `tenants` table (Supabase, RLS enforced)

**Validation:**
- Tenant must exist and `status = 'active'` — if `status = 'suspended'`, reject 403 with reason
- Plan entitlements checked here — if request uses a channel not in `active_channels`, reject 403
- Cache: tenant config cached in Redis for 60 seconds (TTL) — invalidated on config update

**Failure handling:**
- Tenant not found: 404 `{ error: "tenant_not_found" }`
- Tenant suspended: 403 `{ error: "tenant_suspended", reason: string }`
- Database unavailable: 503 — do not serve stale cache beyond 60s TTL

**Events produced:** None

**Observability:**
- Span attribute: `tenant_id`, `plan`, `sector_id`
- Log: `{ event: "tenant.resolved", tenant_id, plan, sector_id }`
- Cache hit/miss metric: `tenant.cache.hit`, `tenant.cache.miss`

---

### Step 4 — Channel Classification

**Purpose:** Normalise the raw inbound payload into a standard `InboundMessage` structure regardless of originating channel. After this step, all downstream processing is channel-agnostic.

**Input:** `payload_raw`, `channel_raw` from step 0, `tenantConfig.active_channels`

**Output:**
```typescript
{
  channel: "whatsapp" | "voice" | "webchat" | "sms" | "email"
         | "instagram" | "tiktok" | "telegram" | "messenger" | "webform"
  message_type: "text" | "audio" | "image" | "document" | "location" | "template_reply"
  message_body: string          // normalised text content (transcribed if audio)
  media_urls: string[]          // if applicable
  sender_phone: string | null   // E.164 format
  sender_email: string | null
  sender_name: string | null    // from provider metadata if available
  thread_id: string             // provider-level conversation/thread ID
  is_reply: boolean             // is this a reply to an outbound template?
  replied_to_template?: string  // template name if is_reply
  provider_message_id: string   // for deduplication
}
```

**Component:** `channel-adapter/[channel].ts` (one adapter per channel)

**Validation:**
- Channel must be in `tenantConfig.active_channels` — if not, 403 (already checked in step 3, double-check here)
- `provider_message_id` must be unique — duplicate detection via Redis set with 24h TTL (idempotency at channel layer)
- Audio messages: trigger transcription (Whisper or provider-native ASR) — block until transcription complete (P0/P1 timeout applies)

**Failure handling:**
- Unknown message type: classify as `text` with `message_body = "[unsupported message type]"` — do not reject
- Transcription failure: retry once, if still fails return `message_body = "[voice message — transcription unavailable]"` — do not drop message
- Duplicate `provider_message_id`: 200 OK (acknowledge to provider) but stop pipeline — log `channel.duplicate_message`

**Events produced:** None (CustomerReplied event is published at step 19 after processing completes)

**Observability:**
- Span attributes: `channel`, `message_type`, `thread_id`
- Metric: `inbound.message` labelled by `channel`, `message_type`

---

### Step 5 — Agent Selection

**Purpose:** Determine which AI employee (AGENT-001 through AGENT-012) is the primary handler for this request. Selection is based on channel, message type, and intent signals extracted from the raw message.

**Input:** `channel`, `message_type`, `message_body`, `tenantConfig.active_agents`, `tenantConfig.sector_id`

**Output:**
```typescript
{
  agent_id: "AGENT-001" | "AGENT-002" | ... | "AGENT-012"
  agent_role: string          // e.g. "AI Receptionist"
  selection_reason: string    // for observability — e.g. "channel=voice primary=AGENT-012"
  fallback_agent_id?: string  // if primary is unavailable
}
```

**Selection logic (deterministic, in priority order):**

| Condition | Selected Agent |
|---|---|
| `channel = "voice"` | AGENT-012 (AI Voice Agent) — always primary for voice |
| Intent signals: booking, appointment, schedule | AGENT-001 (AI Receptionist) |
| Intent signals: complaint, refund, issue, help | AGENT-002 (AI Customer Support) |
| Intent signals: job application, HR inquiry | AGENT-003 (AI HR Assistant) |
| Sender matches VIP list OR contact = owner/executive | AGENT-004 (AI Executive Assistant) |
| Intent signals: pricing, demo, buy, sales | AGENT-005 (AI Sales Manager) |
| Intent signals: campaign, promo, marketing | AGENT-006 (AI Marketing Manager) |
| Intent signals: invoice, payment, receipt | AGENT-007 (AI Finance Assistant) |
| `channel` in `["instagram", "tiktok", "messenger"]` | AGENT-008 (AI Social Media Manager) |
| Intent signals: review, rating, feedback | AGENT-009 (AI Review Manager) |
| Intent signals: points, loyalty, reward | AGENT-010 (AI Loyalty Manager) |
| Intent signals: operations, task, report | AGENT-011 (AI Operations Manager) |
| Default (no match) | AGENT-001 (AI Receptionist) — universal default |

**Component:** `agent-selector.ts`

**Validation:**
- Selected agent must be in `tenantConfig.active_agents` — if not, fall back to AGENT-001
- If AGENT-001 also not active: return `fallback_response` (hardcoded: "We're currently unavailable — please try again later")

**Failure handling:**
- No matching agent and no fallback: log `agent.selection.no_fallback` alert — return hardcoded fallback response, end pipeline

**Events produced:** None

**Observability:**
- Span attributes: `agent_id`, `selection_reason`
- Log: `{ event: "agent.selected", agent_id, selection_reason, channel }`

---

### Step 6 — Role Compilation

**Purpose:** Compile the Live Agent Profile by merging the Base Role Spec, the tenant's Sector Patch, and Tenant Config overrides. This is the Runtime Composition Model defined in COMPILATION_SPEC.md. The Live Agent Profile is the authoritative instruction set for the LLM.

**Input:**
- `agent_id` from step 5
- Base Role Spec: `agents/AGENT-{id}-{name}.md` (loaded from blob storage)
- Sector Patch: `agents/sectors/agent-{id}/{sector_id}.yaml` (loaded from blob storage)
- Tenant Config: `tenantConfig.tenant_overrides` (from step 3)

**Output:**
```typescript
{
  live_agent: {
    agent_id: string
    identity: {
      name: string                    // possibly overridden by tenant
      persona: string
      sector_context: string          // injected from sector patch
    }
    system_prompt: string             // fully compiled LLM system prompt
    tools_available: Tool[]           // merged and filtered by plan + sector
    decision_philosophy: string       // from v1.3 field
    priority_order: PriorityRule[]    // from v1.3 field
    memory_write_policy: WritePolicy  // from v1.3 field
    confidence_thresholds: {
      c1_max: number                  // 0.0–1.0
      c2_max: number
      c3_max: number
    }
    escalation_targets: {
      human_handoff: string | null    // phone or email
      agent_handoff: AgentId | null   // for inter-agent escalation
    }
  }
  compiled_at: string                 // ISO8601 — for cache TTL validation
}
```

**Compilation merge order (later wins on conflict):**

```
Base Role Spec (identity, core capabilities, tools)
  ↓ OVERLAID BY
Sector Patch (sector_id match required, sector_tools, sector_overrides)
  ↓ OVERLAID BY
Tenant Config (name override, persona override, banned_topics, custom_tools)
= Live Agent Profile
```

**Component:** `role-compiler.ts` + COMPILATION_SPEC.md merge algorithm

**Caching:** Live Agent Profile cached in Redis for 5 minutes. Invalidated on: sector patch update, role spec update, tenant config change. Cache key: `live_agent:{tenant_id}:{agent_id}:{sector_id}`.

**Validation:**
- Sector patch `sector_id` must match `tenantConfig.sector_id` — mismatch is a compile error
- System prompt must not exceed 8,192 tokens after compilation — if over, truncate sector context (never truncate identity or security rules)
- Required fields after compilation: `identity.name`, `system_prompt`, at least 1 tool, `escalation_targets`

**Failure handling:**
- Missing base role spec file: ALERT (PagerDuty/Slack) + serve cached version if < 1 hour old, else fallback response
- Sector patch missing for tenant sector: use `default` patch — log `compile.missing_sector_patch` warning
- Compile error (schema violation): ALERT + fallback response — never serve a malformed prompt to the LLM

**Events produced:** None

**Observability:**
- Span attributes: `agent_id`, `sector_id`, `compiled_at`, `cache_hit`
- Log: `{ event: "role.compiled", agent_id, sector_id, cache_hit, prompt_tokens }`
- Metric: `role_compilation.latency_ms`, `role_compilation.cache_hit`

---

### Step 7 — Customer Resolution

**Purpose:** Identify the customer sending this message. Create a new customer record if this is their first contact. Load their profile for use in memory and context steps. This step owns the `customers` table write.

**Input:** `sender_phone`, `sender_email`, `sender_name` from step 4, `tenant_id`

**Output:**
```typescript
{
  customer_id: string         // UUID — existing or newly created
  customer: {
    id: string
    tenant_id: string
    name: string | null
    phone: string | null      // E.164
    email: string | null
    preferred_channel: string
    preferred_timezone: string    // IANA format — resolved by ResolveCustomerTimezone()
    loyalty_tier: string | null
    loyalty_points: number
    tags: string[]
    notes: string | null
    created_at: string
    last_contact_at: string
  }
  is_new_customer: boolean
}
```

**Component:** `customer-resolver.ts` + `customers` table (Supabase, RLS enforced)

**Lookup order:**
1. Phone match (E.164, exact) — most reliable for WhatsApp/SMS/Voice
2. Email match (case-insensitive) — for email channel
3. Thread ID match (provider-level thread ID if previously linked)
4. No match → create new customer record

**Platform sub-operations (AGENT-001 v2.1.0 additions):**

These two platform functions are called inside Step 7 by `customer-resolver.ts`. They are not directly callable from the agent layer. Both run within the same database transaction as the customer lookup.

**7a — `ResolveCustomerIdentity(channel TEXT, identifier TEXT) → UUID | null`**

Encapsulates the lookup order above into a typed, reusable platform function.

| Parameter | Description |
|---|---|
| `channel` | Inbound channel: `whatsapp` \| `sms` \| `email` \| `webchat` \| `voice` \| `instagram` \| ... |
| `identifier` | Channel-specific contact value: E.164 phone for WhatsApp/SMS/Voice, email address for email channel, provider thread ID for webchat |

Returns `customer_id: UUID` if the customer exists, `null` if this is a new contact (triggers customer creation). The result becomes the authoritative `customer_id` for all downstream steps. **No other step in the pipeline may source `customer_id` from anywhere else.**

**7b — `ResolveCustomerTimezone(phone_prefix TEXT, tenant_timezone TEXT) → TEXT`**

Derives the best available IANA timezone for personalising communication timing.

| Parameter | Description |
|---|---|
| `phone_prefix` | E.164 country code extracted from sender phone (e.g. `+971`, `+44`). Pass `null` for non-phone channels. |
| `tenant_timezone` | Fallback: the IANA timezone configured in `tenant_settings.timezone` |

Resolution priority (first match wins):
1. `customers.preferred_timezone` — if already set on the resolved customer record, use it directly
2. Phone prefix country-timezone lookup — static map of E.164 prefixes to IANA zones (ambiguous multi-zone countries use the tenant timezone as tiebreaker)
3. `tenant_timezone` — default when prefix is unknown, null, or channel is non-phone

Returns an IANA timezone string (e.g. `Asia/Dubai`, `Europe/London`). **Never returns null.** If `customers.preferred_timezone` was not previously set and a timezone was resolved via prefix lookup, the resolved value is written back to `customers.preferred_timezone` within this step's transaction.

**BOLA enforcement:**
- The `customer_id` returned here is the ONLY customer_id used in all downstream steps
- Never accept a customer_id from the inbound payload — only use the server-resolved value
- All database queries use `WHERE tenant_id = $tenant_id AND id = $customer_id` — never query cross-tenant

**Events produced:**
- `CustomerCreated` — published at step 19 if `is_new_customer = true`

**Failure handling:**
- Database unavailable: do NOT create a new record — use an ephemeral customer object (in-memory only) for this request, log `customer.db_unavailable` alert
- Duplicate phone/email conflict (concurrent creation): use `INSERT ... ON CONFLICT DO UPDATE` to merge — return the existing record

**Observability:**
- Span attributes: `customer_id`, `is_new_customer`
- Log: `{ event: "customer.resolved", customer_id, is_new_customer, lookup_method }`
- Metric: `customer.created`, `customer.resolved`

---

### Step 8 — Memory Load

**Purpose:** Load all relevant agent_memory entries for this agent + customer + tenant combination. Memory provides continuity: preferences, prior outcomes, relationship context. This implements the read path defined in COMPILATION_SPEC.md Section 20.

**Input:** `agent_id`, `customer_id`, `tenant_id`, `live_agent.memory_write_policy`, token budget from `live_agent`

**Output:**
```typescript
{
  memory_context: {
    short_term: MemoryEntry[]   // expires_at in future, most recent first
    long_term: MemoryEntry[]    // no expiry or far future, relevance ranked
    shared: MemoryEntry[]       // cross-agent shared keys for this customer
  }
  memory_token_count: number    // total tokens consumed by memory context
  memory_truncated: boolean     // true if entries were dropped to fit budget
}
```

**MemoryEntry schema:**
```typescript
{
  id: string
  tenant_id: string
  agent_id: string              // "shared" for shared memory
  customer_id: string
  key_name: string              // e.g. "preferred_appointment_time"
  value: string                 // plain text or JSON string
  created_at: string
  expires_at: string | null
  source_request_id: string     // which request wrote this entry
}
```

**Load priority (COMPILATION_SPEC.md Section 20.3):**
1. Short-term memory — `expires_at > NOW()`, ordered by `created_at DESC`, limit 10 entries
2. Long-term memory — no expiry, ordered by relevance score (embedding similarity to current message), limit 5 entries
3. Shared memory — `agent_id = 'shared'`, ordered by `created_at DESC`, limit 5 entries

**Token budget enforcement:**
- Total memory context must not exceed 20% of model's context window
- If over budget: drop long-term entries first, then shared entries, never drop short-term entries
- Log `memory.truncated` if entries are dropped

**Component:** `memory-loader.ts` + `agent_memory` table (Supabase, RLS enforced)

**Validation:**
- `agent_id` must match the agent selected in step 5 — never load memory for a different agent
- `customer_id` must be the server-resolved value from step 7 — never accept from request payload
- `expires_at` filter applied server-side — never surface expired entries to the LLM
- If `memory_token_count` would exceed 20% of model context: enforce truncation (long-term first, then shared)

**Failure handling:**
- Database unavailable: resolve with empty memory context — log `memory.load_failed` warning — do not block the request
- Individual entry decode error (malformed JSON value): skip that entry, log `memory.entry_decode_error`, continue

**Events produced:** None

**Observability:**
- Log: `{ event: "memory.loaded", agent_id, customer_id, stm_count, ltm_count, shared_count, token_count, truncated }`
- Metric: `memory.load_latency_ms`, `memory.entries_loaded`

---

### Step 9 — Conversation History Load

**Purpose:** Load the recent conversation turns for this customer + thread to give the LLM continuity within an active conversation. History is distinct from memory: history is the raw exchange, memory is distilled knowledge.

**Input:** `customer_id`, `tenant_id`, `thread_id`, `agent_id`, token budget remaining after step 8

**Output:**
```typescript
{
  history: ConversationTurn[]   // ordered chronologically, most recent last
  history_token_count: number
  history_truncated: boolean
}
```

**ConversationTurn schema:**
```typescript
{
  id: string
  tenant_id: string
  customer_id: string
  agent_id: string
  thread_id: string
  role: "customer" | "agent"
  content: string
  channel: Channel
  created_at: string
  metadata: object              // tool calls, events fired, confidence_tier
}
```

**Load rules:**
- Maximum: last 20 turns (10 customer + 10 agent) OR whatever fits within remaining token budget, whichever is smaller
- Recency weighted: if budget tight, prefer last 5 turns (most recent) over older history
- Turns are always ordered chronologically for the LLM (oldest first)

**Component:** `history-loader.ts` + `conversation_turns` table (Supabase, RLS enforced)

**Validation:**
- `customer_id` and `tenant_id` must match step 7 resolution — never load cross-tenant history
- `thread_id` scopes history to the current conversation thread — do not load unrelated threads
- Token count enforced after load — truncate oldest turns first if over budget

**Failure handling:**
- Database unavailable: resolve with empty history — log `history.load_failed` warning — do not block
- Malformed turn content: skip that turn, log `history.turn_decode_error`, continue

**Events produced:** None

**Observability:**
- Log: `{ event: "history.loaded", customer_id, thread_id, turn_count, token_count, truncated }`

---

### Step 10 — Input Classification

**Purpose:** Classify the customer's message into an intent category and assign a confidence tier (C1–C4). The confidence tier determines LLM model routing in step 12 and escalation decisions in step 17.

**Input:** `message_body`, `message_type`, `live_agent.confidence_thresholds`, memory context, history context

**Output:**
```typescript
{
  intent_category: string         // e.g. "booking_request", "complaint", "inquiry", "cancellation"
  intent_confidence: number       // 0.0–1.0
  confidence_tier: "C1" | "C2" | "C3" | "C4"
  urgency: "normal" | "high" | "critical"
  sentiment: "positive" | "neutral" | "negative"
  is_opt_out_signal: boolean      // STOP, UNSUBSCRIBE, etc.
  contains_pii: boolean           // flag for extra care in logging
  language_detected: string       // ISO 639-1
}
```

**Confidence tier assignment:**

| Tier | Meaning | Threshold |
|---|---|---|
| C1 | High confidence — straightforward, known answer | intent_confidence ≥ 0.90 |
| C2 | Medium confidence — some ambiguity, standard response | intent_confidence ≥ 0.70 |
| C3 | Low confidence — complex or sensitive, needs careful response | intent_confidence ≥ 0.50 |
| C4 | No confidence — escalate immediately, do not attempt AI response | intent_confidence < 0.50 |

**Urgency signals (promote to `high` or `critical`):**
- `critical`: Emergency keywords (fire, medical, safety, police)
- `high`: Words indicating distress, legal threat, churn signal, VIP contact
- `critical` AND `channel = "voice"` → immediate escalation (skip LLM)

**Component:** `input-classifier.ts` (uses fast classification model — claude-haiku)

**Failure handling:**
- Classification fails: default to C2, `intent_category = "unknown"`, `urgency = "normal"` — log warning

**Events produced:** None (opt-out signal handled in step 11)

**Observability:**
- Log: `{ event: "input.classified", intent_category, confidence_tier, urgency, sentiment, language_detected }`
- Metric: `classification.tier` labelled by tier value

---

### Step 11 — Compliance Pre-Check

**Purpose:** Enforce hard blocks before any LLM processing occurs. Hard blocks are platform-level rules that cannot be overridden by tenants or agents. Three hard blocks exist. A blocked request still receives a response — just a deterministic one, not an LLM response.

**Input:** `customer_id`, `tenant_id`, `is_opt_out_signal`, `tenantConfig.wallet_balance`, `tenantConfig.wallet_threshold_empty`, `message_type`

**Output:** `{ allowed: boolean, block_reason?: "opt_out" | "wallet_empty" | "tenant_suspended" | "sanctioned" }`

**Hard Block 1 — OptOutRecorded**
- Trigger: `is_opt_out_signal = true` (detected in step 10) OR customer has `opt_out_status = true` in database
- Action: Immediately record opt-out to `customer_opt_outs` table, set customer `opt_out = true`
- Response: Statutory acknowledgement only ("You have been unsubscribed. Reply START to re-subscribe.")
- Enforcement: **Infrastructure layer — no outbound messages to this customer until opt-in reversal**
- All queued messages to this customer are cancelled
- Exception: Emergency/safety messages may still be sent if `urgency = "critical"`

**Hard Block 2 — WalletEmpty**
- Trigger: `tenantConfig.wallet_balance < tenantConfig.wallet_threshold_empty`
- Action: Queue all paid outbound communications (do not send), continue inbound processing
- Response: Customer receives normal response (inbound handling is not blocked)
- BUT: Any tool that costs money (SMS, WhatsApp template, Voice) is queued, not sent
- Queue released automatically when wallet top-up event `WalletTopUp` is received
- `OwnerNotified` event is fired to alert the tenant owner
- This is NOT a customer-facing block — customers still get responses

**Hard Block 3 — CalendarSlotReleased (optimistic lock)**
- Trigger: Two agents attempt to book the same calendar slot within 15 minutes
- Action: First writer wins (optimistic lock via Redis with 15-minute TTL per slot)
- Second writer receives `CalendarSlotReleased` event and must re-query availability
- Not a block on the request — a block on the specific slot booking

**Compliance checks:**
- Customer opt-out status: query `customer_opt_outs` table
- Wallet balance: from `tenantConfig` (loaded in step 3, fresh from DB)
- Active sanctions: reserved for future — check `sanctioned_numbers` list (not yet implemented — return `allowed: true` always)

**Component:** `compliance-checker.ts`

**Failure handling:**
- Cannot verify opt-out status (DB unavailable): **fail closed** — treat as opted out, do not send outbound
- Cannot verify wallet (DB unavailable): **fail open** for inbound — allow processing, block outbound tools

**Events produced:**
- `OptOutRecorded` — if `is_opt_out_signal = true`
- `WalletEmpty` — if wallet threshold breached (published at step 19)

**Observability:**
- Log: `{ event: "compliance.checked", customer_id, opt_out, wallet_balance, block_reason }`
- Metric: `compliance.blocked` labelled by `block_reason`

---

### Step 12 — LLM Routing

**Purpose:** Route the request to the appropriate LLM model based on confidence tier. Routing is deterministic — no random or A/B routing. The selected model must be capable of handling the task within the latency target.

**Input:** `confidence_tier`, `urgency`, `live_agent` profile, `tenantConfig.plan`

**Output:**
```typescript
{
  model: string                    // e.g. "claude-haiku-4-5-20251001"
  model_tier: "fast" | "standard" | "advanced"
  latency_target_ms: number        // SLA for this request
  max_tokens_response: number      // hard cap on response length
  temperature: number              // 0.0–1.0
  escalate_immediately: boolean    // true for C4
}
```

**Routing table:**

| Confidence Tier | Urgency | Model | Latency Target | Reason |
|---|---|---|---|---|
| C1 | any | claude-haiku-4-5-20251001 | < 1,000ms | Simple, high confidence |
| C2 | normal | claude-sonnet-4-6 | < 3,000ms | Standard complexity |
| C2 | high | claude-sonnet-4-6 | < 2,000ms | Expedited standard |
| C3 | normal | claude-sonnet-4-6 | < 10,000ms | Complex, careful |
| C3 | high | claude-sonnet-4-6 | < 5,000ms | Expedited complex |
| C3 | critical | — | — | Skip LLM → escalate |
| C4 | any | — | — | Skip LLM → escalate |

**Plan constraints:**
- `starter` plan: C3 tier always escalates (no Sonnet access)
- `growth` plan: C3 capped at claude-sonnet-4-6
- `business` / `enterprise`: full routing table applies

**Escalation path (C4 or critical):**
- Set `escalate_immediately = true`
- Skip steps 13–15 (cognitive loop, tool execution, response formation)
- Jump directly to step 17 (Confidence Gate) which fires `EscalationTriggered`
- The customer receives a human-handoff message: "I'm connecting you with our team now — someone will be with you shortly."

**Component:** `llm-router.ts`

**Failure handling:**
- Selected model unavailable (Anthropic outage): fall back one tier (e.g. C2 → C1 model)
- All models unavailable: return static fallback response + `EscalationTriggered`

**Events produced:** None

**Observability:**
- Log: `{ event: "llm.routed", model, confidence_tier, latency_target_ms, escalate_immediately }`
- Metric: `llm.routing` labelled by `model`, `confidence_tier`

---

### Step 13 — Cognitive Loop

**Purpose:** Execute the LLM reasoning loop. The LLM receives the compiled system prompt, customer context, memory, history, and the current message. It reasons, may plan tool calls, and produces either a tool_call request or a final response. Maximum 5 tool hops per request.

**Input:**
- `live_agent.system_prompt` (compiled in step 6)
- `memory_context` (from step 8)
- `history` (from step 9)
- `message_body` (from step 4)
- `customer` profile (from step 7)
- `live_agent.tools_available` (compiled tool list)
- `model` (from step 12)

**LLM input structure:**
```
[SYSTEM PROMPT — compiled live_agent.system_prompt]
[MEMORY — STM, LTM, Shared entries as structured context]
[CUSTOMER PROFILE — name, loyalty_tier, tags, notes]
[HISTORY — last N turns]
[CURRENT MESSAGE — customer message_body]
```

**Output:**
```typescript
{
  response_type: "tool_call" | "final_response" | "escalate"
  tool_calls?: ToolCall[]          // if response_type = "tool_call"
  draft_response?: string           // if response_type = "final_response"
  reasoning?: string                // internal CoT, never exposed to customer
  tool_hop_count: number            // 0 to 5
  llm_latency_ms: number
  input_tokens: number
  output_tokens: number
}
```

**Tool hop limit:**
- Each tool call + result counts as one hop
- After 5 hops: force `response_type = "final_response"` with whatever partial result exists
- Log `cognitive.max_hops_reached` warning

**Timeout handling:**
- Step timeout = `latency_target_ms` from step 12
- If LLM call exceeds timeout: retry once (same model, same input)
- If retry also times out: retry with faster model (one tier down)
- If all retries exhausted: `EscalationTriggered` + static fallback response

**Retry policy:**
- Attempt 1: full timeout
- Attempt 2 (same model): 50% of timeout
- Attempt 3 (fallback model): fixed 2,000ms
- After 3 attempts: escalate

**Component:** `cognitive-loop.ts` + Anthropic SDK

**Failure handling:**
- Anthropic API error (5xx): retry per above policy
- Rate limit from Anthropic (429): exponential backoff 1s → 5s → 30s
- Malformed LLM output: log `cognitive.malformed_output`, retry once, then escalate
- Tool call to unavailable tool: return tool error to LLM, let LLM recover (counts as one hop)

**Events produced:** None (events fired at step 19 after persistence)

**Observability:**
- Log: `{ event: "cognitive.complete", model, tool_hop_count, input_tokens, output_tokens, llm_latency_ms, response_type }`
- Metric: `llm.latency_ms`, `llm.input_tokens`, `llm.output_tokens` (all labelled by `model`)

---

### Step 14 — Tool / Action Execution

**Purpose:** Execute any tool calls produced by the cognitive loop. Tools have real-world effects: booking appointments, processing payments, querying databases, sending notifications. Tool execution is the only step that modifies external systems.

**Input:** `tool_calls[]` from step 13

**Available tools by agent (examples — not exhaustive):**

| Tool Name | Agent(s) | Effect | Idempotent? |
|---|---|---|---|
| `create_appointment` | AGENT-001, AGENT-012 | Writes to calendar | No — use idempotency key |
| `cancel_appointment` | AGENT-001 | Cancels calendar entry | Yes |
| `create_customer` | AGENT-001 | Writes to customers table | No |
| `create_ticket` | AGENT-002 | Writes to tickets table | No |
| `process_refund` | AGENT-002, AGENT-007 | Payment API call | No — check idempotency |
| `send_whatsapp_template` | AGENT-001, AGENT-002 | Outbound message | No |
| `query_knowledge_base` | AGENT-002 | Read-only | Yes |
| `create_deal` | AGENT-005 | CRM write | No |
| `schedule_campaign` | AGENT-006 | Marketing write | No |
| `create_invoice` | AGENT-007 | Finance write | No |
| `award_loyalty_points` | AGENT-010 | Loyalty write | No |
| `get_calendar_availability` | AGENT-001, AGENT-012 | Read-only | Yes |

**Tool execution rules:**
- Each tool call is logged to `tool_call_log` before execution (write-ahead)
- Write operations must include `idempotency_key` (format from EVENT_MATRIX.md)
- Tool result is returned to the LLM as a tool result message (counts as one hop)
- Maximum wall time per tool call: 5,000ms — timeout = tool failure

**Tool failure handling:**
- Failure: return error result to LLM (let LLM decide how to respond to customer)
- After LLM response is formed: publish compensation event (see EVENT_MATRIX.md Section 8)
- Critical tool failure (payment, calendar): fire compensation event immediately, do not wait for response
- Compensation event examples: `AppointmentBookingFailed`, `PaymentFailed`, `RefundFailed`

**Component:** `tool-executor.ts` + individual tool adapters

**Events produced (pending — published at step 19):**
- Varies by tool — all domain events are queued and published together at step 19
- Examples: `AppointmentBooked`, `LeadCreated`, `InvoiceCreated`, `LoyaltyPointsAwarded`

**Observability:**
- Log per tool call: `{ event: "tool.executed", tool_name, success, latency_ms, idempotency_key }`
- Metric: `tool.execution.latency_ms`, `tool.execution.failure` (labelled by `tool_name`)

---

### Step 15 — Response Formation

**Purpose:** Take the LLM's draft response and apply persona formatting, channel-specific constraints (character limits, template requirements), and language adaptation. The output is a customer-ready message — not yet validated for compliance.

**Input:** `draft_response` from step 13, `live_agent.identity`, `channel`, `tenantConfig.locale`, `customer.preferred_channel`

**Output:**
```typescript
{
  response_text: string         // formatted, channel-appropriate message
  response_type: "text" | "template" | "interactive" | "voice_tts"
  template_name?: string        // WhatsApp template name if applicable
  template_vars?: object        // template variable values
  character_count: number
  language: string              // ISO 639-1 — matches customer's language
}
```

**Formatting rules by channel:**

| Channel | Max Characters | Format Constraints |
|---|---|---|
| whatsapp | 4,096 | Markdown-lite (bold, italic, lists) |
| sms | 160 / 1,600 (concatenated) | Plain text only |
| voice | 500 words | SSML output for TTS |
| email | unlimited | HTML allowed |
| webchat | 2,000 | Markdown |
| instagram / messenger | 1,000 | Plain text only |

**WhatsApp template rules:**
- Proactive outbound messages (not replies to customer) MUST use approved templates
- Template selection: match intent to template name from tenant's approved template list
- Template variable values extracted from tool results (e.g. `appointment_datetime`, `customer_name`)
- If no matching template exists for the intent: `EscalationTriggered` — do not send free-form proactive message

**Voice TTS rules:**
- Strip markdown, special characters
- Apply pause markers (`<break time="500ms"/>` between sentences)
- Max 500 words — if LLM response is longer, summarise

**Component:** `response-formatter.ts` + channel-specific formatters

**Failure handling:**
- Character limit exceeded: truncate with "..." and append "Reply for more details"
- Template not found for proactive: fallback to escalation

**Events produced:** None

**Observability:**
- Log: `{ event: "response.formed", channel, response_type, character_count, language }`

---

### Step 16 — Compliance Post-Check

**Purpose:** Final validation before delivery. Prevent PII leakage, verify content safety, and check that outbound templates are compliant with provider policies. This is the last safety gate before the customer sees any content.

**Input:** `response_text`, `customer`, `channel`, `template_name` (if applicable)

**Output:**
```typescript
{
  response_text: string         // possibly redacted from step 15 version
  passed: boolean               // true if all checks pass or issues were auto-resolved
  actions_taken: string[]       // e.g. ["pii_redacted", "marketing_stripped"]
  escalate: boolean             // true if content violation requires human handoff
  escalation_reason?: string    // only present if escalate = true
}
```

**Checks performed:**

| Check | What It Does | Failure Action |
|---|---|---|
| PII redaction | Scan for credit card, SSN, passport patterns | Redact with `[REDACTED]` |
| Phone number exposure | Scan for E.164 patterns belonging to others | Redact |
| Content safety | Profanity, hate speech, medical advice, legal advice | Escalate or redact |
| Template compliance | WhatsApp template matches approved body exactly | Reject — use fallback |
| Language match | Response language matches customer's detected language | Re-translate or flag |
| Opt-out compliance | No marketing content to opted-out customers | Remove marketing content |

**Component:** `compliance-post-checker.ts`

**Failure handling:**
- PII detected and redacted: log `compliance.pii_redacted` alert (never log the actual PII)
- Content safety violation: escalate (`EscalationTriggered`) + do not send the original response
- Template mismatch: fall back to previous approved template version if available, else escalate

**Events produced:** None

**Observability:**
- Log: `{ event: "compliance.post_check", pii_detected, content_safe, template_compliant }`
- Alert on: `pii_detected = true`, `content_safe = false`

---

### Step 17 — Confidence Gate

**Purpose:** Make the final escalation decision. Even if the LLM produced a response, this step may override it and route to human handoff if the agent is not confident enough for the situation. Every escalation fires `EscalationTriggered`.

**Input:** `confidence_tier`, `urgency`, `live_agent.escalation_targets`, `response_type` from step 13, `escalate` from step 16

**Output:**
```typescript
{
  proceed: boolean              // true = deliver AI response; false = deliver escalation message
  escalated: boolean            // true if any escalation trigger fired
  escalation_reason?: string    // "c4" | "critical_urgency" | "llm_self_escalated" | "compliance" | "technical" | "tenant_config"
  delivery_text: string         // FINAL text to deliver — either the AI response or the escalation message
  create_ticket: boolean        // true if a support ticket should be created as part of this escalation
}
```

**Escalation triggers (any one is sufficient):**

| Condition | Escalation Type |
|---|---|
| `confidence_tier = C4` | Immediate escalation — no AI response sent |
| `urgency = critical` | Immediate escalation |
| `response_type = "escalate"` (LLM self-escalated) | AI-initiated escalation |
| Post-check compliance failure | Compliance-driven escalation |
| Cognitive loop exhausted 3 retries | Technical escalation |
| Tenant has `auto_escalate_all = true` | Tenant-configured escalation |

**Escalation routing:**
1. `live_agent.escalation_targets.agent_handoff` — inter-agent escalation (e.g. AGENT-012 → AGENT-001 for booking follow-up)
2. `live_agent.escalation_targets.human_handoff` — route to human (phone, email, or CRM ticket)
3. No escalation target configured: create support ticket + notify `OwnerNotified` event

**Customer message on escalation:**
- "I'm connecting you with our team. Someone will be with you within [response_time_sla]."
- SLA comes from `tenantConfig.human_response_sla` — default "shortly"

**Component:** `confidence-gate.ts`

**Events produced (queued for step 19):**
- `EscalationTriggered` — always fired on any escalation path

**Failure handling:** No failure path — if confidence gate logic errors, default to escalation (fail safe)

**Observability:**
- Log: `{ event: "escalation.triggered", reason, escalation_type, escalation_target }`
- Metric: `escalation.triggered` labelled by `reason`

---

### Step 18 — Persist

**Purpose:** Write all state changes produced by this request to the database. This is the single point of truth for all writes. Writes happen after the response is formed to avoid polluting state on failed requests, but before delivery to ensure idempotency on retry.

**Write order (must preserve this sequence):**

```
1. conversation_turns    — INSERT the current message (customer role)
2. conversation_turns    — INSERT the agent response (agent role)
3. customers             — UPDATE last_contact_at, preferred_channel, language
4. customers             — UPDATE loyalty_points / tier if changed by tool
5. agent_memory          — INSERT/UPSERT new STM entries (per memory_write_policy)
6. agent_memory          — UPDATE existing LTM entries if value changed
7. [domain table]        — Any writes made by tools (appointments, tickets, etc.)
                           These were already written in step 14 — this step
                           verifies write success, does not re-write
8. tool_call_log         — UPDATE status to "completed" or "failed"
```

**Memory write policy (from `live_agent.memory_write_policy`):**

| Policy | Behaviour |
|---|---|
| `always` | Write STM entry for every interaction |
| `on_significant` | Write only if tool call occurred or confidence was C3 |
| `on_explicit` | Write only if LLM explicitly requested a memory save |
| `never` | Do not write any memory entries |

**agent_memory expiry rules:**
- STM entries: `expires_at = NOW() + 7 days` (default, configurable per agent)
- LTM entries: `expires_at = NULL` (never expires unless explicitly overwritten)
- Shared memory: `expires_at = NULL`

**Component:** `persist.ts` (wraps all writes in a single Supabase transaction where possible)

**Failure handling:**
- Transaction fails: retry 3 times with exponential backoff (1s → 5s → 30s)
- After 3 retries: log `persist.failed` ALERT — the response is still delivered (customer experience is preserved), but state is inconsistent — requires manual reconciliation
- Partial write (some writes succeed, some fail): log each failed write individually for reconciliation

**Events produced:** None (events are queued from prior steps and published next)

**Observability:**
- Log: `{ event: "persist.complete", writes: [{table, operation, success}], latency_ms }`
- Metric: `persist.latency_ms`, `persist.failed`

---

### Step 19 — Event Publication

**Purpose:** Publish all domain events accumulated during this request to the event bus. Events are published after persistence to ensure the state they describe already exists in the database when subscribers read it.

**Input:** All queued events from steps 7, 11, 14, 17

**Event publication rules:**
- Each event gets an `idempotency_key` in format: `{event_name}:{tenant_id}:{entity_id}:{timestamp_ms}`
- Check `event_log` for existing `idempotency_key` before publishing — if exists, skip (deduplication)
- Insert into `event_log` first, then publish to bus — if bus publish fails, retry from `event_log`
- All events for one request are published together (batch where possible)

**Event log write (before bus publish):**
```sql
INSERT INTO event_log (tenant_id, event_name, publisher, payload, idempotency_key, published_at)
VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
ON CONFLICT (idempotency_key) DO NOTHING;
```

**Retry on bus failure:**
- Attempt 1: immediate
- Attempt 2: 1s delay
- Attempt 3: 5s delay
- After 3 failures: insert to `event_dlq` table (schema from EVENT_MATRIX.md Section 10.2)

**DLQ recovery (Codex responsibility):**
- A background pg_cron job runs every 5 minutes: `SELECT * FROM event_dlq WHERE resolved = FALSE ORDER BY first_failed_at ASC LIMIT 50`
- For each DLQ entry: attempt to re-publish to event bus
- On success: `UPDATE event_dlq SET resolved = TRUE, resolved_at = NOW()`
- On failure: increment `attempt_count`, update `last_failed_at`
- After 10 total attempts: do NOT auto-resolve — flag for manual review, set `manual_review_required = TRUE`
- Alert: if any tenant has > 10 unresolved DLQ entries per hour, fire Slack alert
- The same idempotency key check (`event_log`) prevents duplicate publication on replay

**Events published in this request (typical booking flow example):**
- `CustomerCreated` (if new customer)
- `AppointmentBooked` (from tool in step 14)
- `DepositRequested` (if deposit required)
- `AppointmentReminderSent` (if reminder was scheduled)

**Component:** `event-publisher.ts` + `event_log` table + event bus (Supabase Realtime or Postgres NOTIFY)

**Failure handling:**
- Idempotency key collision (duplicate): skip silently, log `event.duplicate_skipped`
- DLQ: monitor `event_dlq.resolved = false` — alert if count > 10 per tenant per hour

**Events produced:** All queued events from this request lifecycle

**Observability:**
- Log: `{ event: "events.published", event_names: [], count, dlq_count }`
- Metric: `events.published`, `events.dlq` (labelled by `event_name`)

---

### Step 20 — Response Delivery

**Purpose:** Send the formatted, validated response to the customer via the appropriate channel adapter. This is the only step that communicates with external provider APIs (Meta, Twilio, etc.).

**Input:** `response_text`, `response_type`, `template_name`, `channel`, `thread_id`, `sender_phone`, `sender_email`, `tenantConfig.wallet_balance`

**Wallet gate (WalletEmpty enforcement):**
- If `tenantConfig.wallet_balance < wallet_threshold_empty`:
  - Inbound text replies: **still sent** (responses to customer messages are not blocked)
  - Proactive outbound (templates, reminders): **queued** — do not send
  - Queue entry: `{ tenant_id, payload, queued_at, release_on: "WalletTopUp" }`

**Channel delivery:**

| Channel | API | Delivery Confirmation |
|---|---|---|
| whatsapp | WhatsApp Business API | Message ID returned |
| sms | Twilio / provider SMS | Message SID returned |
| voice | Twilio Voice / provider | Call SID returned |
| email | SendGrid / provider | Message ID returned |
| webchat | WebSocket push | Acknowledgement frame |
| instagram | Meta Graph API | Message ID returned |

**Delivery retry:**
- Timeout per attempt: 10,000ms
- Retry 3 times with exponential backoff (2s → 10s → 60s)
- After 3 failures: log `delivery.failed` ALERT, create support ticket for manual follow-up

**Component:** `delivery-adapter/[channel].ts` + provider SDKs

**Failure handling:**
- Provider API rate limit: exponential backoff, do not retry with fixed delay
- Provider API unavailable: queue message for retry up to 1 hour — after 1 hour, alert + create ticket
- WalletEmpty proactive block: queue silently — customer experience is NOT impacted (they weren't expecting the message)

**Events produced (if delivery fails):**
- `DeliveryFailed` — (future event, not yet in EVENT_MATRIX v1.0.0 — flag for v1.1.0)

**Observability:**
- Log: `{ event: "response.delivered", channel, message_id, delivery_latency_ms }`
- Log on failure: `{ event: "delivery.failed", channel, attempt_count, failure_reason }`
- Metric: `delivery.success`, `delivery.failed`, `delivery.latency_ms` (all labelled by `channel`)

---

### Step 21 — Observability Close

**Purpose:** Close the request trace span, emit aggregate metrics, write the audit log entry, and release any resources allocated for this request. Every request ends here — even failed requests that exited early.

**Input:** All span attributes and metrics accumulated across all steps

**Audit log entry:**
```typescript
{
  id: string                        // UUID v4
  tenant_id: string
  request_id: string                // from step 0
  customer_id: string | null        // from step 7 (null if failed before step 7)
  agent_id: string | null           // from step 5
  channel: string                   // from step 4
  confidence_tier: string           // from step 10
  model_used: string                // from step 12
  intent_category: string           // from step 10
  tool_calls_count: number          // from step 14
  escalated: boolean                // from step 17
  events_published: string[]        // from step 19
  total_latency_ms: number          // wall clock from step 0 to step 21
  input_tokens: number              // from step 13
  output_tokens: number             // from step 13
  status: "success" | "escalated" | "blocked" | "failed"
  failure_reason: string | null
  created_at: string                // ISO8601
}
```

**Aggregate metrics emitted:**
- `request.total_latency_ms` — full pipeline wall clock, labelled by `channel`, `confidence_tier`, `model`
- `request.status` — success / escalated / blocked / failed
- `request.cost_units` — token-based cost metric for billing

**Trace span close:**
- Add final attributes: `status`, `total_latency_ms`, `escalated`, `events_published[]`
- Close the root span opened in step 0

**Resource cleanup:**
- Release Redis locks (calendar slot locks, rate limit counters remain)
- Clear request-scoped in-memory context

**Component:** `observability.ts` + `audit_log` table + metrics pipeline (Prometheus / DataDog)

**Failure handling:** Observability failure must never block or delay the request. Observability writes are fire-and-forget with async retry. If audit_log write fails 3 times: log to stderr (never lose the audit entry entirely).

**Events produced:** None

**Observability:** This step IS the observability — it writes the final record.

---

## 3. Fallback Response Definitions

Three system-level fallback messages are used when the pipeline cannot produce an AI-generated response. These are hardcoded strings — they do NOT go through the LLM, the cognitive loop, or compliance post-check. They are always safe to send.

| Fallback ID | Trigger Condition | Message Text |
|---|---|---|
| `FALLBACK_NO_AGENT` | Step 5: no matching agent and no default available | "Thank you for reaching out. Our team will be with you shortly." |
| `FALLBACK_COMPILE_ERROR` | Step 6: role compilation failed | "Thank you for reaching out. Our team will be with you shortly." |
| `FALLBACK_TECHNICAL` | Step 12: all models unavailable / step 13: all retries exhausted | "We're experiencing a brief interruption. Someone from our team will follow up with you soon." |
| `FALLBACK_ESCALATION` | Step 17: any escalation trigger | "I'm connecting you with our team. Someone will be with you within [tenant.human_response_sla]." |

**Rules:**
- Fallback messages are sent in the customer's detected language (step 10) if translation is cached; otherwise in `tenantConfig.locale` default
- `[tenant.human_response_sla]` is replaced with `tenantConfig.human_response_sla` or "shortly" if not configured
- Fallback messages do NOT fire domain events (no CustomerReplied, no AppointmentBooked, etc.)
- Fallback messages ARE written to `conversation_turns` table so the interaction is traceable
- `EscalationTriggered` IS fired when using `FALLBACK_ESCALATION`

---

## 5. Failure Reference

Consolidated view of all failure modes across the pipeline, their responses, and recovery paths.

| Step | Failure | Response | Recovery |
|---|---|---|---|
| 0 | Oversized payload (>10MB) | 413 | Reject |
| 1 | Rate limit exceeded | 429 + Retry-After | Client retry after window |
| 1 | Redis unavailable | Allow (fail open) | Alert + monitor |
| 2 | Auth failure | 401 | Reject |
| 2 | JWT expired | 401 `token_expired` | Client refreshes token |
| 3 | Tenant not found | 404 | Reject |
| 3 | Tenant suspended | 403 | Reject with reason |
| 4 | Duplicate provider_message_id | 200 (ack) + stop | Idempotent — safe to ignore |
| 4 | Transcription failure | Process with placeholder text | Alert |
| 5 | No matching agent | Hardcoded fallback response | Alert if persistent |
| 6 | Missing role spec | Serve cached (<1h) or fallback | Alert + page on-call |
| 6 | Compile error | Fallback response | Alert + page on-call |
| 7 | DB unavailable (customer) | Ephemeral customer | Alert + monitor |
| 8 | DB unavailable (memory) | Empty memory context | Alert (degraded, not failed) |
| 9 | DB unavailable (history) | Empty history | Alert (degraded, not failed) |
| 10 | Classification fails | Default C2, unknown intent | Warning |
| 11 | Cannot verify opt-out | Treat as opted out (fail closed) | Alert + manual review |
| 12 | All models unavailable | Static fallback + escalation | Alert + page on-call |
| 13 | LLM timeout (all retries) | Escalation + static response | Alert |
| 13 | Malformed LLM output | Retry once, then escalate | Warning |
| 14 | Tool timeout | Tool error → LLM → compensation event | Warning |
| 15 | Template not found | Escalation | Warning |
| 16 | PII detected | Redact + deliver | Alert (audit) |
| 16 | Content safety violation | Escalate + do not deliver | Alert |
| 18 | Persist failure (all retries) | Deliver response, state inconsistent | ALERT — manual reconciliation |
| 19 | Bus publish failure (all retries) | DLQ | Monitor DLQ |
| 20 | Delivery failure (all retries) | ALERT + create ticket | Manual follow-up |
| 21 | Audit log failure | Log to stderr | Async retry |

---

## 6. Hard Block Reference

Hard blocks are immutable platform-level enforcement rules. No tenant configuration, agent instruction, or runtime condition can bypass them. They are enforced at step 11 (pre) and respected throughout all subsequent steps.

### Hard Block 1 — OptOutRecorded

```
Trigger:   Customer sends opt-out keyword (STOP, UNSUBSCRIBE, CANCEL, END, QUIT)
           OR customer.opt_out_status = true in database

Enforcement:
  - Write opt_out record to customer_opt_outs table BEFORE any other processing
  - Set customer.opt_out = true (immediate, synchronous)
  - Cancel ALL queued outbound messages for this customer
  - Return statutory response: "You have been unsubscribed. Reply START to re-subscribe."
  - Block ALL future outbound to this customer until opt-in reversal

Exceptions:
  - Emergency/safety messages (urgency = "critical") may still be sent
  - Transactional responses to customer-initiated messages are allowed

Reversal:
  - Customer sends START, YES, SUBSCRIBE, UNSTOP
  - Set customer.opt_out = false
  - Respond: "You have been re-subscribed. Reply STOP to unsubscribe at any time."

Codex: Enforce at infrastructure layer — no application code should be able to send
       outbound to an opted-out customer regardless of the sending agent or context.
```

### Hard Block 2 — WalletEmpty

```
Trigger:   tenant.wallet_balance < tenant.wallet_threshold_empty

Enforcement:
  - Inbound processing: CONTINUES NORMALLY
  - AI response to inbound: SENT (responses to customer messages are not blocked)
  - Outbound templates / proactive messages: QUEUED (not sent)
  - Voice calls (outbound): QUEUED
  - SMS (outbound): QUEUED
  - Queue release: automatic on WalletTopUp event

Queue behaviour:
  - Queue entry: { tenant_id, channel, payload, queued_at, release_on: "WalletTopUp" }
  - Queue TTL: 24 hours — discard if wallet not topped up within 24 hours
  - On WalletTopUp: dequeue all entries for tenant, send in order

Side effects:
  - OwnerNotified event fired immediately
  - WalletEmpty event fired and published to event bus
  - WalletLow event was already fired at threshold_low (earlier warning)

Codex: Wallet balance check must happen BEFORE any outbound API call in delivery-adapter.
       The compliance pre-check (step 11) sets a flag; delivery-adapter (step 20) enforces it.
```

### Hard Block 3 — Calendar Slot Optimistic Lock

```
Trigger:   Two agents attempt to book the same tenant+date+time slot simultaneously

Enforcement:
  - Lock key: "slot:{tenant_id}:{date}:{time}" in Redis
  - TTL: 15 minutes
  - First writer: acquires lock, proceeds with booking
  - Second writer: receives "slot unavailable" — must re-query calendar

On lock expiry:
  - CalendarSlotReleased event is published
  - Any waitlisted customer (WaitlistAdded) is contacted within 15 minutes

Codex: Use Redis SETNX for atomic lock acquisition. Never book a slot without first
       acquiring the lock. Lock must be released on booking cancellation.
```

---

## 7. Confidence Tier Reference

| Tier | Meaning | LLM Model | Latency SLA | Examples |
|---|---|---|---|---|
| C1 | High confidence — clear intent, factual answer | claude-haiku | < 1,000ms | "What are your hours?" / "Book me for tomorrow at 10am" |
| C2 | Standard confidence — some ambiguity | claude-sonnet | < 3,000ms | "I want to reschedule" / "What services do you offer?" |
| C3 | Low confidence — complex, sensitive, multi-step | claude-sonnet | < 10,000ms | Complaint with legal language / Multi-step booking with special requirements |
| C4 | No confidence — escalate immediately | None | Immediate | Threat / Emergency / Completely unrecognised input |

---

## 8. Observability Contract

Every request must produce the following signals, regardless of how it exits the pipeline.

### 6.1 Required Trace Span Attributes

```
request_id          — UUID, from step 0
tenant_id           — from step 3
agent_id            — from step 5 (null if failed before)
channel             — from step 4
confidence_tier     — from step 10
model               — from step 12
intent_category     — from step 10
escalated           — boolean, from step 17
status              — "success" | "escalated" | "blocked" | "failed"
total_latency_ms    — wall clock from step 0 to step 21
```

### 6.2 Required Metrics

| Metric | Type | Labels |
|---|---|---|
| `request.total_latency_ms` | Histogram | `channel`, `confidence_tier`, `model`, `status` |
| `request.count` | Counter | `channel`, `confidence_tier`, `status` |
| `llm.latency_ms` | Histogram | `model`, `confidence_tier` |
| `llm.input_tokens` | Histogram | `model` |
| `llm.output_tokens` | Histogram | `model` |
| `tool.execution.latency_ms` | Histogram | `tool_name` |
| `tool.execution.failure` | Counter | `tool_name` |
| `escalation.triggered` | Counter | `reason` |
| `delivery.latency_ms` | Histogram | `channel` |
| `delivery.failed` | Counter | `channel` |
| `events.published` | Counter | `event_name` |
| `events.dlq` | Counter | `event_name` |
| `rate_limit.exceeded` | Counter | `channel` |
| `memory.entries_loaded` | Histogram | `memory_type` |

### 6.3 Alert Thresholds (defaults — tunable per deployment)

| Condition | Severity | Action |
|---|---|---|
| `request.total_latency_ms p99 > 15,000ms` | High | PagerDuty |
| `escalation.triggered rate > 30% over 5min` | High | Slack alert |
| `delivery.failed rate > 5% over 5min` | High | PagerDuty |
| `events.dlq count > 10 per tenant per hour` | Medium | Slack alert |
| `persist.failed` (any) | High | PagerDuty |
| `compile error` (any) | Critical | PagerDuty |
| `role spec missing` (any) | Critical | PagerDuty |
| `llm.latency_ms p99 > 30,000ms` | High | Slack alert |

---

## 9. Codex Implementation Contracts

### CONTRACT-1 — Pipeline Execution Order

```
Codex MUST implement all 22 steps in the order defined in this document.
No step may be skipped (except steps 13–15 on C4/critical escalation path).
No step may be reordered.
Each step must complete before the next begins (no parallelism across steps).

EXCEPTION — Steps 8 and 9 run concurrently:
  Steps 8 (Memory Load) and 9 (History Load) are independent and MUST execute in parallel.
  They query different tables (agent_memory vs conversation_turns) with no shared state.

  Join behavior (REQUIRED):
  - Both steps run with individual timeouts (30ms target each).
  - Step 10 begins ONLY after BOTH steps have either completed or timed out.
  - A timeout or DB failure in step 8 produces empty memory_context (not a pipeline failure).
  - A timeout or DB failure in step 9 produces empty history (not a pipeline failure).
  - If step 8 finishes in 15ms and step 9 fails immediately, step 10 begins immediately with
    the step 8 result and empty history. Do not wait for a failed step to recover.
  - Implementation: use Promise.all([loadMemory(), loadHistory()]) — both branches resolve
    (never reject) because each handles its own failure with an empty fallback.
```

### CONTRACT-2 — Request ID Propagation

```
The request_id generated in step 0 MUST be present in:
  - All log entries for this request
  - All trace span attributes
  - The audit_log entry (step 21)
  - All event payloads published in step 19 (as metadata.request_id)
  - All tool_call_log entries
  - The HTTP response header: X-Request-ID

Codex: Pass request_id through context (not function arguments) using AsyncLocalStorage.
```

### CONTRACT-3 — Tenant Isolation

```
After step 3, ALL database queries MUST include WHERE tenant_id = $tenant_id.
The Supabase RLS context MUST be set on the connection before any query executes.
Never bypass RLS. Never accept tenant_id from the inbound payload.
The only authoritative tenant_id comes from the JWT (step 2) or webhook signature (step 2).
```

### CONTRACT-4 — Hard Block Enforcement

```
OptOutRecorded:
  - Codex MUST check opt_out status in step 11 before any outbound tool is called
  - Codex MUST set the RLS-enforced opt_out flag on customer record
  - No outbound tool call may proceed if customer.opt_out = true

WalletEmpty:
  - Codex MUST check wallet_balance in step 11
  - The delivery-adapter (step 20) MUST re-check wallet_balance before each outbound send
  - Paid outbound tools (WhatsApp template, SMS, Voice) MUST check wallet in tool-executor (step 14)

CalendarSlotLock:
  - Codex MUST use Redis SETNX with 15-minute TTL before any calendar write
  - Never write to the calendar without first acquiring the slot lock
```

### CONTRACT-5 — Memory Write Timing

```
Memory writes happen ONLY in step 18 (Persist).
No memory write may occur in step 13 (Cognitive Loop) or step 14 (Tool Execution).
The LLM may request a memory save (via tool call or structured output) — this is QUEUED,
not executed, until step 18.

If the pipeline exits before reaching step 18 for ANY reason — compliance failure
(step 16), confidence gate escalation (step 17), technical error, timeout, or 
blocked request (step 11) — the memory write queue MUST be discarded.
Memory is never written for incomplete interactions.

Rationale: Memory represents what the agent learned from a completed interaction.
A failed, blocked, or escalated interaction produced no reliable outcome to remember.
Writing partial memory from an incomplete interaction corrupts the agent's understanding
of the customer relationship.

Exception: Escalation (step 17) DOES proceed to step 18 — escalation is a completed
interaction (the agent decided to escalate, the customer was told, the ticket was created).
The escalation outcome IS worth remembering.
```

### CONTRACT-6 — Event Publication Timing

```
Events are QUEUED throughout the pipeline and published ONLY in step 19.
Events MUST NOT be published before step 18 (Persist) completes.
Rationale: Events describe state that exists in the database. Publishing before
persistence means subscribers may read state that doesn't exist yet.

Exception: WalletEmpty and OptOutRecorded may be published immediately on detection
(step 11) because they are enforcement events, not state-change events.
```

### CONTRACT-7 — Idempotency

```
Every write operation (database and tool) MUST use idempotency keys.
Format: {operation_name}:{tenant_id}:{entity_id}:{timestamp_ms}

Database writes: use INSERT ... ON CONFLICT DO NOTHING or DO UPDATE
Event publication: check event_log.idempotency_key before publishing
Tool calls: pass idempotency_key to all external APIs that support it
Calendar bookings: use Redis SETNX slot lock (CONTRACT-4)

If Codex receives the same request_id twice (duplicate delivery from provider):
  - Step 4 (channel classification) detects duplicate via provider_message_id
  - Return 200 to provider (acknowledge receipt)
  - Stop pipeline — do not reprocess
```

### CONTRACT-8 — Logging Constraints

```
NEVER log:
  - JWT tokens, API keys, or webhook secrets
  - Customer PII in plain text (use customer_id, not name/phone/email)
  - Service role key (this key must never appear in any log, ever)
  - Full card numbers, CVVs, or payment credentials

ALWAYS log:
  - request_id on every log entry
  - tenant_id on every log entry
  - event name (structured field, not embedded in message string)
  - Latency for every step that makes an external call
```

---

## 10. Latency Budget

For a P1 (high priority) request, the full pipeline should complete in under 3,000ms. Here is the target budget per step:

| Step | Target | Notes |
|---|---|---|
| 0 — Edge Entry | < 5ms | TLS overhead |
| 1 — Rate Limiting | < 10ms | Redis read |
| 2 — Authentication | < 15ms | JWT verify (CPU) |
| 3 — Tenant Resolution | < 20ms | Redis cache hit |
| 4 — Channel Classification | < 50ms | Including transcription if audio |
| 5 — Agent Selection | < 5ms | In-memory logic |
| 6 — Role Compilation | < 30ms | Redis cache hit |
| 7 — Customer Resolution | < 30ms | DB indexed lookup |
| 8 — Memory Load | < 30ms | DB indexed lookup |
| 9 — History Load | < 30ms | DB indexed lookup |
| 10 — Input Classification | < 200ms | Fast model inference |
| 11 — Compliance Pre-Check | < 20ms | DB read + Redis read |
| 12 — LLM Routing | < 5ms | In-memory decision |
| 13 — Cognitive Loop | < 1,500ms | Model-dependent (C1 budget) |
| 14 — Tool Execution | < 500ms | External API (calendar, DB) |
| 15 — Response Formation | < 50ms | String processing |
| 16 — Compliance Post-Check | < 50ms | Pattern matching |
| 17 — Confidence Gate | < 5ms | In-memory decision |
| 18 — Persist | < 100ms | DB writes (batched) |
| 19 — Event Publication | < 50ms | Bus write + event_log |
| 20 — Response Delivery | < 300ms | External API (provider) |
| 21 — Observability Close | < 10ms | Async — non-blocking |
| **Total (C1 budget)** | **< 3,000ms** | **P1 SLA** |

Steps 8 and 9 execute in parallel — combined budget: 30ms.
Audio transcription (step 4) adds ~500ms — voice requests have extended P1 SLA of 3,500ms.

---

*RUNTIME_DATA_FLOW.md — v1.0.0 — Layer 3 Runtime. This document is read by Hermes before implementing any agent behaviour and by Codex before writing any pipeline component. Updates require Ash approval.*
