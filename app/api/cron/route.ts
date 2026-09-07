/**
 * GET /api/cron — the worker that actually sends things.
 *
 * Runs on a schedule (vercel.json). Two steps, deliberately separate:
 *   1. queue_automations() turns rules into outbox rows
 *   2. claim a batch, send it, mark each one done
 *
 * Rows are claimed before sending, so two overlapping runs can't send the same
 * message twice, and a crash mid-send retries rather than vanishing.
 *
 * Protected by CRON_SECRET. Vercel Cron sends it automatically; without the
 * variable set the route refuses rather than running open to the internet.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";

// No explicit maxDuration: an account-level limit lower than the value here
// fails the whole deployment. Vercel applies the plan default instead, and
// the worker takes 25 messages at a time so it finishes well inside it.

/**
 * ⚠ VERCEL'S FREE PLAN ALLOWS ONE CRON RUN PER DAY.
 *
 * vercel.json is set to 09:00 daily so the deployment is accepted. That is
 * enough to prove the pipeline works, but a reminder that only goes out once a
 * day is a weak reminder — an appointment booked at 10am for 2pm gets nothing.
 *
 * To run it properly without paying, point a free external scheduler at this
 * route every 15 minutes (cron-job.org, EasyCron, GitHub Actions all do it):
 *
 *   GET  https://your-app.vercel.app/api/cron
 *   Header:  Authorization: Bearer <CRON_SECRET>
 *
 * The route is idempotent — running it more often is safe. Rows are claimed
 * before sending, so two overlapping runs cannot send the same message twice.
 */

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "cron_not_configured" }, { status: 503 });
  }

  // Vercel Cron sends the header. An external scheduler may only manage a
  // query string, so both are accepted — the secret is the same either way.
  const auth = req.headers.get("authorization") ?? "";
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (auth !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ ok: false, reason: "unauthorised" }, { status: 401 });
  }

  const db = supabaseAdmin();
  let queued = 0, sent = 0, failed = 0;

  try {
    const { data: q } = await db.rpc("queue_automations");
    queued = (q as any)?.queued ?? 0;

    const { data: batch } = await db.rpc("claim_outbox", { p_limit: 25 });
    const items = ((batch as any)?.items ?? []) as {
      id: string; to: string; subject: string; body: string;
      source: string; tenant_id: string;
    }[];

    for (const item of items) {
      // A review request without a link is just a nice thought. Attach the
      // booking's own token so one tap lands on the stars.
      let body = item.body;
      if (item.source === "review_request" && (item as any).booking_id) {
        try {
          const { data: url } = await db.rpc("booking_manage_url", {
            p_booking_id: (item as any).booking_id,
            p_origin: req.nextUrl.origin,
          });
          const t = String(url ?? "").split("/b/")[1];
          if (t) body += `\n\n${req.nextUrl.origin}/review/${t}`;
        } catch { /* send it without the link rather than not at all */ }
      }

      const ok = await sendEmail({
        to: item.to,
        subject: item.subject ?? "A message for you",
        html: wrap(body),
        kind: item.source.split(":")[0],
        tenantId: item.tenant_id,
      });
      await db.rpc("finish_outbox", {
        p_id: item.id, p_ok: ok, p_error: ok ? null : "send failed",
      });
      ok ? sent++ : failed++;
    }

    return NextResponse.json({ ok: true, queued, sent, failed });
  } catch (e: any) {
    console.error("cron failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "error", queued, sent, failed }, { status: 500 });
  }
}

function wrap(body: string) {
  const safe = body.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  return `<div style="background:#F4F2ED;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#FBFAF7;border-radius:14px;
                border:1px solid #E7E3DC;padding:30px 26px;font-size:15px;line-height:1.6;color:#12100E">
      ${safe.replace(/\n/g, "<br>")}
    </div></div>`;
}
