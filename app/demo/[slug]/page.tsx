"use client";

/**
 * The page a patient lands on. This is also the page a prospect judges.
 *
 * Direction: the Stripe register — white and spacious, deep navy text, ONE
 * confident colour (the tenant's own), ONE fluid gradient, and restraint
 * everywhere else. Marketing copy on the left, the live conversation as a
 * product card on the right. The navy and the greys are fixed; only the accent
 * and the gradient are washed from the tenant's brand colour, so every business
 * keeps its own identity on a calm, premium canvas.
 *
 * Fully white-labelled from the database. Four languages; Arabic mirrors the
 * entire layout. All of the behaviour below is unchanged from the previous
 * design — only the presentation is new.
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
    if (chatOpen) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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

  if (!cfg) return <div className="rx-loading">…</div>;

  const C = cfg.color || "#635BFF";
  void heroInput;

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="rx" style={{ "--c": C } as React.CSSProperties}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div className="rx-aura" aria-hidden />

      <div className="rx-shell">
        {/* ── header ─────────────────────────────────────────── */}
        <header className="rx-head">
          <div className="rx-brand">
            {cfg.logo_url && <img src={cfg.logo_url} alt="" className="rx-logo" />}
            <span className="rx-word">{cfg.business_name}</span>
            {status && (
              <span className={`rx-hpill ${status.open ? "on" : ""}`}>
                <span className="rx-dot" />{status.open ? t.openNow : t.closedNow}
              </span>
            )}
          </div>

          <div className="rx-langwrap">
            <button className="rx-langbtn" onClick={() => setLangOpen(o => !o)} aria-expanded={langOpen}>
              {LANGUAGES.find(l => l.code === lang)?.label} <span className="rx-caret">▾</span>
            </button>
            {langOpen && (
              <div className="rx-langmenu">
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

        {/* ── hero: copy left, live chat right ───────────────── */}
        <section className="rx-hero">
          <div className="rx-copy">
            {cfg.tagline && <p className="rx-eyebrow">{cfg.tagline}</p>}
            <h1 className="rx-h1">{t.askUs}</h1>
            <p className="rx-lede">{fill(t.chatWith, { name: cfg.agent_name })} — {t.poweredNote}</p>
            <div className="rx-cta">
              <button className="rx-btn" onClick={() => inputRef.current?.focus()}>
                {fill(t.chatWith, { name: cfg.agent_name })}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
            {cfg.suggestions.length > 0 && (
              <div className="rx-chips">
                {cfg.suggestions.slice(0, 3).map(q => (
                  <button key={q} className="rx-chip" onClick={() => send(q)}>{q}</button>
                ))}
              </div>
            )}
          </div>

          <div className="rx-chat">
            <div className="rx-chat-top">
              <div className="rx-ava">{cfg.agent_name.charAt(0)}</div>
              <div>
                <div className="rx-who">{cfg.agent_name}</div>
                <div className="rx-csub"><span className="rx-dot on" /> {t.poweredNote}</div>
              </div>
            </div>
            <div className="rx-log">
              {messages.map((m, i) => (
                <div key={i} className={`rx-row ${m.role === "user" ? "u" : "a"}`}>
                  <div className={`rx-b ${m.role === "user" ? "u" : "a"}`}>{m.text}</div>
                </div>
              ))}
              {busy && <div className="rx-row a"><div className="rx-b a rx-typing"><i /><i /><i /></div></div>}
              <div ref={endRef} />
            </div>
            <div className="rx-foot">
              <input ref={inputRef} value={input} disabled={busy}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder={t.typeMessage} aria-label={t.typeMessage} />
              <button className="rx-go" onClick={() => send(input)} disabled={busy || !input.trim()} aria-label={t.send}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        </section>

        {/* ── info band ──────────────────────────────────────── */}
        {(cfg.services.length > 0 || cfg.hours || cfg.address || cfg.phone) && (
          <section className="rx-band">
            {cfg.services.length > 0 && (
              <div className="rx-svc">
                <p className="rx-lbl">{t.services}</p>
                {cfg.services.map(s => (
                  <button key={s.name} className="rx-item" onClick={() => send(s.name)}>
                    <span className="rx-item-l">
                      <span className="rx-item-n">{s.name}</span>
                      {s.description && <span className="rx-item-d">{s.description}</span>}
                    </span>
                    <span className="rx-item-r">
                      <span className="rx-item-p">
                        {s.price != null ? `${s.currency} ${Number(s.price).toFixed(0)}` : t.askAboutIt}
                      </span>
                      {s.minutes && <span className="rx-item-m">{fill(t.minutes, { n: s.minutes })}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {cfg.hours && (
              <div>
                <p className="rx-lbl">{t.hours}</p>
                <div className="rx-sched">
                  {DAY_KEYS.map((k, i) => {
                    const h = cfg.hours![k];
                    return (
                      <div key={k} className="rx-srow">
                        <span className="rx-k">{t.days[i]}</span>
                        <span className={`rx-v ${h ? "" : "off"}`}>{h ? `${h[0]} – ${h[1]}` : t.closedNow}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(cfg.address || cfg.phone) && (
              <div>
                <p className="rx-lbl">{t.findUs}</p>
                <p className="rx-addr">
                  {cfg.address}
                  {cfg.map_url && <>{cfg.address ? <br /> : null}<a href={cfg.map_url} target="_blank" rel="noreferrer">{t.findUs} ↗</a></>}
                  {cfg.phone && <><br /><a href={`tel:${cfg.phone.replace(/\s/g, "")}`}>{cfg.phone}</a></>}
                </p>
              </div>
            )}
          </section>
        )}
      </div>

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

.rx {
  /* fixed neutrals — the Stripe navy/greys never change */
  --ink: #0A2540;
  --ink-2: #425466;
  --ink-3: #7B8698;
  --line: #E7EBF0;
  --line-2: #EEF1F5;
  --paper: #FFFFFF;
  --ok: #3ECF8E;
  /* --c is the tenant's accent, set inline */
  --deep: color-mix(in oklab, var(--c) 74%, #0A1F3B);
  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
  font-family: "Hanken Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif;
  line-height: 1.5;
  overflow-x: hidden;
  position: relative;
}
.rx-loading {
  min-height: 100vh; display: grid; place-items: center;
  color: #B7C0CC; font-family: system-ui, sans-serif; background: #fff;
}

/* the one expressive element: a fluid gradient washed from the tenant colour */
.rx-aura {
  position: absolute; top: -260px; inset-inline-end: -180px;
  width: 820px; height: 760px; z-index: 0; pointer-events: none;
  background: conic-gradient(from 210deg at 58% 42%,
    var(--c),
    color-mix(in oklab, var(--c) 55%, #8B5CF6),
    color-mix(in oklab, var(--c) 45%, #EC4899),
    color-mix(in oklab, var(--c) 55%, #FB923C),
    color-mix(in oklab, var(--c) 55%, #22D3EE),
    var(--c));
  filter: blur(80px) saturate(130%); opacity: .40; border-radius: 48% 52% 55% 45%;
}
@media (max-width: 760px) { .rx-aura { width: 560px; height: 520px; top: -200px; opacity: .48; } }

.rx-shell { position: relative; z-index: 1; max-width: 1140px; margin: 0 auto; padding: 0 clamp(18px, 4vw, 44px); }

/* header */
.rx-head { display: flex; align-items: center; gap: 16px; padding: 22px 0 8px; }
.rx-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.rx-logo { width: 34px; height: 34px; border-radius: 9px; object-fit: cover; }
.rx-word { font-size: 19px; font-weight: 800; letter-spacing: -.03em; color: var(--ink); }
.rx-hpill {
  display: inline-flex; align-items: center; gap: 7px; white-space: nowrap;
  font-size: 12.5px; font-weight: 600; color: var(--ink-2);
  background: #fff; border: 1px solid var(--line); border-radius: 100px; padding: 5px 12px;
}
.rx-dot { width: 6px; height: 6px; border-radius: 50%; background: #C3CCD8; flex: none; }
.rx-dot.on { background: var(--ok); }
.rx-langwrap { position: relative; margin-inline-start: auto; }
.rx-langbtn {
  font: inherit; font-size: 13.5px; font-weight: 600; color: var(--ink-2);
  background: none; border: 0; cursor: pointer; display: flex; align-items: center; gap: 6px;
}
.rx-caret { font-size: 9px; color: var(--ink-3); }
.rx-langmenu {
  position: absolute; top: calc(100% + 8px); inset-inline-end: 0; min-width: 168px;
  background: #fff; border: 1px solid var(--line); border-radius: 14px; overflow: hidden;
  box-shadow: 0 18px 50px rgba(10,37,64,.14); z-index: 40; animation: pop .16s ease both;
}
@keyframes pop { from { opacity: 0; transform: translateY(-5px) scale(.98); } }
.rx-langmenu button {
  display: block; width: 100%; text-align: start; background: none; border: 0;
  padding: 11px 16px; font: inherit; font-size: 13.5px; cursor: pointer; color: var(--ink);
}
.rx-langmenu button:hover { background: var(--line-2); }
.rx-langmenu button.sel { background: var(--line-2); font-weight: 700; }

/* hero */
.rx-hero {
  display: grid; grid-template-columns: 1.05fr .95fr; gap: clamp(28px, 4vw, 56px);
  align-items: center; padding: clamp(28px, 6vw, 68px) 0 clamp(30px, 5vw, 54px);
}
@media (max-width: 900px) { .rx-hero { grid-template-columns: 1fr; gap: 28px; padding-top: 26px; } }

.rx-eyebrow {
  font-size: 12.5px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase;
  color: var(--c); margin: 0 0 18px;
}
.rx-h1 {
  font-size: clamp(34px, 5.4vw, 58px); font-weight: 800; letter-spacing: -.035em;
  line-height: 1.03; margin: 0; max-width: 15ch; text-wrap: balance; color: var(--ink);
}
.rx-lede { font-size: clamp(16px, 2vw, 18px); color: var(--ink-2); margin: 20px 0 28px; max-width: 42ch; line-height: 1.55; }
.rx-cta { display: flex; flex-wrap: wrap; gap: 10px; }
.rx-btn {
  font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; border: 0; border-radius: 100px;
  padding: 13px 22px; display: inline-flex; align-items: center; gap: 8px;
  background: var(--c); color: #fff;
  box-shadow: 0 8px 22px color-mix(in oklab, var(--c) 32%, transparent);
  transition: transform .12s cubic-bezier(.2,.7,.2,1), filter .2s;
}
.rx-btn:hover { filter: brightness(1.06); }
.rx-btn:active { transform: scale(.97); }
.rx-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 22px; }
.rx-chip {
  font: inherit; font-size: 13.5px; font-weight: 500; color: var(--ink-2);
  background: #fff; border: 1px solid var(--line); border-radius: 100px; padding: 8px 15px;
  cursor: pointer; transition: transform .12s cubic-bezier(.2,.7,.2,1), border-color .2s, color .2s;
}
.rx-chip:hover { border-color: color-mix(in oklab, var(--c) 45%, var(--line)); color: var(--ink); }
.rx-chip:active { transform: scale(.96); }

/* the chat, as a product card */
.rx-chat {
  background: #fff; border: 1px solid var(--line); border-radius: 22px; overflow: hidden;
  display: flex; flex-direction: column; height: clamp(384px, 54vh, 468px);
  box-shadow: 0 2px 6px rgba(10,37,64,.04), 0 30px 60px -18px rgba(10,37,64,.22);
}
.rx-chat-top { display: flex; align-items: center; gap: 11px; padding: 15px 18px; border-bottom: 1px solid var(--line-2); }
.rx-ava {
  width: 38px; height: 38px; border-radius: 12px; flex: none; color: #fff; font-weight: 700; font-size: 15px;
  display: grid; place-items: center; background: linear-gradient(150deg, var(--c), var(--deep));
}
.rx-who { font-weight: 700; font-size: 15px; letter-spacing: -.01em; }
.rx-csub { font-size: 12.5px; color: var(--ink-3); display: flex; align-items: center; gap: 6px; margin-top: 1px; }
.rx-log { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 10px; background: #FCFDFE; }
.rx-row { display: flex; }
.rx-row.u { justify-content: flex-end; }
.rx-row.a { justify-content: flex-start; }
[dir="rtl"] .rx-row.u { justify-content: flex-start; }
[dir="rtl"] .rx-row.a { justify-content: flex-end; }
.rx-b { max-width: 84%; font-size: 14.5px; line-height: 1.48; padding: 11px 14px; border-radius: 16px; white-space: pre-wrap; animation: bubin .2s ease both; }
@keyframes bubin { from { opacity: 0; transform: translateY(5px); } }
.rx-b.a { background: #fff; border: 1px solid var(--line); color: var(--ink); border-bottom-left-radius: 6px; }
[dir="rtl"] .rx-b.a { border-bottom-left-radius: 16px; border-bottom-right-radius: 6px; }
.rx-b.u { color: #fff; border-bottom-right-radius: 6px; background: linear-gradient(160deg, var(--c), var(--deep)); }
[dir="rtl"] .rx-b.u { border-bottom-right-radius: 16px; border-bottom-left-radius: 6px; }
.rx-typing { display: flex; gap: 4px; align-items: center; }
.rx-typing i { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-3); animation: blink 1.2s infinite; }
.rx-typing i:nth-child(2) { animation-delay: .15s; }
.rx-typing i:nth-child(3) { animation-delay: .3s; }
@keyframes blink { 0%,80%,100% { opacity: .25; } 40% { opacity: 1; } }
.rx-foot { display: flex; align-items: center; gap: 8px; padding: 12px 12px 12px 16px; border-top: 1px solid var(--line-2); background: #fff; }
[dir="rtl"] .rx-foot { padding: 12px 16px 12px 12px; }
.rx-foot input { flex: 1; border: 0; outline: 0; font: inherit; font-size: 15px; background: transparent; color: var(--ink); min-width: 0; }
.rx-foot input::placeholder { color: var(--ink-3); }
.rx-go {
  width: 38px; height: 38px; flex: none; border: 0; border-radius: 12px; cursor: pointer; color: #fff;
  background: var(--c); display: grid; place-items: center;
  transition: transform .12s cubic-bezier(.2,.7,.2,1), filter .2s;
}
.rx-go:hover:not(:disabled) { filter: brightness(1.06); }
.rx-go:active:not(:disabled) { transform: scale(.9); }
.rx-go:disabled { opacity: .4; cursor: default; }
[dir="rtl"] .rx-go svg, [dir="rtl"] .rx-btn svg { transform: scaleX(-1); }

/* info band */
.rx-band {
  border-top: 1px solid var(--line); margin-top: clamp(20px, 3vw, 36px);
  padding: clamp(30px, 5vw, 50px) 0 60px;
  display: grid; grid-template-columns: 1.4fr .8fr .8fr; gap: clamp(24px, 4vw, 48px); align-items: start;
}
@media (max-width: 760px) { .rx-band { grid-template-columns: 1fr; gap: 28px; } }
.rx-lbl { font-size: 12px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; color: var(--ink-3); margin: 0 0 14px; }
.rx-item {
  width: 100%; text-align: start; background: none; border: 0; cursor: pointer; font: inherit;
  display: flex; gap: 14px; align-items: baseline; padding: 13px 0; border-bottom: 1px solid var(--line-2);
}
.rx-item:last-child { border-bottom: 0; }
.rx-item-l { min-width: 0; }
.rx-item-n { display: block; font-weight: 600; font-size: 15px; color: var(--ink); }
.rx-item:hover .rx-item-n { color: var(--c); }
.rx-item-d { display: block; font-size: 13px; color: var(--ink-3); margin-top: 2px; }
.rx-item-r { margin-inline-start: auto; text-align: end; white-space: nowrap; }
.rx-item-p { display: block; font-weight: 700; font-size: 15px; font-variant-numeric: tabular-nums; }
.rx-item-m { display: block; font-size: 12px; color: var(--ink-3); margin-top: 2px; }
.rx-sched { display: flex; flex-direction: column; gap: 2px; }
.rx-srow { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; padding: 4px 0; }
.rx-k { color: var(--ink-2); }
.rx-v { font-variant-numeric: tabular-nums; color: var(--ink); text-align: end; }
.rx-v.off { color: var(--ink-3); }
.rx-addr { font-size: 14px; color: var(--ink-2); line-height: 1.7; margin: 0; }
.rx-addr a { color: var(--c); font-weight: 600; text-decoration: none; }
.rx-addr a:hover { text-decoration: underline; text-underline-offset: 3px; }

.rx :focus-visible { outline: 2px solid var(--c); outline-offset: 3px; border-radius: 6px; }

@media (prefers-reduced-motion: reduce) {
  .rx-btn, .rx-chip, .rx-go, .rx-b, .rx-langmenu { animation: none !important; transition: none !important; }
  .rx-btn:active, .rx-chip:active, .rx-go:active { transform: none; }
}
`;
