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

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "cron_not_configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
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
      const ok = await sendEmail({
        to: item.to,
        subject: item.subject ?? "A message for you",
        html: wrap(item.body),
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
