"use client";

/**
 * The page a patient lands on.
 *
 * Design brief: someone opens this on their phone at 9pm wanting to know one
 * thing — can I be seen, and what will it cost. So the page answers that
 * before anything else: a live "open now, closes at 6" line computed from the
 * clinic's own hours, then prices, then a way to ask.
 *
 * White-labelled end to end. Name, colour, services, hours, address all come
 * from the database. Nothing here says Automology.
 *
 * Four languages including Arabic. Choosing Arabic mirrors the entire layout.
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

export default function ClinicPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;

  const [cfg, setCfg] = useState<Config | null>(null);
  const [lang, setLang] = useState<LangCode>("en");
  const [langOpen, setLangOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const t = COPY[lang];
  const rtl = isRtl(lang);

  // ── setup ─────────────────────────────────────────────────────────────────
  useEffect(() => { setLang(detectLang()); }, []);

  useEffect(() => {
    let live = true;
    fetch(`/api/widget-config?slug=${encodeURIComponent(slug)}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((c: Config) => { if (live) { setCfg(c); setMessages([{ role: "agent", text: c.greeting }]); } })
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

  // ── open / closed, in the business's own timezone ─────────────────────────
  const status = useMemo(() => {
    if (!cfg?.hours) return null;
    const tz = cfg.timezone || "Asia/Kuala_Lumpur";
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(now);
    const wd = parts.find(p => p.type === "weekday")?.value ?? "Mon";
    const hh = Number(parts.find(p => p.type === "hour")?.value ?? 0);
    const mm = Number(parts.find(p => p.type === "minute")?.value ?? 0);
    const nowMin = hh * 60 + mm;

    const idx = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].indexOf(wd);
    const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

    const todayKey = DAY_KEYS[idx < 0 ? 0 : idx];
    const today = cfg.hours[todayKey];

    if (today) {
      const [open, close] = today;
      if (nowMin >= toMin(open) && nowMin < toMin(close)) {
        return { open: true, text: fill(t.closesAt, { time: close }) };
      }
      if (nowMin < toMin(open)) {
        return { open: false, text: fill(t.opensAt, { day: t.today.toLowerCase(), time: open }) };
      }
    }
    // find the next open day
    for (let i = 1; i <= 7; i++) {
      const k = DAY_KEYS[((idx < 0 ? 0 : idx) + i) % 7];
      const h = cfg.hours[k];
      if (h) {
        const dayName = t.days[DAY_KEYS.indexOf(k)];
        return { open: false, text: fill(t.opensAt, { day: dayName, time: h[0] }) };
      }
    }
    return { open: false, text: t.closedNow };
  }, [cfg, t]);

  // ── chat ──────────────────────────────────────────────────────────────────
  const send = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean || busy || !session) return;
    setChatOpen(true);
    setMessages(m => [...m, { role: "user", text: clean }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, session, message: clean }),
      });
      const d = await res.json();
      setMessages(m => [...m, { role: "agent", text: d.reply ?? fallback(d.error) }]);
    } catch {
      setMessages(m => [...m, { role: "agent", text: fallback() }]);
    } finally { setBusy(false); }
  }, [busy, session, slug]);

  if (!cfg) {
    return <div style={{ ...S.loading, direction: rtl ? "rtl" : "ltr" }}>…</div>;
  }

  const C = cfg.color || "#1D6A8C";
  const showSuggestions = messages.length === 1;

  return (
    <div dir={rtl ? "rtl" : "ltr"} style={{ ...S.page, direction: rtl ? "rtl" : "ltr" }}>

      {/* ── top bar ─────────────────────────────────────────────────── */}
      <div style={{ ...S.topline, background: C }} />
      <header style={S.header}>
        <div style={S.brand}>
          {cfg.logo_url
            ? <img src={cfg.logo_url} alt="" style={S.logo} />
            : <div style={{ ...S.mark, background: C }}>{cfg.business_name.charAt(0)}</div>}
          <div>
            <div style={S.bizName}>{cfg.business_name}</div>
            {status && (
              <div style={S.status}>
                <span style={{ ...S.dot, background: status.open ? "#2C6B5E" : "#B4B3AC" }} />
                <span style={{ color: status.open ? "#2C6B5E" : "#8B8F8C" }}>
                  {status.open ? t.openNow : t.closedNow}
                </span>
                <span style={S.statusSub}>· {status.text}</span>
              </div>
            )}
          </div>
        </div>

        <div style={S.langWrap}>
          <button onClick={() => setLangOpen(o => !o)} style={S.langBtn}
                  aria-expanded={langOpen} aria-label="Language">
            {LANGUAGES.find(l => l.code === lang)?.label}
            <span style={S.caret}>▾</span>
          </button>
          {langOpen && (
            <div style={{ ...S.langMenu, [rtl ? "left" : "right"]: 0 }}>
              {LANGUAGES.map(l => (
                <button key={l.code}
                  onClick={() => { setLang(l.code); setLangOpen(false); }}
                  style={{ ...S.langItem, background: l.code === lang ? "#F1F1EE" : "transparent" }}>
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main style={S.main}>
        {/* ── hero ──────────────────────────────────────────────────── */}
        <section style={S.hero}>
          {cfg.tagline && <p style={S.tagline}>{cfg.tagline}</p>}
          <h1 style={S.h1}>{t.askUs}</h1>
          <p style={S.heroSub}>
            {fill(t.chatWith, { name: cfg.agent_name })} · {t.poweredNote}
          </p>

          <div style={S.chips}>
            {cfg.suggestions.slice(0, 3).map(q => (
              <button key={q} onClick={() => send(q)}
                      style={{ ...S.chip, borderColor: C, color: C }}>
                {q}
              </button>
            ))}
          </div>
        </section>

        {/* ── services ──────────────────────────────────────────────── */}
        {cfg.services.length > 0 && (
          <section style={S.section}>
            <h2 style={S.h2}>{t.services}</h2>
            <div>
              {cfg.services.map(s => (
                <div key={s.name} style={S.svc}>
                  <div style={S.svcMain}>
                    <div style={S.svcName}>{s.name}</div>
                    {s.description && <div style={S.svcDesc}>{s.description}</div>}
                    {s.minutes && (
                      <div style={S.svcMeta}>{fill(t.minutes, { n: s.minutes })}</div>
                    )}
                  </div>
                  <div style={S.svcRight}>
                    {s.price != null && (
                      <div style={S.price}>
                        <span style={S.cur}>{s.currency}</span> {Number(s.price).toFixed(2)}
                      </div>
                    )}
                    <button onClick={() => send(s.name)}
                            style={{ ...S.svcAsk, color: C }}>
                      {t.askAboutIt}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── hours + contact ───────────────────────────────────────── */}
        <section style={S.cols}>
          {cfg.hours && (
            <div style={S.col}>
              <h2 style={S.h2}>{t.hours}</h2>
              {DAY_KEYS.map((k, i) => {
                const h = cfg.hours![k];
                return (
                  <div key={k} style={S.hourRow}>
                    <span style={S.day}>{t.days[i]}</span>
                    <span style={{ ...S.time, color: h ? "#14171A" : "#B4B3AC" }}>
                      {h ? `${h[0]} – ${h[1]}` : t.closedNow}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={S.col}>
            {cfg.address && (
              <>
                <h2 style={S.h2}>{t.findUs}</h2>
                <p style={S.addr}>{cfg.address}</p>
                {cfg.map_url && (
                  <a href={cfg.map_url} target="_blank" rel="noreferrer"
                     style={{ ...S.textLink, color: C }}>
                    {t.findUs} →
                  </a>
                )}
              </>
            )}
            {cfg.phone && (
              <p style={{ marginTop: 18 }}>
                <a href={`tel:${cfg.phone.replace(/\s/g, "")}`}
                   style={{ ...S.phone, color: C, borderColor: C }}>
                  {t.callUs} {cfg.phone}
                </a>
              </p>
            )}
          </div>
        </section>

        <footer style={S.footer}>{cfg.business_name}</footer>
      </main>

      {/* ── chat launcher ─────────────────────────────────────────────── */}
      {!chatOpen && (
        <button onClick={() => { setChatOpen(true); setTimeout(() => inputRef.current?.focus(), 80); }}
          style={{ ...S.launcher, background: C, [rtl ? "left" : "right"]: 20 }}>
          {fill(t.chatWith, { name: cfg.agent_name })}
        </button>
      )}

      {/* ── chat panel ────────────────────────────────────────────────── */}
      {chatOpen && (
        <div data-panel style={{ ...S.panel, [rtl ? "left" : "right"]: 20 }}>
          <div style={{ ...S.panelHead, background: C }}>
            <div style={S.panelBrand}>
              <div style={S.panelMark}>{cfg.agent_name.charAt(0)}</div>
              <div>
                <div style={S.panelName}>{cfg.agent_name}</div>
                <div style={S.panelSub}>{cfg.subtitle}</div>
              </div>
            </div>
            <button onClick={() => setChatOpen(false)} style={S.panelClose} aria-label={t.close}>×</button>
          </div>

          <div style={S.log}>
            {messages.map((m, i) => (
              <div key={i} style={m.role === "user"
                ? { ...S.rowU, justifyContent: rtl ? "flex-start" : "flex-end" }
                : { ...S.rowA, justifyContent: rtl ? "flex-end" : "flex-start" }}>
                <div style={m.role === "user" ? { ...S.bubbleU, background: C } : S.bubbleA}>
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div style={{ ...S.rowA, justifyContent: rtl ? "flex-end" : "flex-start" }}>
                <div style={{ ...S.bubbleA, ...S.dots }}>
                  <i style={S.d} /><i style={{ ...S.d, animationDelay: ".15s" }} />
                  <i style={{ ...S.d, animationDelay: ".3s" }} />
                </div>
              </div>
            )}
            {showSuggestions && (
              <div style={S.panelChips}>
                {cfg.suggestions.slice(0, 3).map(q => (
                  <button key={q} onClick={() => send(q)}
                          style={{ ...S.chip, borderColor: C, color: C, fontSize: 12 }}>
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div style={S.inputRow}>
            <input ref={inputRef} value={input} disabled={busy}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder={t.typeMessage} aria-label={t.typeMessage}
              style={{ ...S.input, textAlign: rtl ? "right" : "left" }} />
            <button onClick={() => send(input)} disabled={busy || !input.trim()}
              style={{ ...S.sendBtn, background: C, opacity: busy || !input.trim() ? 0.4 : 1 }}>
              {t.send}
            </button>
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes blink { 0%,80%,100% { opacity:.25 } 40% { opacity:1 } }
        button:focus-visible, a:focus-visible, input:focus-visible {
          outline: 2px solid currentColor; outline-offset: 3px;
        }
        @media (max-width: 620px) {
          [data-panel] { inset: 0 !important; width: 100% !important; height: 100% !important;
                         border-radius: 0 !important; }
        }
      `}</style>
    </div>
  );
}

function fallback(error?: string) {
  if (error === "origin_not_allowed") return "This chat isn't enabled for this site yet.";
  return "Give me a moment — I'll have someone get back to you.";
}

const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#FCFCFA", fontFamily: SANS, color: "#14171A" },
  loading: { minHeight: "100vh", display: "grid", placeItems: "center", color: "#B4B3AC", fontFamily: SANS },
  topline: { height: 3 },

  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "16px 22px", borderBottom: "1px solid #EDEDE8", position: "sticky", top: 0, background: "rgba(252,252,250,.94)", backdropFilter: "blur(8px)", zIndex: 20 },
  brand: { display: "flex", alignItems: "center", gap: 11 },
  logo: { width: 38, height: 38, borderRadius: 4, objectFit: "cover" },
  mark: { width: 38, height: 38, borderRadius: 4, color: "#fff", display: "grid", placeItems: "center", fontSize: 17, fontWeight: 600 },
  bizName: { fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.01em" },
  status: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 3, flexWrap: "wrap" },
  dot: { width: 6, height: 6, borderRadius: "50%" },
  statusSub: { color: "#8B8F8C" },

  langWrap: { position: "relative" },
  langBtn: { background: "none", border: "1px solid #E4E4DF", borderRadius: 3, padding: "7px 11px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", color: "#14171A", display: "flex", alignItems: "center", gap: 6 },
  caret: { fontSize: 9, color: "#A3A6A2" },
  langMenu: { position: "absolute", top: "calc(100% + 6px)", background: "#FCFCFA", border: "1px solid #E4E4DF", borderRadius: 4, boxShadow: "0 8px 28px rgba(20,23,26,.12)", overflow: "hidden", zIndex: 30, minWidth: 160 },
  langItem: { display: "block", width: "100%", textAlign: "start", background: "none", border: 0, padding: "10px 14px", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", color: "#14171A" },

  main: { maxWidth: 720, margin: "0 auto", padding: "0 22px 120px" },

  hero: { padding: "52px 0 40px", borderBottom: "1px solid #EDEDE8" },
  tagline: { fontSize: 13, color: "#8B8F8C", marginBottom: 14, letterSpacing: ".01em" },
  h1: { fontSize: "clamp(28px, 6vw, 40px)", fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 },
  heroSub: { fontSize: 14.5, color: "#6E7573", marginTop: 12, lineHeight: 1.6 },
  chips: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 26 },
  chip: { background: "none", border: "1px solid", borderRadius: 3, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" },

  section: { padding: "36px 0", borderBottom: "1px solid #EDEDE8" },
  h2: { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".12em", color: "#8B8F8C", margin: "0 0 16px" },

  svc: { display: "flex", gap: 18, padding: "15px 0", borderBottom: "1px solid #F2F2EF", alignItems: "flex-start", flexWrap: "wrap" },
  svcMain: { flex: 1, minWidth: 180 },
  svcName: { fontSize: 15, fontWeight: 500 },
  svcDesc: { fontSize: 12.5, color: "#8B8F8C", marginTop: 4, lineHeight: 1.5 },
  svcMeta: { fontSize: 11.5, color: "#B4B3AC", marginTop: 4, fontFamily: MONO },
  svcRight: { textAlign: "end" },
  price: { fontSize: 17, fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontWeight: 500 },
  cur: { fontSize: 11, color: "#A3A6A2" },
  svcAsk: { background: "none", border: 0, padding: "5px 0 0", fontSize: 12, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3 },

  cols: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 40, padding: "36px 0" },
  col: {},
  hourRow: { display: "flex", justifyContent: "space-between", gap: 16, padding: "7px 0", borderBottom: "1px solid #F2F2EF", fontSize: 13.5 },
  day: { color: "#6E7573" },
  time: { fontFamily: MONO, fontSize: 12.5, fontVariantNumeric: "tabular-nums" },
  addr: { fontSize: 14, lineHeight: 1.6, color: "#14171A" },
  textLink: { fontSize: 13, textDecoration: "none", display: "inline-block", marginTop: 8 },
  phone: { display: "inline-block", border: "1px solid", borderRadius: 3, padding: "9px 15px", fontSize: 13.5, textDecoration: "none", fontWeight: 500 },

  footer: { padding: "30px 0 0", fontSize: 11.5, color: "#B4B3AC", borderTop: "1px solid #EDEDE8" },

  launcher: { position: "fixed", bottom: 20, color: "#fff", border: 0, borderRadius: 4, padding: "14px 22px", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: SANS, boxShadow: "0 6px 24px rgba(20,23,26,.20)", zIndex: 40 },

  panel: { position: "fixed", bottom: 20, width: "min(390px, calc(100vw - 40px))", height: "min(600px, calc(100vh - 40px))", background: "#FCFCFA", borderRadius: 6, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 0 0 1px #E4E4DF, 0 14px 50px rgba(20,23,26,.20)", zIndex: 45 },
  panelHead: { color: "#fff", padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  panelBrand: { display: "flex", alignItems: "center", gap: 10 },
  panelMark: { width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,.22)", display: "grid", placeItems: "center", fontWeight: 600, fontSize: 15 },
  panelName: { fontSize: 14.5, fontWeight: 600 },
  panelSub: { fontSize: 11, opacity: .85 },
  panelClose: { background: "none", border: 0, color: "#fff", fontSize: 22, lineHeight: 1, cursor: "pointer", padding: 0, opacity: .85 },

  log: { flex: 1, overflowY: "auto", padding: 16, background: "#FCFCFA" },
  rowU: { display: "flex", marginBottom: 10 },
  rowA: { display: "flex", marginBottom: 10 },
  bubbleU: { color: "#fff", padding: "9px 13px", borderRadius: 10, maxWidth: "80%", fontSize: 14, lineHeight: 1.5 },
  bubbleA: { background: "#fff", border: "1px solid #E4E4DF", padding: "9px 13px", borderRadius: 10, maxWidth: "80%", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" },
  dots: { display: "flex", gap: 4, alignItems: "center", padding: "13px 14px" },
  d: { width: 6, height: 6, borderRadius: "50%", background: "#B4B3AC", display: "inline-block", animation: "blink 1.2s infinite" },
  panelChips: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 },

  inputRow: { display: "flex", gap: 8, padding: 12, borderTop: "1px solid #EDEDE8", background: "#fff" },
  input: { flex: 1, border: "1px solid #DAD9D3", borderRadius: 3, padding: "10px 13px", fontSize: 14.5, fontFamily: "inherit" },
  sendBtn: { color: "#fff", border: 0, borderRadius: 3, padding: "10px 16px", fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" },
};
