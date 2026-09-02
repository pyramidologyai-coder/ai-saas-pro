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
import { sendEmail, bookingEmail, alertEmail } from "@/lib/email";
import { askModel } from "@/lib/llm";

const MAX_CHARS = 2000;
const COST_CAP_USD = 0.40;
const HISTORY_TURNS = 10;

export async function POST(req: NextRequest) {
  try {
    // ── 1 · Receive ─────────────────────────────────────────────────────────
    const body = await req.json();
    const { slug, session, message } = body;
    const agentSlug = typeof body?.agent === "string" && body.agent ? body.agent : null;

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

    // Domain whitelist — before spending anything.
    // The browser sets Origin; it cannot be forged by page JavaScript.
    const origin = req.headers.get("origin");
    const { data: allowed } = await db.rpc("is_domain_allowed", {
      p_slug: slug,
      p_origin: origin,
    });
    if (allowed !== true) {
      console.warn(`blocked origin "${origin}" for tenant "${slug}"`);
      return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
    }

    // Which agent. A business can run several: a public receptionist, an
    // internal HR agent, and so on. No agent named means the primary one.
    let q = db
      .from("ai_employees")
      .select("id, persona_name, compiled_prompt, compiled_tokens, status, audience, slug")
      .eq("tenant_id", tenant.id)
      .eq("status", "active");

    q = agentSlug
      ? q.eq("slug", agentSlug)
      : q.order("is_primary", { ascending: false });

    const { data: employee } = await q.limit(1).maybeSingle();

    if (!employee) return NextResponse.json({ error: "no_agent" }, { status: 503 });

    // THE GATE. An internal agent knows staff-only material — HR policy,
    // payroll process, finance rules. It must never answer an anonymous
    // visitor, whatever the origin check said.
    if (employee.audience === "internal") {
      const cookie = req.cookies.get("automology_tenant")?.value ?? "";
      const master = req.cookies.get("automology_auth")?.value ?? "";
      const ownsThis = cookie.startsWith(`${slug}:`);
      if (!ownsThis && !master) {
        console.warn(`blocked anonymous access to internal agent "${employee.slug}" (${slug})`);
        return NextResponse.json({ error: "staff_only" }, { status: 403 });
      }
    }

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
      await openEscalation(db, tenant.id, conversation.id, "cost_cap_exceeded", "cost_governor", { slug, business: tenant.name, color: (tenant as any).brand_color ?? "#1D6A8C", origin: req.nextUrl.origin, message });
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
    // The model has no clock. Without today's date it cannot resolve
    // "tomorrow" or "next Tuesday" into a real booking time.
    const today = new Date().toLocaleDateString("en-GB", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      timeZone: tenant.timezone ?? "Asia/Kuala_Lumpur",
    });

    const result = await askModel({
      system: `${employee.compiled_prompt}\n\nToday is ${today}.`,
      messages: [...turns, { role: "user", content: message }],
    });
    const latencyMs = Date.now() - started;

    // ── 7 · Act ─────────────────────────────────────────────────────────────
    let reply = result.text;

    // Escalation: the prompt tells the agent to say a colleague will follow up.
    // We detect that and record it, so the owner sees it in the dashboard.
    if (needsHuman(message, reply)) {
      await openEscalation(db, tenant.id, conversation.id, "agent_requested", "agent", { slug, business: tenant.name, color: (tenant as any).brand_color ?? "#1D6A8C", origin: req.nextUrl.origin, message });
      reply = "Let me get a colleague to help with this — someone will follow up with you shortly.";
    }

    // Booking: the agent emits a [[BOOK ...]] tag when it has all four details.
    // We strip the tag from what the customer sees, then try to save it.
    const booking = parseBookingTag(reply);
    if (booking) {
      reply = reply.replace(BOOK_TAG, "").trim();

      const { data: result } = await db.rpc("create_booking", {
        p_tenant_slug: slug,
        p_conversation_id: conversation.id,
        p_service_name: booking.service,
        p_scheduled_at: booking.when,
        p_customer_name: booking.name,
      });

      const r = result as any;
      if (r?.ok) {
        // Confirm by email if we know where to send it. Never blocks the reply.
        const email = extractEmail(message) ?? extractEmail(reply);
        if (email) {
          const mail = bookingEmail({
            business: tenant.name,
            service: r.service,
            when: formatWhen(r.scheduled_at, tenant.timezone),
            name: booking.name || "there",
            color: (tenant as any).brand_color ?? "#1D6A8C",
            phone: (tenant as any).phone ?? null,
          });
          sendEmail({ to: email, kind: "booking", tenantId: tenant.id, ...mail }).catch(() => {});
        }
        // The agent already confirmed in its own voice. Repeating it here reads
        // clumsy, so we only append if the agent somehow said nothing.
        if (!reply) {
          reply = `Booked: ${r.service}, ${formatWhen(r.scheduled_at, tenant.timezone)}. See you then, ${booking.name}.`;
        } else if (r.with) {
          // The agent doesn't know who's free until the booking is made, so the
          // practitioner's name is added after the fact rather than guessed.
          reply = `${reply}\n\nYou're with ${r.with}.`;
        }
      } else {
        reply = bookingFailureMessage(r?.reason);
      }
    }

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


// ─── Booking helpers ─────────────────────────────────────────────────────────

/**
 * The agent signals a confirmed booking with a machine-readable tag:
 *   [[BOOK service="General consultation" when="2026-09-02T15:00" name="Aisyah"]]
 * Parsing a tag is far more reliable than parsing prose, and the tag never
 * reaches the customer.
 */
const BOOK_TAG = /\[\[BOOK\s+service="([^"]+)"\s+when="([^"]+)"\s+name="([^"]*)"\s*\]\]/i;

function parseBookingTag(text: string): { service: string; when: string; name: string } | null {
  const m = text.match(BOOK_TAG);
  if (!m) return null;

  const when = new Date(m[2]);
  if (isNaN(when.getTime())) return null;   // unparseable date: treat as no booking

  return { service: m[1].trim(), when: m[2].trim(), name: (m[3] ?? "").trim() };
}

function bookingFailureMessage(reason?: string): string {
  switch (reason) {
    case "slot_taken":
      return "That slot has just been taken, sorry. Would another time work?";
    case "outside_hours":
    case "closed_that_day":
      return "We're closed at that time. Could you pick a time within our opening hours?";
    case "in_the_past":
      return "That time has already passed — which day did you have in mind?";
    case "fully_booked":
      return "We're fully booked at that time. Would another slot work?";
    case "unknown_service":
      return "I couldn't match that to one of our services. Which one did you want?";
    default:
      return "I couldn't complete that booking. Let me get a colleague to help — someone will follow up shortly.";
  }
}

function formatWhen(iso: string, timeZone?: string | null): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      weekday: "long", day: "numeric", month: "long",
      hour: "2-digit", minute: "2-digit",
      timeZone: timeZone ?? "Asia/Kuala_Lumpur",
    });
  } catch {
    return iso;
  }
}

/**
 * Cheap escalation detector for v1. The prompt does the real work — this just
 * notices when the agent handed over, so the owner sees it in the dashboard.
 * Replace with structured tool-calling when the golden tests demand it.
 */
function needsHuman(customerMsg: string, agentReply: string): boolean {
  const reply = agentReply.toLowerCase();
  const handedOver =
    reply.includes("colleague will") ||
    reply.includes("colleague to") ||
    reply.includes("someone will get back") ||
    reply.includes("pass it to the owner") ||
    reply.includes("pass this to the owner");

  const msg = customerMsg.toLowerCase();
  const urgent =
    msg.includes("refund") ||
    msg.includes("complain") ||
    msg.includes("allergic") ||
    msg.includes("reaction") ||
    msg.includes("burn") ||
    msg.includes("lawyer") ||
    msg.includes("manager");

  return handedOver || urgent;
}

async function openEscalation(
  db: ReturnType<typeof supabaseAdmin>,
  tenantId: string,
  conversationId: string,
  reason: string,
  source: string,
  notify?: { slug: string; business: string; color: string; origin: string; message: string },
) {
  await db.from("escalations").insert({
    tenant_id: tenantId,
    conversation_id: conversationId,
    reason,
    trigger_source: source,
  });

      // Tell the owner. An escalation nobody sees is the same as no escalation.
      try {
        if (notify) {
          const { data: targets } = await db.rpc("notify_targets", { p_tenant_slug: notify.slug });
          for (const to of ((targets as any)?.emails ?? []).slice(0, 3)) {
            const mail = alertEmail({
              business: notify.business,
              customer: "A visitor",
              reason,
              message: notify.message,
              color: notify.color,
              origin: notify.origin,
              slug: notify.slug,
            });
            sendEmail({ to, kind: "escalation", tenantId, ...mail }).catch(() => {});
          }
        }
      } catch { /* alerting must never break the reply */ }
  await db.from("conversations")
    .update({ status: "escalated", escalated_at: new Date().toISOString(), escalation_reason: reason })
    .eq("id", conversationId);
}


/** Pull an email address out of a message, if the customer gave one. */
function extractEmail(text: string): string | null {
  const m = text?.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0] : null;
}
