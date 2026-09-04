"use client";

/**
 * What the embedded iframe shows. Just the conversation — no page furniture,
 * no services list, no hours table. Those belong on the hosted page; here the
 * business's own site is already providing the context.
 *
 * Kept deliberately light: this loads inside someone else's website, and a
 * heavy widget makes their site feel slow even though it isn't.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { COPY, isRtl, detectLang, type LangCode } from "@/lib/i18n";

type Config = {
  business_name: string; agent_name: string; color: string;
  subtitle: string; greeting: string; suggestions: string[];
};
type Msg = { role: "user" | "agent"; text: string };

export default function Embed({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const [cfg, setCfg] = useState<Config | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState("");
  const [lang, setLang] = useState<LangCode>("en");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const t = COPY[lang];
  const rtl = isRtl(lang);

  useEffect(() => { setLang(detectLang()); }, []);

  useEffect(() => {
    fetch(`/api/widget-config?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then((c: Config) => { setCfg(c); setMessages([{ role: "agent", text: c.greeting }]); })
      .catch(() => setCfg(null));
  }, [slug]);

  useEffect(() => {
    const key = `automology-session-${slug}`;
    let s = "";
    try {
      s = localStorage.getItem(key) ?? "";
      if (!s) { s = `web-${Math.random().toString(36).slice(2)}-${Date.now()}`; localStorage.setItem(key, s); }
    } catch { s = `web-${Math.random().toString(36).slice(2)}`; }
    setSession(s);
    setTimeout(() => inputRef.current?.focus(), 200);
  }, [slug]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); },
            [messages, busy]);

  const send = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean || busy || !session) return;
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

  if (!cfg) return <div className="em-load">…</div>;

  const C = cfg.color || "#1D6A8C";
  const first = messages.length === 1;

  return (
    <div className="em" dir={rtl ? "rtl" : "ltr"} style={{ "--c": C } as React.CSSProperties}>
      <header className="em-head">
        <span className="em-mark">{cfg.agent_name.charAt(0)}</span>
        <div>
          <div className="em-name">{cfg.agent_name}</div>
          <div className="em-sub"><i />{cfg.business_name}</div>
        </div>
      </header>

      <div className="em-log">
        {messages.map((m, i) => (
          <div key={i} className={`em-row ${m.role}`}>
            <div className={`em-bub ${m.role}`}>{m.text}</div>
          </div>
        ))}
        {busy && (
          <div className="em-row agent">
            <div className="em-bub agent em-dots"><i /><i /><i /></div>
          </div>
        )}
        {first && !busy && (
          <div className="em-chips">
            {(cfg.suggestions ?? []).slice(0, 3).map(q => (
              <button key={q} onClick={() => send(q)}>{q}</button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="em-in">
        <input ref={inputRef} value={input} disabled={busy}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") send(input); }}
          placeholder={t.typeMessage} aria-label={t.typeMessage} />
        <button onClick={() => send(input)} disabled={busy || !input.trim()}
          aria-label={t.send}>{t.send}</button>
      </div>

      <style>{CSS}</style>
    </div>
  );
}

function fallback(error?: string) {
  if (error === "origin_not_allowed")
    return "This chat isn't enabled for this website yet.";
  return "Give me a moment — I'll have someone get back to you.";
}

const CSS = `
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:#FCFCFA}
.em-load{height:100vh;display:grid;place-items:center;color:#B7B3AC;
  font-family:system-ui,sans-serif}
.em{--line:#E7E3DC;--ink:#12100E;--fade:#A5A099;
  height:100vh;display:flex;flex-direction:column;background:#FCFCFA;color:var(--ink);
  font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
.em-head{display:flex;align-items:center;gap:11px;padding:14px 16px;
  background:linear-gradient(135deg,var(--c),color-mix(in oklab,var(--c) 68%,#14130f));
  color:#fff;flex:none}
.em-mark{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.22);
  display:grid;place-items:center;font-weight:600;font-size:15px}
.em-name{font-weight:600;font-size:14.5px}
.em-sub{font-size:11px;opacity:.85;display:flex;align-items:center;gap:5px;margin-top:1px}
.em-sub i{width:6px;height:6px;border-radius:50%;background:#6FE3B4}
.em-log{flex:1;overflow-y:auto;padding:16px;-webkit-overflow-scrolling:touch}
.em-row{display:flex;margin-bottom:10px}
.em-row.user{justify-content:flex-end}
.em-row.agent{justify-content:flex-start}
[dir=rtl] .em-row.user{justify-content:flex-start}
[dir=rtl] .em-row.agent{justify-content:flex-end}
.em-bub{max-width:82%;padding:10px 14px;font-size:14px;line-height:1.55;
  white-space:pre-wrap;animation:in .22s ease both}
@keyframes in{from{opacity:0;transform:translateY(5px)}}
.em-bub.user{background:var(--c);color:#fff;border-radius:15px 15px 4px 15px}
[dir=rtl] .em-bub.user{border-radius:15px 15px 15px 4px}
.em-bub.agent{background:#fff;border:1px solid var(--line);border-radius:15px 15px 15px 4px}
[dir=rtl] .em-bub.agent{border-radius:15px 15px 4px 15px}
.em-dots{display:flex;gap:4px;align-items:center;padding:13px 15px}
.em-dots i{width:6px;height:6px;border-radius:50%;background:var(--fade);
  animation:blink 1.2s infinite}
.em-dots i:nth-child(2){animation-delay:.15s}
.em-dots i:nth-child(3){animation-delay:.3s}
@keyframes blink{0%,80%,100%{opacity:.25}40%{opacity:1}}
.em-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.em-chips button{background:color-mix(in oklab,var(--c) 7%,#fff);
  border:1px solid color-mix(in oklab,var(--c) 22%,#E9E6E0);
  color:color-mix(in oklab,var(--c) 85%,var(--ink));
  border-radius:999px;padding:8px 14px;font-size:12.5px;cursor:pointer;font-family:inherit}
.em-in{display:flex;gap:8px;padding:12px;border-top:1px solid var(--line);
  background:#fff;flex:none}
.em-in input{flex:1;min-width:0;border:1px solid var(--line);border-radius:11px;
  padding:11px 13px;font-size:15px;font-family:inherit;background:#FDFCFA;color:var(--ink)}
.em-in input:focus{outline:2px solid color-mix(in oklab,var(--c) 55%,transparent);
  outline-offset:1px}
.em-in button{background:var(--c);color:#fff;border:0;border-radius:11px;
  padding:11px 18px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit}
.em-in button:disabled{opacity:.4;cursor:default}
@media(prefers-reduced-motion:reduce){.em-bub,.em-dots i{animation:none}}
`;
