/**
 * POST /api/billing/webhook — Stripe tells us what happened.
 *
 * The signature is verified against STRIPE_WEBHOOK_SECRET before anything is
 * believed. Without that check, anyone who found this URL could mark their own
 * subscription active. Unsigned requests are rejected, not ignored quietly.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await req.text();

  if (!secret) {
    console.error("webhook rejected: STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }
  if (!(await verifyStripe(raw, req.headers.get("stripe-signature"), secret))) {
    console.warn("webhook rejected: bad signature");
    return NextResponse.json({ ok: false, reason: "bad_signature" }, { status: 400 });
  }

  try {
    const event = JSON.parse(raw);
    const o = event?.data?.object ?? {};
    const slug = o?.metadata?.slug;
    if (!slug) return NextResponse.json({ received: true });

    const db = supabaseAdmin();
    const map: Record<string, string> = {
      "checkout.session.completed": "active",
      "customer.subscription.updated": o?.status === "past_due" ? "past_due" : "active",
      "customer.subscription.deleted": "cancelled",
      "invoice.payment_failed": "past_due",
    };
    const status = map[event?.type];
    if (!status) return NextResponse.json({ received: true });

    await db.rpc("set_subscription", {
      p_payload: {
        slug,
        plan: o?.metadata?.plan ?? null,
        status,
        customer: o?.customer ?? null,
        subscription: o?.subscription ?? o?.id ?? null,
        period_end: o?.current_period_end
          ? new Date(o.current_period_end * 1000).toISOString() : null,
      },
    });

    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error("webhook failed:", e?.message ?? e);
    return NextResponse.json({ received: true });
  }
}

/**
 * Stripe signs `timestamp.payload` with HMAC-SHA256. We recompute it and
 * compare in constant time, and reject anything older than five minutes so a
 * captured request can't be replayed.
 */
async function verifyStripe(raw: string, header: string | null, secret: string) {
  if (!header) return false;

  const parts = Object.fromEntries(
    header.split(",").map(p => p.split("=") as [string, string]));
  const t = parts.t, sig = parts.v1;
  if (!t || !sig) return false;

  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(`${t}.${raw}`));
  const expected = Array.from(new Uint8Array(mac))
    .map(b => b.toString(16).padStart(2, "0")).join("");

  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
