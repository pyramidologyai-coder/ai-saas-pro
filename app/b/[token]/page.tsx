"use client";

/**
 * What a customer sees when they tap the link in their confirmation.
 *
 * The whole design goal is that someone can cancel in about eight seconds on a
 * phone, standing up, without reading anything. Because the alternative isn't
 * a phone call — it's a no-show.
 *
 * So: the appointment first, in plain language. Two buttons. Cancelling asks
 * once for confirmation and doesn't demand a reason. Rescheduling shows real
 * free times rather than a date picker that lets them choose a closed Sunday.
 */

import { useEffect, useState, useCallback } from "react";

type Booking = {
  status: string; when: string; when_iso: string; past: boolean;
  can_change: boolean; service: string | null; price: number | null;
  currency: string | null; with: string | null; customer: string;
  duration: number | null;
};
type Business = {
  name: string; slug: string; color: string; phone: string | null;
  address: string | null; logo_url: string | null; timezone: string;
};
type Slot = { local: string; label: string };

export default function ManageBooking({ params }: { params: { token: string } }) {
  const token = params.token;
  const [d, setD] = useState<{ ok: boolean; booking?: Booking; business?: Business;
                               reason?: string } | null>(null);
  const [view, setView] = useState<"main" | "confirm" | "move" | "done">("main");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [outcome, setOutcome] = useState("");

  const load = useCallback(() => {
    fetch(`/api/manage?token=${encodeURIComponent(token)}`)
      .then(r => r.json()).then(setD).catch(() => setD({ ok: false }));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (view !== "move" || !date) return;
    setSlots(null);
    fetch(`/api/manage?token=${encodeURIComponent(token)}&date=${date}`)
      .then(r => r.json())
      .then(r => setSlots(r.ok ? r.slots ?? [] : []))
      .catch(() => setSlots([]));
  }, [view, date, token]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/manage", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, action, ...extra }),
      });
      const r = await res.json();
      if (r.ok) {
        setOutcome(action === "cancel"
          ? "Your appointment is cancelled."
          : `Moved to ${r.when}. We'll confirm shortly.`);
        setView("done");
        load();
      } else {
        setErr(r.hint ?? message(r.reason));
      }
    } catch { setErr("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }

  if (!d) return <Shell><p className="mb-quiet">…</p></Shell>;

  if (!d.ok || !d.booking || !d.business) {
    return (
      <Shell>
        <div className="mb-card">
          <h1>We couldn&apos;t find that appointment</h1>
          <p className="mb-lede">
            The link may be old, or already used. If you need to change
            something, please call the clinic directly.
          </p>
        </div>
      </Shell>
    );
  }

  const b = d.booking, biz = d.business;
  const C = biz.color;
  const cancelled = b.status === "cancelled";

  const days = Array.from({ length: 14 }, (_, i) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + i + 1);
    return {
      iso: dt.toISOString().slice(0, 10),
      label: dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
    };
  });

  return (
    <Shell color={C}>
      <div className="mb-card">
        <header className="mb-head">
          {biz.logo_url
            ? <img src={biz.logo_url} alt="" className="mb-logo" />
            : <span className="mb-mark">{biz.name.charAt(0)}</span>}
          <div>
            <div className="mb-biz">{biz.name}</div>
            {biz.address && <div className="mb-addr">{biz.address}</div>}
          </div>
        </header>

        {view === "done" ? (
          <>
            <div className="mb-tick">✓</div>
            <h1>{outcome}</h1>
            <p className="mb-lede">
              {biz.phone
                ? <>Anything else, call us on <a href={`tel:${biz.phone.replace(/\s/g,"")}`}>{biz.phone}</a>.</>
                : "Thanks for letting us know."}
            </p>
          </>
        ) : (
          <>
            <div className={`mb-status ${cancelled ? "off" : ""}`}>
              {cancelled ? "Cancelled" : b.past ? "Past appointment" : "Confirmed"}
            </div>

            <h1 className="mb-when">{b.when}</h1>

            <dl className="mb-rows">
              {b.service && (
                <div><dt>Service</dt><dd>{b.service}</dd></div>
              )}
              {b.with && <div><dt>With</dt><dd>{b.with}</dd></div>}
              {b.duration && <div><dt>Length</dt><dd>{b.duration} minutes</dd></div>}
              {b.price != null && (
                <div><dt>Price</dt><dd>{b.currency} {Number(b.price).toFixed(2)}</dd></div>
              )}
            </dl>

            {view === "main" && !cancelled && b.can_change && (
              <div className="mb-acts">
                <button className="mb-btn" style={{ background: C }}
                        onClick={() => setView("move")}>
                  Change the time
                </button>
                <button className="mb-btn ghost" onClick={() => setView("confirm")}>
                  Cancel it
                </button>
              </div>
            )}

            {view === "main" && !cancelled && !b.can_change && !b.past && (
              <p className="mb-note">
                It&apos;s too close to your appointment to change it here.
                {biz.phone && <> Please call us on{" "}
                  <a href={`tel:${biz.phone.replace(/\s/g,"")}`}>{biz.phone}</a>.</>}
              </p>
            )}

            {view === "confirm" && (
              <div className="mb-confirm">
                <p className="mb-lede">Cancel this appointment?</p>
                <input value={reason} onChange={e => setReason(e.target.value)}
                       placeholder="Reason — optional" />
                <div className="mb-acts">
                  <button className="mb-btn danger" disabled={busy}
                          onClick={() => act("cancel", { reason })}>
                    {busy ? "Cancelling…" : "Yes, cancel it"}
                  </button>
                  <button className="mb-btn ghost" onClick={() => setView("main")}>
                    Keep it
                  </button>
                </div>
              </div>
            )}

            {view === "move" && (
              <div className="mb-move">
                <p className="mb-lede">Pick a new day, then a time.</p>
                <div className="mb-days">
                  {days.map(x => (
                    <button key={x.iso} onClick={() => setDate(x.iso)}
                      className={date === x.iso ? "on" : ""}
                      style={date === x.iso ? { background: C, borderColor: C } : undefined}>
                      {x.label}
                    </button>
                  ))}
                </div>

                {date && slots === null && <p className="mb-quiet">Checking…</p>}
                {date && slots?.length === 0 && (
                  <p className="mb-note">Nothing free that day. Try another.</p>
                )}
                {slots && slots.length > 0 && (
                  <div className="mb-slots">
                    {slots.map(s => (
                      <button key={s.local} disabled={busy}
                        onClick={() => act("reschedule", { when: s.local })}
                        style={{ borderColor: C, color: C }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}

                <button className="mb-btn ghost" onClick={() => { setView("main"); setDate(""); }}>
                  Back
                </button>
              </div>
            )}

            {err && <p className="mb-err">{err}</p>}
          </>
        )}
      </div>

      {biz.phone && view !== "done" && (
        <a className="mb-call" href={`tel:${biz.phone.replace(/\s/g,"")}`}>
          Call {biz.name}
        </a>
      )}
    </Shell>
  );
}

function message(reason?: string) {
  switch (reason) {
    case "too_late":      return "It's too close to the appointment to change it online.";
    case "fully_booked":  return "That time has just gone. Try another.";
    case "slot_taken":    return "Someone took that slot. Pick another time.";
    case "closed_that_day": return "We're closed that day.";
    case "outside_hours": return "That's outside our opening hours.";
    case "already_cancelled": return "This appointment is already cancelled.";
    case "not_found":     return "We couldn't find that appointment.";
    default:              return "That didn't work. Please try again, or call us.";
  }
}

function Shell({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="mb" style={{ "--c": color ?? "#1D6A8C" } as React.CSSProperties}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <main>{children}</main>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
*{box-sizing:border-box}
html,body{margin:0}
.mb{--ink:#12100E;--mut:#66625B;--fade:#A5A099;--line:#E7E3DC;
  min-height:100vh;background:color-mix(in oklab,var(--c) 5%,#FBFAF7);
  font-family:"Instrument Sans",system-ui,sans-serif;color:var(--ink);
  display:flex;flex-direction:column;align-items:center;
  padding:clamp(20px,6vw,64px) 18px 40px}
.mb main{width:100%;max-width:440px}
.mb-card{background:#fff;border:1px solid var(--line);border-radius:20px;
  padding:clamp(22px,5vw,32px);box-shadow:0 14px 46px rgba(18,16,14,.07)}
.mb-quiet{color:var(--fade);font-size:13.5px;text-align:center;padding:14px 0}

.mb-head{display:flex;align-items:center;gap:12px;padding-bottom:20px;
  border-bottom:1px solid var(--line);margin-bottom:22px}
.mb-logo{width:42px;height:42px;border-radius:10px;object-fit:cover}
.mb-mark{width:42px;height:42px;border-radius:10px;background:var(--c);color:#fff;
  display:grid;place-items:center;font-family:"Fraunces",serif;font-size:18px;font-weight:560}
.mb-biz{font-weight:600;font-size:15.5px}
.mb-addr{font-size:12px;color:var(--fade);margin-top:2px}

.mb-status{display:inline-block;font-size:10.5px;text-transform:uppercase;
  letter-spacing:.1em;font-weight:700;padding:4px 11px;border-radius:999px;
  background:color-mix(in oklab,var(--c) 12%,#fff);color:var(--c)}
.mb-status.off{background:#FBEAE7;color:#B3452F}

.mb-when{font-family:"Fraunces",serif;font-weight:560;font-size:clamp(24px,5.5vw,32px);
  letter-spacing:-0.025em;line-height:1.15;margin:14px 0 22px}
.mb h1{font-family:"Fraunces",serif;font-weight:560;font-size:clamp(21px,4.5vw,27px);
  letter-spacing:-0.02em;margin:0 0 10px;line-height:1.2}
.mb-lede{font-size:14px;color:var(--mut);line-height:1.6;margin:0 0 18px}
.mb-lede a{color:var(--c);font-weight:600}

.mb-rows{margin:0 0 24px;padding:0}
.mb-rows div{display:flex;justify-content:space-between;gap:14px;padding:10px 0;
  border-bottom:1px solid #F2F0EB}
.mb-rows dt{font-size:13px;color:var(--fade);margin:0}
.mb-rows dd{font-size:14px;font-weight:500;margin:0;text-align:end}

.mb-acts{display:flex;flex-direction:column;gap:9px}
.mb-btn{border:0;border-radius:12px;padding:15px;font-size:15px;font-weight:600;
  cursor:pointer;font-family:inherit;color:#fff;width:100%;
  transition:filter .15s ease,transform .15s ease}
.mb-btn:hover:not(:disabled){filter:brightness(1.06);transform:translateY(-1px)}
.mb-btn:disabled{opacity:.5;cursor:default}
.mb-btn.ghost{background:none;color:var(--mut);border:1px solid var(--line)}
.mb-btn.ghost:hover{color:var(--ink);border-color:var(--ink);filter:none}
.mb-btn.danger{background:#B3452F}

.mb-confirm input{width:100%;border:1px solid var(--line);border-radius:11px;
  padding:12px 14px;font-size:15px;font-family:inherit;margin-bottom:14px;
  background:#FDFCFA}
.mb-confirm input:focus{outline:2px solid var(--c);border-color:transparent}

.mb-days{display:flex;gap:7px;overflow-x:auto;padding-bottom:10px;margin-bottom:14px;
  -webkit-overflow-scrolling:touch}
.mb-days button{flex:none;background:#fff;border:1px solid var(--line);border-radius:11px;
  padding:11px 14px;font-size:12.5px;cursor:pointer;font-family:inherit;
  color:var(--mut);white-space:nowrap}
.mb-days button.on{color:#fff;font-weight:600}
.mb-slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));
  gap:7px;margin-bottom:16px}
.mb-slots button{background:#fff;border:1.5px solid;border-radius:10px;padding:12px 6px;
  font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;
  font-variant-numeric:tabular-nums;transition:transform .12s ease}
.mb-slots button:hover:not(:disabled){transform:translateY(-1px)}

.mb-tick{width:56px;height:56px;border-radius:50%;background:var(--c);color:#fff;
  display:grid;place-items:center;font-size:26px;margin:0 auto 20px}
.mb-note{font-size:13.5px;color:var(--mut);background:#FFF9EC;border:1px solid #F0E4C8;
  border-radius:11px;padding:13px 15px;line-height:1.55;margin:0}
.mb-note a{color:var(--c);font-weight:600}
.mb-err{font-size:13.5px;color:#B3452F;margin:14px 0 0}

.mb-call{display:block;text-align:center;margin-top:18px;font-size:13.5px;
  color:var(--mut);text-decoration:none}
.mb-call:hover{color:var(--ink);text-decoration:underline}

button:focus-visible,a:focus-visible,input:focus-visible{
  outline:2px solid var(--c);outline-offset:2px}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;
