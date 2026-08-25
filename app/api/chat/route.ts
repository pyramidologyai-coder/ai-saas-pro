/**
 * The brain. One message in, one reply out.
 *
 * Implements the 9 steps in docs/RUNTIME.md, in that order.
 * Step numbers below map 1:1 to that document — keep them in step.
 *
 * TODO markers are the work. Everything else is the contract.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { askModel } from "@/lib/llm";

const MAX_CHARS = 2000;
const COST_CAP_USD = 0.40;
const HISTORY_TURNS = 10;

export async function POST(req: NextRequest) {
  try {
    // ── 1 · Receive ─────────────────────────────────────────────────────────
    const { slug, session, message } = await req.json();

    if (!slug || !session || typeof message !== "string") {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    if (message.length > MAX_CHARS) {
      return NextResponse.json({ error: "too_long" }, { status: 400 });
    }
    // TODO rate limit: 20 messages per session per minute

    const db = supabaseAdmin();

    // ── 2 · Dedupe ──────────────────────────────────────────────────────────
    // The browser will retry. A retry must never produce a second answer.
    const minute = new Date().toISOString().slice(0, 16);
    const idempotencyKey = crypto
      .createHash("sha256")
      .update(`${session}|${message}|${minute}`)
      .digest("hex")
      .slice(0, 32);

    const { data: dupe } = await db
      .from("messages")
      .select("conversation_id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (dupe) {
      const { data: prev } = await db
        .from("messages")
        .select("body")
        .eq("conversation_id", dupe.conversation_id)
        .eq("sender_type", "ai")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return NextResponse.json({ reply: prev?.body ?? "", conversation_id: dupe.conversation_id });
    }

    // ── 3 · Resolve ─────────────────────────────────────────────────────────
    // tenant_id comes from the slug lookup, server-side. Never from the body.
    const { data: tenant } = await db
      .from("tenants")
      .select("id, name, wallet_balance_usd, timezone, default_language")
      .eq("slug", slug)
      .maybeSingle();

    if (!tenant) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const { data: employee } = await db
      .from("ai_employees")
      .select("id, persona_name, compiled_prompt, compiled_tokens, status")
      .eq("tenant_id", tenant.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!employee) return NextResponse.json({ error: "no_agent" }, { status: 503 });

    // customer + conversation: find or create
    let { data: customer } = await db
      .from("customers")
      .select("id, opted_out")
      .eq("tenant_id", tenant.id)
      .eq("external_id", session)
      .maybeSingle();

    if (!customer) {
      const { data: created } = await db
        .from("customers")
        .insert({ tenant_id: tenant.id, external_id: session })
        .select("id, opted_out")
        .single();
      customer = created!;
    }

    let { data: conversation } = await db
      .from("conversations")
      .select("id, ai_cost_usd, status")
      .eq("tenant_id", tenant.id)
      .eq("customer_id", customer.id)
      .in("status", ["open", "escalated"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conversation) {
      const { data: created } = await db
        .from("conversations")
        .insert({
          tenant_id: tenant.id,
          ai_employee_id: employee.id,
          customer_id: customer.id,
          channel: "webchat",
        })
        .select("id, ai_cost_usd, status")
        .single();
      conversation = created!;
    }

    // ── 4 · Hard blocks ─────────────────────────────────────────────────────
    // Return before spending anything. These are not warnings.
    if (customer.opted_out) {
      return NextResponse.json({ error: "opted_out" }, { status: 403 });
    }
    if (Number(tenant.wallet_balance_usd) <= 0) {
      return NextResponse.json({
        reply: "This assistant is paused right now. Someone will be with you shortly.",
        conversation_id: conversation.id,
      });
    }
    if (Number(conversation.ai_cost_usd) >= COST_CAP_USD) {
      await openEscalation(db, tenant.id, conversation.id, "cost_cap_exceeded", "cost_governor");
      return NextResponse.json({
        reply: "Let me get a colleague to help you with this — they'll be in touch shortly.",
        conversation_id: conversation.id,
      });
    }

    // ── 5 · Load ────────────────────────────────────────────────────────────
    // Read the cached prompt. Do NOT compile here (ADR-004).
    if (!employee.compiled_prompt) {
      console.error(`ai_employees ${employee.id} has no compiled_prompt`);
      return NextResponse.json({ error: "not_configured" }, { status: 503 });
    }

    const { data: history } = await db
      .from("messages")
      .select("sender_type, body")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_TURNS);

    const turns = (history ?? []).reverse().map(m => ({
      role: m.sender_type === "customer" ? ("user" as const) : ("assistant" as const),
      content: m.body,
    }));

    // ── 6 · Ask the model ───────────────────────────────────────────────────
    const started = Date.now();
    const result = await askModel({
      system: employee.compiled_prompt,
      messages: [...turns, { role: "user", content: message }],
    });
    const latencyMs = Date.now() - started;

    // ── 7 · Act ─────────────────────────────────────────────────────────────
    // TODO booking intent → check slot free → insert into bookings.
    //      The unique index on (tenant_id, scheduled_at) is the optimistic
    //      lock: on collision, tell the customer the slot just went. Do not
    //      overwrite.
    // TODO escalation intent → openEscalation() and send that message instead
    //      of the model's own reply.
    const reply = result.text;

    // ── 8 · Persist ─────────────────────────────────────────────────────────
    // Before returning. If the browser drops the response, this must survive.
    await db.from("messages").insert([
      {
        tenant_id: tenant.id,
        conversation_id: conversation.id,
        sender_type: "customer",
        body: message,
        idempotency_key: idempotencyKey,
      },
      {
        tenant_id: tenant.id,
        conversation_id: conversation.id,
        sender_type: "ai",
        body: reply,
      },
    ]);

    // The three cost numbers. Cheap now, near-impossible to backfill.
    await db.from("ai_decision_log").insert({
      tenant_id: tenant.id,
      conversation_id: conversation.id,
      ai_employee_id: employee.id,
      decision_type: "response_generated",
      model_used: result.model,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      cached_tokens: result.cachedTokens,
      actual_execution_cost: result.costUsd,
      allocated_platform_cost: 0.001,
      billable_usage_value: 0.05,
      latency_ms: latencyMs,
    });

    await db.rpc("debit_wallet", {
      p_tenant_id: tenant.id,
      p_conversation_id: conversation.id,
      p_amount_usd: result.costUsd,
    });
    // debit_wallet is defined in db/0003_functions.sql

    // ── 9 · Reply ───────────────────────────────────────────────────────────
    return NextResponse.json({ reply, conversation_id: conversation.id });

  } catch (err) {
    console.error("chat route failed:", err);
    // Never a stack trace, never a spinner that doesn't end.
    return NextResponse.json({
      reply: "Give me a moment — I'll have someone get back to you.",
    }, { status: 200 });
  }
}

async function openEscalation(
  db: ReturnType<typeof supabaseAdmin>,
  tenantId: string,
  conversationId: string,
  reason: string,
  source: string,
) {
  await db.from("escalations").insert({
    tenant_id: tenantId,
    conversation_id: conversationId,
    reason,
    trigger_source: source,
  });
  await db.from("conversations")
    .update({ status: "escalated", escalated_at: new Date().toISOString(), escalation_reason: reason })
    .eq("id", conversationId);
}
