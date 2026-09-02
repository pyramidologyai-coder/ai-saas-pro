/**
 * Email, via Resend.
 *
 * Every send is logged, so "did they get their key?" has an answer. A failure
 * never breaks the thing that triggered it — a booking that saved but whose
 * confirmation bounced is still a booking.
 *
 * Needs RESEND_API_KEY. Without it, sends are logged as failed and the app
 * carries on; nothing pretends to have been delivered.
 */

import { supabaseAdmin } from "@/lib/supabase";

const FROM = process.env.EMAIL_FROM ?? "Automology <onboarding@resend.dev>";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  kind: string;
  tenantId?: string | null;
};

export async function sendEmail(a: SendArgs): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const db = supabaseAdmin();

  const log = (status: string, error?: string) =>
    db.rpc("log_email", {
      p_tenant: a.tenantId ?? null, p_to: a.to, p_kind: a.kind,
      p_subject: a.subject, p_status: status, p_error: error ?? null,
    }).then(() => {}, () => {});

  if (!key) {
    console.warn(`email not sent (no RESEND_API_KEY): ${a.kind} → ${a.to}`);
    await log("failed", "RESEND_API_KEY not set");
    return false;
  }
  if (!a.to || !a.to.includes("@") || a.to.endsWith(".local")) {
    await log("failed", "no usable address");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ from: FROM, to: [a.to], subject: a.subject, html: a.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`resend ${res.status}: ${text}`);
      await log("failed", `${res.status} ${text}`.slice(0, 400));
      return false;
    }
    await log("sent");
    return true;
  } catch (e: any) {
    console.error("email failed:", e?.message ?? e);
    await log("failed", String(e?.message ?? e).slice(0, 400));
    return false;
  }
}

/* ── templates ─────────────────────────────────────────────────────────── */

const shell = (color: string, body: string) => `
<div style="background:#F4F2ED;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#FBFAF7;border-radius:14px;overflow:hidden;border:1px solid #E7E3DC">
    <div style="height:3px;background:${color}"></div>
    <div style="padding:32px 28px;color:#12100E;line-height:1.6;font-size:15px">${body}</div>
  </div>
</div>`;

const btn = (color: string, href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">${label}</a>`;

export function welcomeEmail(o: {
  business: string; agent: string; slug: string; code: string; color: string; origin: string;
}) {
  return {
    subject: `${o.agent} is live at ${o.business}`,
    html: shell(o.color, `
      <h1 style="font-size:22px;margin:0 0 14px">${o.agent} is answering.</h1>
      <p style="margin:0 0 20px;color:#66625B">
        Your AI receptionist is live. Share this link with customers — put it on
        your website, your Instagram bio, or send it directly.
      </p>
      <p style="margin:0 0 24px">
        <a href="${o.origin}/demo/${o.slug}" style="color:${o.color};font-weight:600">
          ${o.origin}/demo/${o.slug}</a>
      </p>
      <div style="background:#F4F2ED;border-radius:10px;padding:16px;margin:0 0 24px">
        <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#A5A099;font-weight:600">
          Your dashboard key</div>
        <div style="font-family:ui-monospace,Menlo,monospace;font-size:19px;font-weight:600;margin-top:6px">
          ${o.code}</div>
      </div>
      <p style="margin:0 0 24px;color:#66625B;font-size:13px">
        Keep this key safe — anyone with it can change your prices. Give your
        staff their own keys from the Team page instead of sharing this one.
      </p>
      ${btn(o.color, `${o.origin}/login`, "Open my dashboard")}
    `),
  };
}

export function bookingEmail(o: {
  business: string; service: string; when: string; name: string;
  color: string; phone?: string | null;
}) {
  return {
    subject: `Your appointment at ${o.business}`,
    html: shell(o.color, `
      <h1 style="font-size:22px;margin:0 0 14px">You're booked in.</h1>
      <p style="margin:0 0 20px;color:#66625B">Hello ${o.name}, here are the details.</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
        <tr><td style="padding:9px 0;color:#A5A099;font-size:13px">Service</td>
            <td style="padding:9px 0;text-align:right;font-weight:600">${o.service}</td></tr>
        <tr><td style="padding:9px 0;color:#A5A099;font-size:13px;border-top:1px solid #E7E3DC">When</td>
            <td style="padding:9px 0;text-align:right;font-weight:600;border-top:1px solid #E7E3DC">${o.when}</td></tr>
        <tr><td style="padding:9px 0;color:#A5A099;font-size:13px;border-top:1px solid #E7E3DC">Where</td>
            <td style="padding:9px 0;text-align:right;font-weight:600;border-top:1px solid #E7E3DC">${o.business}</td></tr>
      </table>
      <p style="margin:0;color:#66625B;font-size:13px">
        Need to change it?${o.phone ? ` Call us on ${o.phone}.` : " Reply to this email."}
      </p>
    `),
  };
}

export function alertEmail(o: {
  business: string; customer: string; reason: string; message: string;
  color: string; origin: string; slug: string;
}) {
  return {
    subject: `${o.business} — someone needs you`,
    html: shell(o.color, `
      <h1 style="font-size:20px;margin:0 0 14px">Your AI handed one over.</h1>
      <p style="margin:0 0 18px;color:#66625B">
        <b>${o.customer}</b> — ${o.reason.replace(/_/g, " ")}
      </p>
      <div style="background:#F4F2ED;border-radius:10px;padding:16px;margin:0 0 24px;
                  font-size:14px;color:#12100E">${escapeHtml(o.message)}</div>
      ${btn(o.color, `${o.origin}/dashboard/${o.slug}/chats`, "Open the conversation")}
    `),
  };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
