"use client";

/**
 * The customer's own view: their appointments, their history, their invoices.
 *
 * Signing in is a code sent to the phone or email already on their record —
 * no account, no password. Asking someone to register in order to see when
 * their own appointment is would lose most of them at the first step.
 */

import { useEffect, useState, useCallback } from "react";

type Upcoming = {
  id: string; manage_token: string; status: string; when: string;
  service: string | null; price: number | null; currency: string | null;
  with: string | null;
};
type Past = { when: string; service: string | null; status: string; reviewed: boolean };
type Invoice = { number: string; amount: number; currency: string;
                 status: string; issued_on: string };
type Data = {
  ok: boolean; reason?: string;
  business?: { name: string; slug: string; color: string; phone: string | null;
               address: string | null; logo_url: string | null };
  you?: { name: string | null; phone: string | null; email: string | null;
          visits: number; since: string };
  upcoming?: Upcoming[]; past?: Past[]; invoices?: Invoice[];
};

export default function Portal({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const [d, setD] = useState<Data | null>(null);
  const [step, setStep] = useState<"contact" | "code">("contact");
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    fetch(`/api/portal?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json()).then(setD).catch(() => setD({ ok: false }));
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  async function send(action: string, body: Record<string, unknown>) {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/portal", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, action, ...body }),
      });
      const j = await r.json();
      setBusy(false);
      return j;
    } catch {
      setBusy(false);
      setErr("Couldn't reach the server.");
      return null;
    }
  }

  if (!d) return <Shell><p className="po-quiet">…</p></Shell>;

  // ── signed out ───────────────────────────────────────────────────────────
  if (!d.ok || !d.you) {
    return (
      <Shell>
        <div className="po-card po-signin">
          <h1>Your appointments</h1>
          {step === "contact" ? (
            <>
              <p className="po-lede">
                Enter the phone number or email you booked with. We&apos;ll send
                you a code.
              </p>
              <input value={contact} autoFocus
                     onChange={e => { setContact(e.target.value); setErr(""); }}
                     onKeyDown={e => { if (e.key === "Enter") request(); }}
                     placeholder="012-345 6789 or you@email.com" />
              <button className="po-btn" disabled={busy || contact.trim().length < 5}
                      onClick={request}>
                {busy ? "Sending…" : "Send me a code"}
              </button>
            </>
          ) : (
            <>
              <p className="po-lede">
                We&apos;ve sent a six-digit code to {contact}. It works for the next
                fifteen minutes.
              </p>
              <input value={code} autoFocus inputMode="numeric" maxLength={6}
                     onChange={e => { setCode(e.target.value.replace(/\D/g, "")); setErr(""); }}
                     onKeyDown={e => { if (e.key === "Enter") verify(); }}
                     placeholder="000000" className="po-code" />
              <button className="po-btn" disabled={busy || code.length !== 6}
                      onClick={verify}>
                {busy ? "Checking…" : "Sign in"}
              </button>
              <button className="po-link" onClick={() => { setStep("contact"); setCode(""); }}>
                Use a different number
              </button>
            </>
          )}
          {err && <p className="po-err">{err}</p>}
          <p className="po-foot">
            No account needed. We only ever show appointments booked with the
            contact you enter.
          </p>
        </div>
      </Shell>
    );
  }

  // ── signed in ────────────────────────────────────────────────────────────
  const b = d.business!, you = d.you;
  const C = b.color;

  return (
    <Shell color={C}>
      <header className="po-head">
        <div className="po-brand">
          {b.logo_url
            ? <img src={b.logo_url} alt="" className="po-logo" />
            : <span className="po-mark" style={{ background: C }}>{b.name.charAt(0)}</span>}
          <div>
            <div className="po-biz">{b.name}</div>
            <div className="po-hi">
              {you.name ? `Hello ${you.name}` : "Hello"}
              {you.visits > 0 && ` · ${you.visits} visit${you.visits === 1 ? "" : "s"}`}
            </div>
          </div>
        </div>
        <button className="po-out" onClick={async () => {
          await send("signout", {}); load();
        }}>Sign out</button>
      </header>

      <section>
        <h2 className="po-h2">Coming up</h2>
        {(d.upcoming ?? []).length === 0 ? (
          <div className="po-empty">
            Nothing booked.
            <a href={`/demo/${slug}`} style={{ color: C }}> Book an appointment →</a>
          </div>
        ) : (d.upcoming ?? []).map(u => (
          <div key={u.id} className="po-card po-appt">
            <div className="po-when">{u.when}</div>
            <div className="po-rows">
              {u.service && <div><span>Service</span><b>{u.service}</b></div>}
              {u.with && <div><span>With</span><b>{u.with}</b></div>}
              {u.price != null && (
                <div><span>Price</span><b>{u.currency} {Number(u.price).toFixed(2)}</b></div>
              )}
              <div><span>Status</span><b>{u.status}</b></div>
            </div>
            <a className="po-btn" style={{ background: C }} href={`/b/${u.manage_token}`}>
              Change or cancel
            </a>
          </div>
        ))}
      </section>

      {(d.past ?? []).length > 0 && (
        <section>
          <h2 className="po-h2">Before</h2>
          <div className="po-card">
            {(d.past ?? []).map((p, i) => (
              <div key={i} className="po-past">
                <div>
                  <div className="po-past-s">{p.service ?? "Visit"}</div>
                  <div className="po-past-w">{p.when}</div>
                </div>
                <span className={`po-tag ${p.status}`}>{p.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {(d.invoices ?? []).length > 0 && (
        <section>
          <h2 className="po-h2">Invoices</h2>
          <div className="po-card">
            {(d.invoices ?? []).map(inv => (
              <div key={inv.number} className="po-past">
                <div>
                  <div className="po-past-s">{inv.number}</div>
                  <div className="po-past-w">{inv.issued_on}</div>
                </div>
                <div className="po-amt">
                  {inv.currency} {Number(inv.amount).toFixed(2)}
                  <span className={`po-tag ${inv.status}`}>{inv.status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {b.phone && (
        <a className="po-call" href={`tel:${b.phone.replace(/\s/g, "")}`}>
          Call {b.name} · {b.phone}
        </a>
      )}
    </Shell>
  );

  async function request() {
    const j = await send("request", { contact });
    if (j?.ok) { setStep("code"); }
    else setErr(j?.hint ?? "Please check that and try again.");
  }

  async function verify() {
    const j = await send("verify", { contact, code });
    if (j?.ok) { setCode(""); load(); }
    else setErr(j?.hint ?? "That code didn't match.");
  }
}

function Shell({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="po" style={{ "--c": color ?? "#1D6A8C" } as React.CSSProperties}>
      <main>{children}</main>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
*{box-sizing:border-box}
html,body{margin:0}
.po{--ink:#12100E;--mut:#66625B;--fade:#A5A099;--line:#E7E3DC;
  min-height:100vh;background:color-mix(in oklab,var(--c) 5%,#FBFAF7);
  color:var(--ink);font-family:"Instrument Sans",system-ui,sans-serif;
  display:flex;justify-content:center;padding:clamp(18px,5vw,52px) 18px 60px}
.po main{width:100%;max-width:440px}
.po-quiet{text-align:center;color:var(--fade);padding:80px 0}

.po-card{background:#fff;border:1px solid var(--line);border-radius:18px;
  padding:clamp(20px,5vw,28px);box-shadow:0 12px 40px rgba(18,16,14,.06);
  margin-bottom:14px}
.po-signin{margin-top:8vh}
.po h1{font-family:"Fraunces",serif;font-weight:560;font-size:clamp(23px,5vw,29px);
  letter-spacing:-0.025em;margin:0 0 10px}
.po-lede{font-size:14px;color:var(--mut);line-height:1.6;margin:0 0 20px}
.po input{width:100%;border:1px solid var(--line);border-radius:12px;
  padding:14px 15px;font-size:16px;font-family:inherit;background:#FDFCFA;
  margin-bottom:12px}
.po input:focus{outline:2px solid var(--c);border-color:transparent}
.po-code{text-align:center;font-size:28px!important;letter-spacing:.32em;
  font-variant-numeric:tabular-nums;font-weight:600}
.po-btn{display:block;width:100%;background:var(--c);color:#fff;border:0;
  border-radius:12px;padding:14px;font-size:15px;font-weight:600;cursor:pointer;
  font-family:inherit;text-align:center;text-decoration:none}
.po-btn:disabled{opacity:.4;cursor:default}
.po-link{display:block;width:100%;background:none;border:0;color:var(--mut);
  font-size:13px;margin-top:12px;cursor:pointer;font-family:inherit;
  text-decoration:underline;text-underline-offset:3px}
.po-err{font-size:13px;color:#B3452F;margin:12px 0 0}
.po-foot{font-size:11.5px;color:var(--fade);margin:20px 0 0;line-height:1.5}

.po-head{display:flex;justify-content:space-between;align-items:center;gap:12px;
  margin-bottom:24px;flex-wrap:wrap}
.po-brand{display:flex;align-items:center;gap:12px}
.po-logo{width:42px;height:42px;border-radius:10px;object-fit:cover}
.po-mark{width:42px;height:42px;border-radius:10px;color:#fff;display:grid;
  place-items:center;font-family:"Fraunces",serif;font-size:18px;font-weight:560}
.po-biz{font-weight:600;font-size:15.5px}
.po-hi{font-size:12px;color:var(--fade);margin-top:2px}
.po-out{background:none;border:1px solid var(--line);border-radius:8px;
  padding:8px 13px;font-size:12px;color:var(--mut);cursor:pointer;font-family:inherit}

.po-h2{font-size:11px;text-transform:uppercase;letter-spacing:.13em;
  color:var(--fade);font-weight:600;margin:0 0 12px}
.po-appt{padding-bottom:20px}
.po-when{font-family:"Fraunces",serif;font-weight:560;font-size:20px;
  letter-spacing:-0.02em;margin-bottom:16px;line-height:1.25}
.po-rows div{display:flex;justify-content:space-between;gap:14px;padding:9px 0;
  border-bottom:1px solid #F2F0EB;font-size:13.5px}
.po-rows span{color:var(--fade)}
.po-rows b{font-weight:500;text-align:end}
.po-appt .po-btn{margin-top:18px}

.po-past{display:flex;justify-content:space-between;align-items:center;gap:12px;
  padding:11px 0;border-bottom:1px solid #F2F0EB}
.po-past:last-child{border-bottom:0}
.po-past-s{font-size:14px;font-weight:500}
.po-past-w{font-size:12px;color:var(--fade);margin-top:2px}
.po-amt{font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;
  display:flex;align-items:center;gap:8px}
.po-tag{font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:700;
  padding:3px 8px;border-radius:999px;background:#F0EEE9;color:var(--mut)}
.po-tag.completed,.po-tag.paid{background:#E8F3EE;color:#1E6F5C}
.po-tag.cancelled,.po-tag.no_show,.po-tag.unpaid{background:#FBEAE7;color:#B3452F}
.po-empty{background:#fff;border:1px solid var(--line);border-radius:16px;
  padding:32px;text-align:center;color:var(--fade);font-size:13.5px;margin-bottom:14px}
.po-empty a{text-decoration:none;font-weight:600}
.po-call{display:block;text-align:center;margin-top:18px;font-size:13px;
  color:var(--mut);text-decoration:none}
.po-call:hover{text-decoration:underline}

button:focus-visible,a:focus-visible,input:focus-visible{
  outline:2px solid var(--c);outline-offset:2px}
`;
