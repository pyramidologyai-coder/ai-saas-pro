/**
 * POST /api/ask — the owner asking about their own business.
 *
 * Behind the dashboard gate, so the session already proves who they are. The
 * insights agent is created on first use rather than needing a setup step:
 * nobody should have to run SQL to ask how many bookings they had.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { AUTH_COOKIE, TENANT_COOKIE, roleFromTenantCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { slug, session, message } = await req.json();
    if (!slug || !message) {
      return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
    }

    const role = req.cookies.get(AUTH_COOKIE)?.value
      ? "owner"
      : roleFromTenantCookie(req.cookies.get(TENANT_COOKIE)?.value) ?? "viewer";

    // Figures about the business are for the people who run it.
    if (!["owner", "manager"].includes(role)) {
      return NextResponse.json({
        ok: false, reason: "not_allowed",
        reply: "Your role can see the dashboard but not the business figures.",
      }, { status: 403 });
    }

    const db = supabaseAdmin();

    // Make sure there's an agent to talk to.
    const { data: agents } = await db.rpc("list_agents", { p_tenant_slug: slug });
    let owner = ((agents as any[]) ?? []).find(a => a.sector_id === "owner");

    if (!owner) {
      const { data: made, error } = await db.rpc("add_agent", {
        p_tenant_slug: slug,
        p_payload: { sector: "owner", agent: "Rami" },
      });
      if (error) throw new Error(error.message);
      const m = made as any;
      if (!m?.ok) {
        return NextResponse.json({
          ok: false,
          reply: "I couldn't set up the insights assistant. Migration 0029 may not have run yet.",
        });
      }
      owner = { slug: m.agent_slug };
    }

    // Reuse the chat pipeline rather than duplicating it — same logging, same
    // cost accounting, same briefing injection.
    const res = await fetch(`${req.nextUrl.origin}/api/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // pass the session through so the internal-agent gate sees it
        cookie: req.headers.get("cookie") ?? "",
        origin: req.nextUrl.origin,
      },
      body: JSON.stringify({
        slug, session: session ?? `owner-${slug}`,
        message, agent: owner.slug,
      }),
    });

    const d = await res.json();
    return NextResponse.json({
      ok: true,
      reply: d.reply ?? "I couldn't work that out just now.",
      agent: owner.slug,
    });
  } catch (e: any) {
    console.error("ask failed:", e?.message ?? e);
    return NextResponse.json({
      ok: false,
      reply: "Something went wrong reaching your figures. Try again in a moment.",
    }, { status: 500 });
  }
}
