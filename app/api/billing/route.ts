/**
 * POST /api/billing — start a Stripe Checkout session.
 *
 * Needs STRIPE_SECRET_KEY. Without it this returns `not_configured` and the UI
 * says so plainly rather than pretending a payment page exists.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  const { slug, plan } = await req.json().catch(() => ({}));

  if (!slug || !plan) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }
  if (!key) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }

  try {
    const db = supabaseAdmin();
    const { data: state } = await db.rpc("billing_state", { p_slug: slug });
    const plans = (state as any)?.plans ?? [];
    const chosen = plans.find((p: any) => p.code === plan);
    if (!chosen || Number(chosen.amount) <= 0) {
      return NextResponse.json({ ok: false, reason: "unknown_plan" }, { status: 400 });
    }

    const origin = req.nextUrl.origin;
    const form = new URLSearchParams({
      mode: "subscription",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": String(chosen.currency ?? "MYR").toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(Math.round(Number(chosen.amount) * 100)),
      "line_items[0][price_data][recurring][interval]": "month",
      "line_items[0][price_data][product_data][name]": `Automology ${chosen.label}`,
      success_url: `${origin}/dashboard/${slug}?paid=1`,
      cancel_url: `${origin}/dashboard/${slug}`,
      "metadata[slug]": slug,
      "metadata[plan]": plan,
      "subscription_data[metadata][slug]": slug,
      "subscription_data[metadata][plan]": plan,
    });

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form,
      signal: AbortSignal.timeout(15_000),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("stripe checkout failed:", data?.error?.message);
      return NextResponse.json({ ok: false, reason: "stripe_error" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, url: data.url });
  } catch (e: any) {
    console.error("billing failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}
