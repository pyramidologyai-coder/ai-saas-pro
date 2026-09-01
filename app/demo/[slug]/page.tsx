"use client";

/**
 * The page a patient lands on. This is also the page a prospect judges.
 *
 * Direction: premium modern healthcare — warm, calm, expensive. Fraunces for
 * display (a serif with real character), Instrument Sans for UI. A soft
 * atmosphere washed from the tenant's own brand colour, so every business gets
 * its own weather. The signature element is the hero ask bar: the page's whole
 * job is "ask us", so the input sits front and centre — type into the hero and
 * the conversation begins.
 *
 * Fully white-labelled from the database. Four languages; Arabic mirrors the
 * entire layout.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  LANGUAGES, COPY, isRtl, fill, detectLang, type LangCode,
} from "@/lib/i18n";

type Service = {
  name: string; description: string | null;
  price: number | null; currency: string; minutes: number | null;
};
type Config = {
  business_name: string; agent_name: string; color: string;
  logo_url: string | null; subtitle: string; tagline: string | null;
  address: string | null; map_url: string | null; phone: string | null;
  timezone: string; vertical: string;
  hours: Record<string, [string, string] | null> | null;
  greeting: string; suggestions: string[]; services: Service[];
};
type Msg = { role: "user" | "agent"; text: string };

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export default function PublicPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;

  const [cfg, setCfg] = useState<Config | null>(null);
  const [lang, setLang] = useState<LangCode>("en");
  const [langOpen, setLangOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [heroInput, setHeroInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const t = COPY[lang];
  const rtl = isRtl(lang);

  useEffect(() => { setLang(detectLang()); }, []);

  useEffect(() => {
    let live = true;
    fetch(`/api/widget-config?slug=${encodeURIComponent(slug)}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((c: Config) => {
        if (live) { setCfg(c); setMessages([{ role: "agent", text: c.greeting }]); }
      })
      .catch(() => { if (live) setCfg(null); });
    return () => { live = false; };
  }, [slug]);

  useEffect(() => {
    const key = `automology-session-${slug}`;
    let s = "";
    try {
      s = localStorage.getItem(key) ?? "";
      if (!s) { s = `web-${Math.random().toString(36).slice(2)}-${Date.now()}`; localStorage.setItem(key, s); }
    } catch { s = `web-${Math.random().toString(36).slice(2)}`; }
    setSession(s);
  }, [slug]);

  useEffect(() => {
    if (chatOpen) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, chatOpen]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
  }, [lang, rtl]);

  const status = useMemo(() => {
    if (!cfg?.hours) return null;
    const tz = cfg.timezone || "Asia/Kuala_Lumpur";
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date());
    const wd = parts.find(p => p.type === "weekday")?.value ?? "Mon";
    const nowMin = Number(parts.find(p => p.type === "hour")?.value ?? 0) * 60
                 + Number(parts.find(p => p.type === "minute")?.value ?? 0);
    const idx = Math.max(0, ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].indexOf(wd));
    const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

    const today = cfg.hours[DAY_KEYS[idx]];
    if (today) {
      const [open, close] = today;
      if (nowMin >= toMin(open) && nowMin < toMin(close))
        return { open: true, text: fill(t.closesAt, { time: close }) };
      if (nowMin < toMin(open))
        return { open: false, text: fill(t.opensAt, { day: t.today.toLowerCase(), time: open }) };
    }
    for (let i = 1; i <= 7; i++) {
      const k = DAY_KEYS[(idx + i) % 7];
      const h = cfg.hours[k];
      if (h) return { open: false, text: fill(t.opensAt, { day: t.days[DAY_KEYS.indexOf(k)], time: h[0] }) };
    }
    return { open: false, text: t.closedNow };
  }, [cfg, t]);

  const send = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean || busy || !session) return;
    setChatOpen(true);
    setMessages(m => [...m, { role: "user", text: clean }]);
    setInput(""); setHeroInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, session, message: clean }),
      });
      const d = await res.json();
      setMessages(m => [...m, { role: "agent", text: d.reply ?? fallbackText(d.error) }]);
    } catch {
      setMessages(m => [...m, { role: "agent", text: fallbackText() }]);
    } finally { setBusy(false); }
  }, [busy, session, slug]);

  if (!cfg) return <div className="ap-loading">…</div>;

  const C = cfg.color || "#1D6A8C";
  const firstVisit = messages.length === 1;

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="ap" style={{ "--c": C } as React.CSSProperties}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,440;9..144,560&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* atmosphere */}
      <div className="ap-sky" aria-hidden>
        <span className="ap-blob b1" /><span className="ap-blob b2" /><span className="ap-blob b3" />
      </div>

      {/* ── header ─────────────────────────────────────────────── */}
      <header className="ap-head">
        <div className="ap-brand">
          {cfg.logo_url
            ? <img src={cfg.logo_url} alt="" className="ap-logo" />
            : <div className="ap-mark">{cfg.business_name.charAt(0)}</div>}
          <div>
            <div className="ap-bizname">{cfg.business_name}</div>
            {status && (
              <div className="ap-status">
                <span className={`ap-pulse ${status.open ? "on" : ""}`} />
                <b>{status.open ? t.openNow : t.closedNow}</b>
                <span className="ap-status-sub">· {status.text}</span>
              </div>
            )}
          </div>
        </div>

        <div className="ap-langwrap">
          <button className="ap-langbtn" onClick={() => setLangOpen(o => !o)} aria-expanded={langOpen}>
            {LANGUAGES.find(l => l.code === lang)?.label} <span className="ap-caret">▾</span>
          </button>
          {langOpen && (
            <div className="ap-langmenu">
              {LANGUAGES.map(l => (
                <button key={l.code} className={l.code === lang ? "sel" : ""}
                        onClick={() => { setLang(l.code); setLangOpen(false); }}>
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="ap-main">
        {/* ── hero ─────────────────────────────────────────────── */}
        <section className="ap-hero">
          {cfg.tagline && <p className="ap-eyebrow rise" style={{ animationDelay: ".05s" }}>{cfg.tagline}</p>}
          <h1 className="ap-h1 rise" style={{ animationDelay: ".12s" }}>{t.askUs}</h1>
          <p className="ap-herosub rise" style={{ animationDelay: ".2s" }}>
            {fill(t.chatWith, { name: cfg.agent_name })} — {t.poweredNote}
          </p>

          {/* the signature: ask from the hero */}
          <div className="ap-askbar rise" style={{ animationDelay: ".28s" }}>
            <input
              value={heroInput}
              onChange={e => setHeroInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") send(heroInput); }}
              placeholder={t.typeMessage}
              aria-label={t.typeMessage}
            />
            <button onClick={() => send(heroInput)} disabled={!heroInput.trim() || busy}>
              {t.send}
            </button>
          </div>

          <div className="ap-chips rise" style={{ animationDelay: ".36s" }}>
            {cfg.suggestions.slice(0, 3).map(q => (
              <button key={q} className="ap-chip" onClick={() => send(q)}>{q}</button>
            ))}
          </div>
        </section>

        {/* ── services ─────────────────────────────────────────── */}
        {cfg.services.length > 0 && (
          <section className="ap-section">
            <h2 className="ap-h2">{t.services}</h2>
            <div className="ap-grid">
              {cfg.services.map((s, i) => (
                <article key={s.name} className="ap-card rise" style={{ animationDelay: `${.08 * i}s` }}>
                  <div className="ap-card-top">
                    <h3>{s.name}</h3>
                    {s.minutes && <span className="ap-min">{fill(t.minutes, { n: s.minutes })}</span>}
                  </div>
                  {s.description && <p className="ap-card-desc">{s.description}</p>}
                  <div className="ap-card-foot">
                    {s.price != null
                      ? <div className="ap-price"><span>{s.currency}</span>{Number(s.price).toFixed(2)}</div>
                      : <div className="ap-price ask">—</div>}
                    <button className="ap-ask" onClick={() => send(s.name)}>{t.askAboutIt} →</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ── hours + find us ──────────────────────────────────── */}
        <section className="ap-band">
          <div className="ap-cols">
            {cfg.hours && (
              <div>
                <h2 className="ap-h2">{t.hours}</h2>
                <div className="ap-hours">
                  {DAY_KEYS.map((k, i) => {
                    const h = cfg.hours![k];
                    return (
                      <div key={k} className="ap-hrow">
                        <span>{t.days[i]}</span>
                        <span className={`ap-time ${h ? "" : "off"}`}>
                          {h ? `${h[0]} – ${h[1]}` : t.closedNow}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              {cfg.address && (
                <>
                  <h2 className="ap-h2">{t.findUs}</h2>
                  <p className="ap-addr">{cfg.address}</p>
                  {cfg.map_url && (
                    <a className="ap-maplink" href={cfg.map_url} target="_blank" rel="noreferrer">
                      {t.findUs} ↗
                    </a>
                  )}
                </>
              )}
              {cfg.phone && (
                <a className="ap-call" href={`tel:${cfg.phone.replace(/\s/g, "")}`}>
                  {t.callUs} · {cfg.phone}
                </a>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ── footer ─────────────────────────────────────────────── */}
      <footer className="ap-foot">
        <div className="ap-foot-name">{cfg.business_name}</div>
        <div className="ap-foot-sub">{cfg.subtitle}</div>
      </footer>

      {/* ── chat ───────────────────────────────────────────────── */}
      {!chatOpen && (
        <button className="ap-launch"
          onClick={() => { setChatOpen(true); setTimeout(() => inputRef.current?.focus(), 90); }}>
          <span className="ap-launch-dot" />
          {fill(t.chatWith, { name: cfg.agent_name })}
        </button>
      )}

      {chatOpen && (
        <div className="ap-panel" role="dialog" aria-label={fill(t.chatWith, { name: cfg.agent_name })}>
          <div className="ap-panel-head">
            <div className="ap-panel-brand">
              <div className="ap-panel-mark">{cfg.agent_name.charAt(0)}</div>
              <div>
                <div className="ap-panel-name">{cfg.agent_name}</div>
                <div className="ap-panel-sub">{cfg.subtitle}</div>
              </div>
            </div>
            <button className="ap-panel-x" onClick={() => setChatOpen(false)} aria-label={t.close}>×</button>
          </div>

          <div className="ap-log">
            {messages.map((m, i) => (
              <div key={i} className={`ap-row ${m.role === "user" ? "u" : "a"}`}>
                <div className={`ap-bub ${m.role === "user" ? "u" : "a"}`}>{m.text}</div>
              </div>
            ))}
            {busy && (
              <div className="ap-row a">
                <div className="ap-bub a ap-typing"><i /><i /><i /></div>
              </div>
            )}
            {firstVisit && !busy && (
              <div className="ap-panel-chips">
                {cfg.suggestions.slice(0, 3).map(q => (
                  <button key={q} className="ap-chip sm" onClick={() => send(q)}>{q}</button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="ap-inrow">
            <input ref={inputRef} value={input} disabled={busy}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder={t.typeMessage} aria-label={t.typeMessage} />
            <button onClick={() => send(input)} disabled={busy || !input.trim()}>{t.send}</button>
          </div>
        </div>
      )}

      <style>{CSS}</style>
    </div>
  );
}

function fallbackText(error?: string) {
  if (error === "origin_not_allowed") return "This chat isn't enabled for this site yet.";
  return "Give me a moment — I'll have someone get back to you.";
}

const CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; }

.ap {
  --ink: #191817;
  --mut: #6E6B66;
  --fade: #A8A49D;
  --line: color-mix(in oklab, var(--c) 14%, #E9E6E0);
  --wash: color-mix(in oklab, var(--c) 5%, #FDFCFA);
  --wash2: color-mix(in oklab, var(--c) 9%, #FBFAF7);
  --deep: color-mix(in oklab, var(--c) 72%, #14130f);
  min-height: 100vh;
  background: var(--wash);
  color: var(--ink);
  font-family: "Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  overflow-x: hidden;
  position: relative;
}
.ap-loading {
  min-height: 100vh; display: grid; place-items: center;
  color: #B7B3AC; font-family: system-ui, sans-serif; background: #FBFAF7;
}

/* atmosphere */
.ap-sky { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
.ap-blob {
  position: absolute; border-radius: 50%; filter: blur(90px); opacity: .5;
}
.b1 { width: 560px; height: 560px; background: color-mix(in oklab, var(--c) 22%, transparent);
      top: -220px; inset-inline-end: -140px; animation: drift 26s ease-in-out infinite alternate; }
.b2 { width: 420px; height: 420px; background: color-mix(in oklab, var(--c) 14%, transparent);
      top: 30%; inset-inline-start: -200px; animation: drift 32s ease-in-out infinite alternate-reverse; }
.b3 { width: 380px; height: 380px; background: color-mix(in oklab, var(--c) 10%, transparent);
      bottom: -160px; inset-inline-end: 18%; animation: drift 38s ease-in-out infinite alternate; }
@keyframes drift {
  from { transform: translate(0, 0) scale(1); }
  to   { transform: translate(-50px, 36px) scale(1.12); }
}

/* header */
.ap-head {
  position: sticky; top: 0; z-index: 30;
  display: flex; justify-content: space-between; align-items: center; gap: 14px;
  padding: 14px clamp(18px, 4vw, 40px);
  background: color-mix(in oklab, var(--wash) 78%, transparent);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--line);
}
.ap-brand { display: flex; align-items: center; gap: 12px; }
.ap-logo { width: 42px; height: 42px; border-radius: 10px; object-fit: cover; }
.ap-mark {
  width: 42px; height: 42px; border-radius: 10px; background: var(--c); color: #fff;
  display: grid; place-items: center; font-weight: 600; font-size: 18px;
  font-family: "Fraunces", serif;
  box-shadow: 0 4px 14px color-mix(in oklab, var(--c) 40%, transparent);
}
.ap-bizname { font-weight: 600; font-size: 15.5px; letter-spacing: -0.01em; }
.ap-status { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-top: 3px; color: var(--ink); }
.ap-status b { font-weight: 600; }
.ap-status-sub { color: var(--mut); font-weight: 400; }
.ap-pulse {
  width: 7px; height: 7px; border-radius: 50%; background: #B7B3AC; position: relative;
}
.ap-pulse.on { background: #2E8B6E; }
.ap-pulse.on::after {
  content: ""; position: absolute; inset: -4px; border-radius: 50%;
  border: 1.5px solid #2E8B6E; opacity: .5; animation: ping 2s ease-out infinite;
}
@keyframes ping { from { transform: scale(.5); opacity: .7; } to { transform: scale(1.5); opacity: 0; } }

.ap-langwrap { position: relative; }
.ap-langbtn {
  background: #fff; border: 1px solid var(--line); border-radius: 999px;
  padding: 8px 15px; font-size: 12.5px; cursor: pointer; font-family: inherit; color: var(--ink);
  display: flex; align-items: center; gap: 6px; box-shadow: 0 1px 4px rgba(20,19,15,.05);
}
.ap-caret { font-size: 9px; color: var(--fade); }
.ap-langmenu {
  position: absolute; top: calc(100% + 8px); inset-inline-end: 0; min-width: 170px;
  background: #fff; border: 1px solid var(--line); border-radius: 14px; overflow: hidden;
  box-shadow: 0 16px 50px rgba(20,19,15,.14); z-index: 40;
  animation: pop .18s ease both;
}
@keyframes pop { from { opacity: 0; transform: translateY(-5px) scale(.98); } }
.ap-langmenu button {
  display: block; width: 100%; text-align: start; background: none; border: 0;
  padding: 11px 16px; font-size: 13.5px; cursor: pointer; font-family: inherit; color: var(--ink);
}
.ap-langmenu button:hover { background: var(--wash2); }
.ap-langmenu button.sel { background: var(--wash2); font-weight: 600; }

/* layout */
.ap-main { position: relative; z-index: 1; max-width: 960px; margin: 0 auto; padding: 0 clamp(18px, 4vw, 40px); }

/* hero */
.ap-hero { padding: clamp(56px, 10vw, 104px) 0 clamp(40px, 6vw, 64px); }
.ap-eyebrow {
  font-size: 13px; letter-spacing: .14em; text-transform: uppercase;
  color: color-mix(in oklab, var(--c) 80%, var(--ink)); font-weight: 600; margin: 0 0 18px;
}
.ap-h1 {
  font-family: "Fraunces", Georgia, serif; font-weight: 560;
  font-size: clamp(40px, 8.5vw, 72px); line-height: 1.02; letter-spacing: -0.02em;
  margin: 0; max-width: 14ch;
}
.ap-herosub { font-size: 16px; color: var(--mut); margin: 18px 0 0; line-height: 1.6; max-width: 46ch; }

.ap-askbar {
  margin-top: 34px; display: flex; gap: 8px; padding: 8px;
  background: #fff; border: 1px solid var(--line); border-radius: 18px;
  box-shadow: 0 10px 40px color-mix(in oklab, var(--c) 12%, rgba(20,19,15,.08));
  max-width: 560px;
  transition: box-shadow .25s ease, transform .25s ease;
}
.ap-askbar:focus-within {
  box-shadow: 0 14px 52px color-mix(in oklab, var(--c) 22%, rgba(20,19,15,.10));
  transform: translateY(-1px);
}
.ap-askbar input {
  flex: 1; border: 0; background: none; padding: 12px 14px; font-size: 15.5px;
  font-family: inherit; color: var(--ink); min-width: 0;
}
.ap-askbar input:focus { outline: none; }
.ap-askbar button {
  background: var(--c); color: #fff; border: 0; border-radius: 12px;
  padding: 12px 22px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit;
  transition: transform .15s ease, filter .15s ease;
}
.ap-askbar button:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
.ap-askbar button:disabled { opacity: .35; cursor: default; }

.ap-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.ap-chip {
  background: color-mix(in oklab, var(--c) 7%, #fff);
  border: 1px solid color-mix(in oklab, var(--c) 22%, #E9E6E0);
  color: color-mix(in oklab, var(--c) 85%, var(--ink));
  border-radius: 999px; padding: 9px 16px; font-size: 13px; cursor: pointer; font-family: inherit;
  transition: transform .15s ease, background .15s ease;
}
.ap-chip:hover { background: color-mix(in oklab, var(--c) 13%, #fff); transform: translateY(-1px); }
.ap-chip.sm { padding: 7px 13px; font-size: 12px; }

/* sections */
.ap-section { padding: clamp(36px, 6vw, 60px) 0; }
.ap-h2 {
  font-size: 12px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase;
  color: var(--fade); margin: 0 0 22px;
}

/* service cards */
.ap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(272px, 1fr)); gap: 14px; }
.ap-card {
  background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 22px;
  display: flex; flex-direction: column; gap: 10px;
  transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
}
.ap-card:hover {
  transform: translateY(-3px);
  border-color: color-mix(in oklab, var(--c) 34%, #E9E6E0);
  box-shadow: 0 18px 44px color-mix(in oklab, var(--c) 13%, rgba(20,19,15,.09));
}
.ap-card-top { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
.ap-card h3 {
  font-family: "Fraunces", Georgia, serif; font-weight: 560;
  font-size: 19px; letter-spacing: -0.01em; margin: 0; line-height: 1.25;
}
.ap-min { font-size: 11px; color: var(--fade); white-space: nowrap; font-variant-numeric: tabular-nums; }
.ap-card-desc { font-size: 13px; color: var(--mut); line-height: 1.55; margin: 0; flex: 1; }
.ap-card-foot { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-top: 6px; }
.ap-price { font-size: 21px; font-weight: 600; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.ap-price span { font-size: 11px; color: var(--fade); font-weight: 500; margin-inline-end: 4px; }
.ap-ask {
  background: none; border: 0; padding: 0; font-size: 12.5px; font-weight: 600;
  color: color-mix(in oklab, var(--c) 88%, var(--ink)); cursor: pointer; font-family: inherit;
}
.ap-ask:hover { text-decoration: underline; text-underline-offset: 3px; }

/* hours band */
.ap-band {
  background: #fff; border: 1px solid var(--line); border-radius: 22px;
  padding: clamp(26px, 4vw, 40px); margin: 10px 0 clamp(40px, 7vw, 70px);
  box-shadow: 0 8px 34px rgba(20,19,15,.05);
}
.ap-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 40px; }
.ap-hours {}
.ap-hrow {
  display: flex; justify-content: space-between; gap: 16px; padding: 8px 0;
  border-bottom: 1px dashed color-mix(in oklab, var(--c) 10%, #ECEAE4); font-size: 13.5px;
}
.ap-hrow > span:first-child { color: var(--mut); }
.ap-time { font-variant-numeric: tabular-nums; font-weight: 500; }
.ap-time.off { color: var(--fade); font-weight: 400; }
.ap-addr { font-size: 14.5px; line-height: 1.65; margin: 0 0 10px; }
.ap-maplink {
  font-size: 13px; font-weight: 600; text-decoration: none;
  color: color-mix(in oklab, var(--c) 88%, var(--ink));
}
.ap-maplink:hover { text-decoration: underline; text-underline-offset: 3px; }
.ap-call {
  display: inline-block; margin-top: 20px; background: var(--c); color: #fff;
  border-radius: 999px; padding: 11px 20px; font-size: 13.5px; font-weight: 600;
  text-decoration: none; box-shadow: 0 6px 20px color-mix(in oklab, var(--c) 35%, transparent);
  transition: transform .15s ease, filter .15s ease;
}
.ap-call:hover { transform: translateY(-1px); filter: brightness(1.06); }

/* footer */
.ap-foot {
  position: relative; z-index: 1; background: var(--deep); color: #fff;
  padding: clamp(40px, 7vw, 72px) clamp(18px, 4vw, 40px);
}
.ap-foot-name {
  font-family: "Fraunces", Georgia, serif; font-weight: 560;
  font-size: clamp(26px, 5vw, 44px); letter-spacing: -0.02em;
}
.ap-foot-sub { opacity: .55; font-size: 13px; margin-top: 8px; }

/* launcher */
.ap-launch {
  position: fixed; bottom: 22px; inset-inline-end: 22px; z-index: 50;
  display: flex; align-items: center; gap: 9px;
  background: var(--c); color: #fff; border: 0; border-radius: 999px;
  padding: 15px 24px; font-size: 14.5px; font-weight: 600; cursor: pointer; font-family: inherit;
  box-shadow: 0 12px 36px color-mix(in oklab, var(--c) 45%, rgba(20,19,15,.2));
  transition: transform .18s ease, box-shadow .18s ease;
  animation: rise .5s ease both .5s;
}
.ap-launch:hover { transform: translateY(-2px); box-shadow: 0 16px 44px color-mix(in oklab, var(--c) 55%, rgba(20,19,15,.22)); }
.ap-launch-dot { width: 8px; height: 8px; border-radius: 50%; background: #fff; opacity: .9; animation: ping 2.4s ease-out infinite; }

/* chat panel */
.ap-panel {
  position: fixed; bottom: 22px; inset-inline-end: 22px; z-index: 60;
  width: min(400px, calc(100vw - 44px)); height: min(620px, calc(100vh - 44px));
  background: #FDFCFA; border-radius: 22px; overflow: hidden;
  display: flex; flex-direction: column;
  box-shadow: 0 0 0 1px var(--line), 0 30px 90px color-mix(in oklab, var(--c) 18%, rgba(20,19,15,.25));
  animation: panelin .3s cubic-bezier(.2,.9,.3,1.1) both;
}
@keyframes panelin { from { opacity: 0; transform: translateY(16px) scale(.97); } }
.ap-panel-head {
  background: linear-gradient(135deg, var(--c), color-mix(in oklab, var(--c) 70%, #14130f));
  color: #fff; padding: 15px 17px;
  display: flex; justify-content: space-between; align-items: center; gap: 10px;
}
.ap-panel-brand { display: flex; align-items: center; gap: 11px; }
.ap-panel-mark {
  width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,.2);
  display: grid; place-items: center; font-weight: 600; font-size: 16px;
  font-family: "Fraunces", serif;
}
.ap-panel-name { font-weight: 600; font-size: 15px; }
.ap-panel-sub { font-size: 11px; opacity: .82; margin-top: 1px; }
.ap-panel-x { background: none; border: 0; color: #fff; font-size: 24px; line-height: 1; cursor: pointer; opacity: .85; padding: 0 2px; }
.ap-panel-x:hover { opacity: 1; }

.ap-log { flex: 1; overflow-y: auto; padding: 16px; }
.ap-row { display: flex; margin-bottom: 10px; }
.ap-row.u { justify-content: flex-end; }
.ap-row.a { justify-content: flex-start; }
[dir="rtl"] .ap-row.u { justify-content: flex-start; }
[dir="rtl"] .ap-row.a { justify-content: flex-end; }
.ap-bub {
  max-width: 82%; padding: 10px 14px; font-size: 14px; line-height: 1.55; white-space: pre-wrap;
  animation: bubin .22s ease both;
}
@keyframes bubin { from { opacity: 0; transform: translateY(5px); } }
.ap-bub.u { background: var(--c); color: #fff; border-radius: 16px 16px 4px 16px; }
[dir="rtl"] .ap-bub.u { border-radius: 16px 16px 16px 4px; }
.ap-bub.a { background: #fff; border: 1px solid var(--line); border-radius: 16px 16px 16px 4px; }
[dir="rtl"] .ap-bub.a { border-radius: 16px 16px 4px 16px; }
.ap-typing { display: flex; gap: 4px; align-items: center; }
.ap-typing i {
  width: 6px; height: 6px; border-radius: 50%; background: var(--fade);
  animation: blink 1.2s infinite;
}
.ap-typing i:nth-child(2) { animation-delay: .15s; }
.ap-typing i:nth-child(3) { animation-delay: .3s; }
@keyframes blink { 0%,80%,100% { opacity: .25; } 40% { opacity: 1; } }
.ap-panel-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }

.ap-inrow { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--line); background: #fff; }
.ap-inrow input {
  flex: 1; border: 1px solid var(--line); border-radius: 12px; padding: 11px 14px;
  font-size: 14.5px; font-family: inherit; min-width: 0; color: var(--ink); background: #FDFCFA;
}
.ap-inrow input:focus { outline: 2px solid color-mix(in oklab, var(--c) 55%, transparent); outline-offset: 1px; }
.ap-inrow button {
  background: var(--c); color: #fff; border: 0; border-radius: 12px; padding: 11px 18px;
  font-size: 13.5px; font-weight: 600; cursor: pointer; font-family: inherit;
}
.ap-inrow button:disabled { opacity: .35; cursor: default; }

/* entrance animation */
.rise { animation: rise .55s cubic-bezier(.2,.8,.3,1) both; }
@keyframes rise { from { opacity: 0; transform: translateY(14px); } }

button:focus-visible, a:focus-visible, input:focus-visible { outline: 2px solid var(--c); outline-offset: 3px; }

@media (max-width: 620px) {
  .ap-panel { inset: 0; width: 100%; height: 100%; border-radius: 0; }
  .ap-askbar button { padding: 12px 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .rise, .ap-launch, .ap-panel, .ap-bub, .ap-blob, .ap-pulse.on::after, .ap-launch-dot { animation: none !important; }
  .ap-card:hover, .ap-askbar:focus-within { transform: none; }
}
`;
