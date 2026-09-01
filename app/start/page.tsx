"use client";

/**
 * Self-serve onboarding. Four steps, one screen each, nothing optional that
 * isn't genuinely optional.
 *
 * The bet: a business owner will not fill in a long form for something they
 * haven't seen work. So the live preview sits beside the form the whole way —
 * their colour, their name, their agent, updating as they type. They watch the
 * thing being built before they commit to it.
 */

import { useState, useEffect } from "react";

type Sector = { sector_id: string; label: string; agent_default: string };
type Service = { name: string; price: string; minutes: string; description: string };
type Hours = Record<string, [string, string] | null>;

const DAYS: [string, string][] = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"],
  ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];

const COLORS = ["#1D6A8C", "#1E6F5C", "#8C4A2F", "#5B4B8A", "#B3452F", "#2F5D8C", "#7A6A3F", "#14171A"];

export default function Start() {
  const [step, setStep] = useState(0);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ slug: string; access_code: string; agent: string } | null>(null);

  const [name, setName] = useState("");
  const [sector, setSector] = useState("clinic");
  const [agent, setAgent] = useState("");
  const [color, setColor] = useState("#1D6A8C");
  const [tagline, setTagline] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [services, setServices] = useState<Service[]>([
    { name: "", price: "", minutes: "", description: "" },
  ]);
  const [hours, setHours] = useState<Hours>({
    mon: ["09:00", "18:00"], tue: ["09:00", "18:00"], wed: ["09:00", "18:00"],
    thu: ["09:00", "18:00"], fri: ["09:00", "18:00"], sat: ["09:00", "13:00"], sun: null,
  });

  useEffect(() => {
    fetch("/api/signup").then(r => r.json()).then(d => setSectors(d.sectors ?? [])).catch(() => {});
  }, []);

  const chosen = sectors.find(s => s.sector_id === sector);
  const agentName = agent.trim() || chosen?.agent_default || "your assistant";

  function setService(i: number, patch: Partial<Service>) {
    setServices(list => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  async function submit() {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), sector, agent: agent.trim() || null, color,
          tagline: tagline.trim() || null, phone: phone.trim() || null,
          address: address.trim() || null, email: email.trim() || null,
          hours: JSON.stringify(hours),
          services: services.filter(s => s.name.trim()),
        }),
      });
      const r = await res.json();
      if (r.ok) setDone(r);
      else setErr(r.reason === "name_required"
        ? "Please give your business a name."
        : "Something went wrong. Try again in a moment.");
    } catch {
      setErr("Couldn't reach the server. Check your connection.");
    } finally { setBusy(false); }
  }

  // ── success ──────────────────────────────────────────────────────────────
  if (done) {
    const url = typeof window !== "undefined"
      ? `${window.location.origin}/demo/${done.slug}` : `/demo/${done.slug}`;
    return (
      <div className="st" style={{ "--c": color } as React.CSSProperties}>
        <Fonts />
        <div className="st-done">
          <div className="st-tick">✓</div>
          <h1>{agentName} is live.</h1>
          <p className="st-lede">
            Your receptionist is answering now. Put this link on your website,
            your Instagram bio, or send it to a customer.
          </p>

          <div className="st-linkbox">
            <code>{url}</code>
            <button onClick={() => navigator.clipboard?.writeText(url)}>Copy</button>
          </div>

          <div className="st-keys">
            <div>
              <span>Your dashboard key</span>
              <code>{done.access_code}</code>
            </div>
            <p>Keep this. It's how you sign in to see conversations and change prices.</p>
          </div>

          <div className="st-doneacts">
            <a className="st-btn" href={`/demo/${done.slug}`}>Open your page →</a>
            <a className="st-btn ghost" href="/login">Go to your dashboard</a>
          </div>
        </div>
        <style>{CSS}</style>
      </div>
    );
  }

  const steps = ["Business", "Brand", "Services", "Hours"];
  const canNext =
    step === 0 ? name.trim().length >= 2 :
    step === 2 ? services.some(s => s.name.trim()) : true;

  return (
    <div className="st" style={{ "--c": color } as React.CSSProperties}>
      <Fonts />

      <header className="st-head">
        <a href="/" className="st-logo">Automology</a>
        <div className="st-prog">
          {steps.map((s, i) => (
            <span key={s} className={i <= step ? "on" : ""}>{s}</span>
          ))}
        </div>
      </header>

      <div className="st-body">
        {/* ── form ─────────────────────────────────────────── */}
        <div className="st-form">
          {step === 0 && (
            <>
              <h1>Tell us about your business</h1>
              <p className="st-lede">This is what your customers will see.</p>

              <label>Business name
                <input value={name} onChange={e => setName(e.target.value)}
                       placeholder="Damai Family Clinic" autoFocus />
              </label>

              <label>What kind of business?
                <div className="st-sectors">
                  {sectors.map(s => (
                    <button key={s.sector_id} type="button"
                            className={s.sector_id === sector ? "on" : ""}
                            onClick={() => setSector(s.sector_id)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </label>

              <div className="st-two">
                <label>Phone <span>optional</span>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+60 3 1234 5678" />
                </label>
                <label>Your email <span>optional</span>
                  <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@business.com" />
                </label>
              </div>

              <label>Address <span>optional</span>
                <input value={address} onChange={e => setAddress(e.target.value)}
                       placeholder="Jalan SS15/4B, Subang Jaya" />
              </label>
            </>
          )}

          {step === 1 && (
            <>
              <h1>Make it yours</h1>
              <p className="st-lede">
                Your customers should never see our name. Only yours.
              </p>

              <label>What should your receptionist be called?
                <input value={agent} onChange={e => setAgent(e.target.value)}
                       placeholder={chosen?.agent_default ?? "Nadia"} autoFocus />
              </label>

              <label>Your brand colour
                <div className="st-colors">
                  {COLORS.map(c => (
                    <button key={c} type="button" style={{ background: c }}
                            className={c === color ? "on" : ""}
                            onClick={() => setColor(c)} aria-label={c} />
                  ))}
                  <input type="color" value={color} onChange={e => setColor(e.target.value)}
                         aria-label="Custom colour" />
                </div>
              </label>

              <label>One line about you <span>optional</span>
                <input value={tagline} onChange={e => setTagline(e.target.value)}
                       placeholder="A family clinic. Walk in, or book ahead." />
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <h1>What do you offer?</h1>
              <p className="st-lede">
                {agentName} quotes these exactly. It will never invent a price
                or a service that isn&apos;t on this list.
              </p>

              {services.map((s, i) => (
                <div key={i} className="st-svc">
                  <div className="st-svc-row">
                    <input value={s.name} onChange={e => setService(i, { name: e.target.value })}
                           placeholder="Service name" autoFocus={i === 0} />
                    <input value={s.price} onChange={e => setService(i, { price: e.target.value })}
                           placeholder="Price" inputMode="decimal" className="sm" />
                    <input value={s.minutes} onChange={e => setService(i, { minutes: e.target.value })}
                           placeholder="Mins" inputMode="numeric" className="xs" />
                    {services.length > 1 && (
                      <button type="button" className="st-x"
                              onClick={() => setServices(l => l.filter((_, j) => j !== i))}>×</button>
                    )}
                  </div>
                  <input value={s.description} onChange={e => setService(i, { description: e.target.value })}
                         placeholder="A short description — optional" />
                </div>
              ))}

              <button type="button" className="st-add"
                onClick={() => setServices(l => [...l, { name: "", price: "", minutes: "", description: "" }])}>
                + Add another
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <h1>When are you open?</h1>
              <p className="st-lede">
                {agentName} refuses bookings outside these hours, and tells
                customers when you&apos;ll next be open.
              </p>

              {DAYS.map(([k, label]) => {
                const h = hours[k];
                return (
                  <div key={k} className="st-day">
                    <label className="st-toggle">
                      <input type="checkbox" checked={!!h}
                        onChange={e => setHours(x => ({ ...x, [k]: e.target.checked ? ["09:00", "18:00"] : null }))} />
                      <span>{label}</span>
                    </label>
                    {h ? (
                      <div className="st-times">
                        <input type="time" value={h[0]}
                               onChange={e => setHours(x => ({ ...x, [k]: [e.target.value, h[1]] }))} />
                        <em>to</em>
                        <input type="time" value={h[1]}
                               onChange={e => setHours(x => ({ ...x, [k]: [h[0], e.target.value] }))} />
                      </div>
                    ) : <span className="st-closed">Closed</span>}
                  </div>
                );
              })}
            </>
          )}

          {err && <p className="st-err">{err}</p>}

          <div className="st-nav">
            {step > 0 && (
              <button type="button" className="st-btn ghost" onClick={() => setStep(s => s - 1)}>
                Back
              </button>
            )}
            {step < 3 ? (
              <button type="button" className="st-btn" disabled={!canNext}
                      onClick={() => setStep(s => s + 1)}>
                Continue
              </button>
            ) : (
              <button type="button" className="st-btn" disabled={busy} onClick={submit}>
                {busy ? "Building…" : "Create my receptionist"}
              </button>
            )}
          </div>
        </div>

        {/* ── live preview ─────────────────────────────────── */}
        <aside className="st-preview">
          <div className="st-pv-label">Live preview</div>
          <div className="st-pv">
            <div className="st-pv-top">
              <span className="st-pv-mark">{(name || "?").charAt(0).toUpperCase()}</span>
              <div>
                <div className="st-pv-name">{name || "Your business"}</div>
                <div className="st-pv-sub"><i /> {agentName} · answering now</div>
              </div>
            </div>
            <div className="st-pv-log">
              <div className="st-pv-b a">
                Hello! I&apos;m {agentName}
                {name ? `, the receptionist at ${name}` : ""}. How can I help?
              </div>
              {services.filter(s => s.name.trim()).slice(0, 1).map(s => (
                <div key={s.name}>
                  <div className="st-pv-b c">how much is {s.name.toLowerCase()}?</div>
                  <div className="st-pv-b a">
                    {s.name} is {s.price ? `RM ${s.price}` : "—"}
                    {s.minutes ? `, about ${s.minutes} minutes` : ""}. Shall I find you a slot?
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="st-pv-note">
            This is your page, not ours. Your name, your colour, your prices.
          </p>
        </aside>
      </div>

      <style>{CSS}</style>
    </div>
  );
}

function Fonts() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
    </>
  );
}

const CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; }
.st {
  --ink: #12100E; --mut: #66625B; --fade: #A5A099;
  --line: #E7E3DC; --paper: #FBFAF7;
  min-height: 100vh; background: var(--paper); color: var(--ink);
  font-family: "Instrument Sans", system-ui, sans-serif;
}

.st-head {
  display: flex; justify-content: space-between; align-items: center; gap: 16px;
  padding: 16px clamp(18px, 4vw, 40px); border-bottom: 1px solid var(--line);
  background: #fff; flex-wrap: wrap;
}
.st-logo { font-family: "Fraunces", serif; font-weight: 560; font-size: 19px; text-decoration: none; color: var(--ink); }
.st-prog { display: flex; gap: 6px; flex-wrap: wrap; }
.st-prog span {
  font-size: 11.5px; color: var(--fade); padding: 5px 12px; border-radius: 999px;
  background: #F4F2ED; transition: all .2s ease;
}
.st-prog span.on { background: var(--c); color: #fff; }

.st-body {
  display: grid; grid-template-columns: 1fr; gap: 40px;
  max-width: 1080px; margin: 0 auto; padding: clamp(32px, 5vw, 56px) clamp(18px, 4vw, 40px) 80px;
}
@media (min-width: 900px) { .st-body { grid-template-columns: 1.15fr .85fr; gap: 56px; } }

.st-form h1 {
  font-family: "Fraunces", serif; font-weight: 560;
  font-size: clamp(26px, 4vw, 36px); letter-spacing: -0.025em; margin: 0;
}
.st-lede { font-size: 14.5px; color: var(--mut); line-height: 1.6; margin: 10px 0 30px; max-width: 46ch; }

.st-form label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 20px; color: var(--ink); }
.st-form label span { color: var(--fade); font-weight: 400; margin-inline-start: 6px; }
.st-form input[type=text], .st-form input:not([type]), .st-form input[type=time], .st-form input[type=color] {
  width: 100%; margin-top: 7px; border: 1px solid var(--line); border-radius: 10px;
  padding: 12px 14px; font-size: 15px; font-family: inherit; background: #fff; color: var(--ink);
}
.st-form input:focus { outline: 2px solid var(--c); outline-offset: 0; border-color: transparent; }
.st-two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 560px) { .st-two { grid-template-columns: 1fr; } }

.st-sectors { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 9px; }
.st-sectors button {
  background: #fff; border: 1px solid var(--line); border-radius: 999px;
  padding: 10px 16px; font-size: 13px; cursor: pointer; font-family: inherit; color: var(--mut);
  transition: all .16s ease;
}
.st-sectors button:hover { border-color: var(--c); color: var(--ink); }
.st-sectors button.on { background: var(--c); border-color: var(--c); color: #fff; font-weight: 500; }

.st-colors { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 9px; align-items: center; }
.st-colors button {
  width: 34px; height: 34px; border-radius: 50%; border: 2px solid transparent; cursor: pointer;
  transition: transform .14s ease;
}
.st-colors button:hover { transform: scale(1.1); }
.st-colors button.on { border-color: var(--ink); transform: scale(1.12); }
.st-colors input[type=color] { width: 44px !important; height: 34px; padding: 2px !important; margin: 0 !important; cursor: pointer; }

.st-svc { margin-bottom: 14px; }
.st-svc-row { display: flex; gap: 8px; margin-bottom: 7px; }
.st-svc input { margin-top: 0 !important; }
.st-svc input.sm { width: 92px; flex: none; }
.st-svc input.xs { width: 74px; flex: none; }
.st-x {
  background: none; border: 1px solid var(--line); border-radius: 10px; width: 40px;
  flex: none; font-size: 19px; color: var(--fade); cursor: pointer; font-family: inherit;
}
.st-x:hover { border-color: #B3452F; color: #B3452F; }
.st-add {
  background: none; border: 1px dashed var(--line); border-radius: 10px; width: 100%;
  padding: 12px; font-size: 13.5px; color: var(--mut); cursor: pointer; font-family: inherit;
}
.st-add:hover { border-color: var(--c); color: var(--c); }

.st-day {
  display: flex; justify-content: space-between; align-items: center; gap: 14px;
  padding: 11px 0; border-bottom: 1px solid var(--line);
}
.st-toggle { display: flex !important; align-items: center; gap: 9px; margin: 0 !important; cursor: pointer; }
.st-toggle input { width: 17px; height: 17px; accent-color: var(--c); margin: 0 !important; }
.st-times { display: flex; align-items: center; gap: 7px; }
.st-times input { width: 108px !important; margin: 0 !important; padding: 8px 10px !important; font-size: 13.5px !important; }
.st-times em { font-style: normal; color: var(--fade); font-size: 12px; }
.st-closed { font-size: 13px; color: var(--fade); }

.st-err { color: #B3452F; font-size: 13px; margin-top: 16px; }
.st-nav { display: flex; gap: 10px; margin-top: 34px; }
.st-btn {
  background: var(--c); color: #fff; border: 0; border-radius: 999px;
  padding: 14px 30px; font-size: 15px; font-weight: 600; cursor: pointer;
  font-family: inherit; text-decoration: none; display: inline-block; text-align: center;
  transition: transform .15s ease, filter .15s ease;
}
.st-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
.st-btn:disabled { opacity: .35; cursor: default; }
.st-btn.ghost { background: none; color: var(--mut); border: 1px solid var(--line); }
.st-btn.ghost:hover { color: var(--ink); border-color: var(--ink); }

/* preview */
.st-preview { position: sticky; top: 90px; align-self: start; }
.st-pv-label {
  font-size: 11px; text-transform: uppercase; letter-spacing: .14em;
  color: var(--fade); margin-bottom: 12px; font-weight: 600;
}
.st-pv {
  background: #fff; border: 1px solid var(--line); border-radius: 18px; overflow: hidden;
  box-shadow: 0 16px 50px rgba(18,16,14,.09);
}
.st-pv-top {
  display: flex; align-items: center; gap: 11px; padding: 14px 16px;
  background: var(--c); color: #fff; transition: background .3s ease;
}
.st-pv-mark {
  width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,.22);
  display: grid; place-items: center; font-family: "Fraunces", serif; font-size: 16px; font-weight: 560;
}
.st-pv-name { font-weight: 600; font-size: 14.5px; }
.st-pv-sub { font-size: 11px; opacity: .85; display: flex; align-items: center; gap: 5px; margin-top: 1px; }
.st-pv-sub i { width: 6px; height: 6px; border-radius: 50%; background: #6FE3B4; display: inline-block; }
.st-pv-log { padding: 15px; display: flex; flex-direction: column; gap: 8px; min-height: 170px; background: #FDFCFA; }
.st-pv-b { max-width: 86%; padding: 9px 13px; font-size: 13px; line-height: 1.5; }
.st-pv-b.a { align-self: flex-start; background: #fff; border: 1px solid var(--line); border-radius: 14px 14px 14px 3px; }
.st-pv-b.c { align-self: flex-end; background: var(--c); color: #fff; border-radius: 14px 14px 3px 14px; margin-top: 8px; }
.st-pv-note { font-size: 12px; color: var(--fade); margin-top: 14px; line-height: 1.55; }

/* done */
.st-done { max-width: 560px; margin: 0 auto; padding: clamp(56px, 10vw, 110px) 24px; text-align: center; }
.st-tick {
  width: 60px; height: 60px; border-radius: 50%; background: var(--c); color: #fff;
  display: grid; place-items: center; font-size: 28px; margin: 0 auto 26px;
  box-shadow: 0 10px 34px color-mix(in oklab, var(--c) 40%, transparent);
}
.st-done h1 { font-family: "Fraunces", serif; font-weight: 560; font-size: clamp(28px, 5vw, 42px); letter-spacing: -0.025em; margin: 0; }
.st-done .st-lede { margin-inline: auto; }
.st-linkbox {
  display: flex; gap: 8px; align-items: center; background: #fff; border: 1px solid var(--line);
  border-radius: 12px; padding: 8px 8px 8px 15px; margin: 8px 0 22px; text-align: start;
}
.st-linkbox code {
  flex: 1; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-family: ui-monospace, Menlo, monospace; color: var(--mut);
}
.st-linkbox button {
  background: var(--c); color: #fff; border: 0; border-radius: 8px; padding: 9px 16px;
  font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
}
.st-keys { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 18px; text-align: start; }
.st-keys > div { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.st-keys span { font-size: 12px; color: var(--fade); text-transform: uppercase; letter-spacing: .09em; font-weight: 600; }
.st-keys code {
  font-family: ui-monospace, Menlo, monospace; font-size: 15px; font-weight: 600;
  background: #F4F2ED; padding: 6px 12px; border-radius: 6px; letter-spacing: .04em;
}
.st-keys p { font-size: 12px; color: var(--mut); margin: 12px 0 0; line-height: 1.55; }
.st-doneacts { display: flex; gap: 10px; justify-content: center; margin-top: 28px; flex-wrap: wrap; }

@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`;
