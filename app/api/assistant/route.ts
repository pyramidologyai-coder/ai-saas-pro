/**
 * The owner's assistant, inside the dashboard.
 *
 * Separate from /api/chat because the shape of the problem is different: this
 * caller is already authenticated, already scoped to a business, and may act
 * on what it sees. Sharing a route with the public chat would mean one set of
 * guards trying to serve two very different threat models.
 *
 * Actions are referred to by the NUMBER the assistant was shown, never by id.
 * The server resolves that number against the same window it just sent.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { askModel } from "@/lib/llm";
import { sessionScope, mayTouch } from "@/lib/auth";

const DO_TAG =
  /\[\[DO\s+action="([a-z_]+)"\s+ref="(\d+)"(?:\s+when="([^"]*)")?\s*\]\]/i;

export async function POST(req: NextRequest) {
  try {
    const { slug, messages } = await req.json();
    if (!slug || !Array.isArray(messages)) {
      return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
    }

    const scope = sessionScope(req);
    if (!mayTouch(scope, slug)) {
      return NextResponse.json({ ok: false, reason: "unauthorised" }, { status: 403 });
    }
    const role = scope.role;

    const db = supabaseAdmin();

    // Which agent. If the business hasn't hired one, say so plainly rather
    // than answering from nowhere.
    const { data: agent } = await db
      .from("ai_employees")
      .select("id, persona_name, compiled_prompt")
      .eq("status", "active")
      .eq("sector_id", "owner")
      .in("tenant_id",
        (await db.from("tenants").select("id").eq("slug", slug)).data?.map(t => t.id) ?? [])
      .limit(1)
      .maybeSingle();

    if (!agent?.compiled_prompt) {
      return NextResponse.json({
        ok: false, reason: "no_assistant",
        reply: "No assistant is set up for this business yet. An owner can add " +
               "one from the AI employees page.",
      });
    }

    // How far ahead to look. "Tomorrow" and "this week" are common enough to
    // be worth reading off the last message.
    const last = String(messages[messages.length - 1]?.content ?? "");
    const days = /week/i.test(last) ? 7 : /tomorrow/i.test(last) ? 2 : 1;

    const [{ data: today }, { data: brief }] = await Promise.all([
      db.rpc("today_briefing", { p_slug: slug, p_days: days }),
      db.rpc("business_briefing", { p_slug: slug, p_days: 7 }),
    ]);

    const context =
      `\n\nTODAY (${days === 1 ? "today" : `next ${days} days`}). ` +
      `These are the only bookings you may act on, by their ref number.\n` +
      JSON.stringify(today, null, 1) +
      `\n\nTHE LAST 7 DAYS\n` + JSON.stringify(brief, null, 1);

    const now = new Date().toLocaleDateString("en-GB", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      timeZone: "Asia/Kuala_Lumpur",
    });

    const result = await askModel({
      system: `${agent.compiled_prompt}\n\nToday is ${now}.${context}`,
      messages: messages.slice(-12).map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content ?? ""),
      })),
    });

    let reply = result.text;
    let acted: string | null = null;

    const tag = reply.match(DO_TAG);
    if (tag) {
      reply = reply.replace(DO_TAG, "").trim();
      const { data: outcome } = await db.rpc("owner_action", {
        p_slug: slug, p_role: role,
        p_action: tag[1].toLowerCase(),
        p_ref: Number(tag[2]),
        p_when: tag[3] || null,
        p_days: days,
      });
      const o = outcome as any;
      acted = o?.ok ? "done" : "failed";
      // The database's own words beat a model paraphrasing what it thinks
      // happened — especially when it didn't.
      if (o?.say) reply = reply ? `${reply}\n\n${o.say}` : o.say;
      else if (!o?.ok) reply = `${reply}\n\nThat didn't work — ${String(o?.reason ?? "unknown").replace(/_/g, " ")}.`;
    }

    return NextResponse.json({ ok: true, reply, acted, agent: agent.persona_name });
  } catch (e: any) {
    console.error("assistant failed:", e?.message ?? e);
    return NextResponse.json({
      ok: false, reason: "unavailable",
      reply: "I couldn't reach the numbers just then. Try again in a moment.",
    }, { status: 500 });
  }
}
