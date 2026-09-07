"use client";

/**
 * The assistant, docked in the dashboard.
 *
 * It lives here rather than behind a URL because the whole point is that it's
 * within reach while you're already looking at the day. A separate link is a
 * thing you have to remember, and nobody remembers a second link.
 *
 * It opens with today already loaded, so the first useful sentence arrives
 * before anyone types anything.
 */

import { useState, useRef, useEffect, useCallback } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const OPENERS = [
  "What's left today?",
  "Anything unconfirmed?",
  "How was this week?",
];

export function Assistant({ slug, color, agent }:
  { slug: string; color: string; agent?: string | null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const name = agent || "your assistant";

  const send = useCallback(async (text: string, history?: Msg[]) => {
    const clean = text.trim();
    if (!clean || busy) return;

    const next: Msg[] = [...(history ?? messages), { role: "user", content: clean }];
    setMessages(next);
    setInput("");
    setBusy(true);

    try {
      // The slug goes in the URL, not just the body — the dashboard guard reads
      // it from there, and a request without it is rejected before it arrives.
      const res = await fetch(`/api/assistant?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, messages: next }),
      });
      const j = await res.json();
      setMessages(m => [...m, {
        role: "assistant",
        content: j.reply ?? "I couldn't reach the numbers just then.",
      }]);
    } catch {
      setMessages(m => [...m, {
        role: "assistant",
        content: "Something went wrong. Try again in a moment.",
      }]);
    } finally { setBusy(false); }
  }, [busy, messages, slug]);

  // Open with the day already answered, rather than an empty box.
  useEffect(() => {
    if (open && !greeted) {
      setGreeted(true);
      send("What's happening today?", []);
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open, greeted, send]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
      // A dashboard shortcut people actually use.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {!open && (
        <button className="as-open" style={{ background: color }}
                onClick={() => setOpen(true)}>
          <span className="as-pulse" />
          Ask {name}
          <kbd>⌘K</kbd>
        </button>
      )}

      {open && (
        <div className="as-panel" role="dialog" aria-label={`Ask ${name}`}>
          <header className="as-head" style={{ background: color }}>
            <div className="as-who">
              <span className="as-mark">{name.charAt(0).toUpperCase()}</span>
              <div>
                <div className="as-name">{name}</div>
                <div className="as-sub">Knows today&apos;s diary</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close">×</button>
          </header>

          <div className="as-log">
            {messages.map((m, i) => (
              <div key={i} className={`as-row ${m.role}`}>
                <div className={`as-bub ${m.role}`}>{m.content}</div>
              </div>
            ))}
            {busy && (
              <div className="as-row assistant">
                <div className="as-bub assistant as-dots"><i /><i /><i /></div>
              </div>
            )}
            {messages.length <= 2 && !busy && (
              <div className="as-chips">
                {OPENERS.map(q => (
                  <button key={q} onClick={() => send(q)}
                          style={{ borderColor: color, color }}>{q}</button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="as-in">
            <input ref={inputRef} value={input} disabled={busy}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") send(input); }}
              placeholder="Confirm 2 · move 1 to 4pm · how was this week?" />
            <button onClick={() => send(input)} disabled={busy || !input.trim()}
                    style={{ background: color }} aria-label="Send">→</button>
          </div>
        </div>
      )}

      <style>{CSS}</style>
    </>
  );
}

const CSS = `
.as-open{position:fixed;bottom:22px;inset-inline-end:22px;z-index:70;
  display:flex;align-items:center;gap:9px;color:#fff;border:0;border-radius:999px;
  padding:13px 20px;font-size:14px;font-weight:600;cursor:pointer;
  font-family:"Instrument Sans",system-ui,sans-serif;
  box-shadow:0 10px 32px rgba(18,16,14,.24);
  transition:transform .16s ease,box-shadow .16s ease}
.as-open:hover{transform:translateY(-2px);box-shadow:0 14px 40px rgba(18,16,14,.3)}
.as-open kbd{background:rgba(255,255,255,.2);border-radius:5px;padding:2px 6px;
  font-size:10.5px;font-family:ui-monospace,Menlo,monospace}
.as-pulse{width:7px;height:7px;border-radius:50%;background:#fff;opacity:.9;
  animation:as-ping 2.4s ease-out infinite}
@keyframes as-ping{0%{transform:scale(.7);opacity:.9}70%{transform:scale(1.5);opacity:0}
  100%{opacity:0}}

.as-panel{position:fixed;bottom:22px;inset-inline-end:22px;z-index:75;
  width:min(400px,calc(100vw - 32px));height:min(560px,calc(100vh - 44px));
  background:#FDFCFA;border-radius:18px;overflow:hidden;display:flex;
  flex-direction:column;font-family:"Instrument Sans",system-ui,sans-serif;
  box-shadow:0 0 0 1px #E7E3DC,0 26px 70px rgba(18,16,14,.26);
  animation:as-in .26s cubic-bezier(.2,.9,.3,1.05) both}
@keyframes as-in{from{opacity:0;transform:translateY(14px) scale(.97)}}
@media(max-width:520px){.as-panel{inset:0;width:100%;height:100%;border-radius:0}}

.as-head{color:#fff;padding:14px 16px;display:flex;justify-content:space-between;
  align-items:center;gap:10px;flex:none}
.as-who{display:flex;align-items:center;gap:10px}
.as-mark{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.22);
  display:grid;place-items:center;font-weight:600;font-size:15px}
.as-name{font-weight:600;font-size:14.5px}
.as-sub{font-size:11px;opacity:.85;margin-top:1px}
.as-head button{background:none;border:0;color:#fff;font-size:23px;line-height:1;
  cursor:pointer;opacity:.85;padding:0 2px}

.as-log{flex:1;overflow-y:auto;padding:16px}
.as-row{display:flex;margin-bottom:10px}
.as-row.user{justify-content:flex-end}
.as-bub{max-width:85%;padding:10px 13px;font-size:13.5px;line-height:1.55;
  white-space:pre-wrap;animation:as-bub .2s ease both}
@keyframes as-bub{from{opacity:0;transform:translateY(4px)}}
.as-bub.user{background:#12100E;color:#fff;border-radius:14px 14px 3px 14px}
.as-bub.assistant{background:#fff;border:1px solid #E7E3DC;
  border-radius:14px 14px 14px 3px}
.as-dots{display:flex;gap:4px;align-items:center;padding:13px 15px}
.as-dots i{width:5px;height:5px;border-radius:50%;background:#A5A099;
  animation:as-blink 1.2s infinite}
.as-dots i:nth-child(2){animation-delay:.15s}
.as-dots i:nth-child(3){animation-delay:.3s}
@keyframes as-blink{0%,80%,100%{opacity:.25}40%{opacity:1}}
.as-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.as-chips button{background:#fff;border:1px solid;border-radius:999px;
  padding:7px 13px;font-size:12px;cursor:pointer;font-family:inherit}

.as-in{display:flex;gap:8px;padding:11px;border-top:1px solid #E7E3DC;
  background:#fff;flex:none}
.as-in input{flex:1;min-width:0;border:1px solid #E7E3DC;border-radius:10px;
  padding:10px 13px;font-size:14px;font-family:inherit;background:#FDFCFA;color:#12100E}
.as-in input:focus{outline:2px solid #12100E;outline-offset:-1px;border-color:transparent}
.as-in button{color:#fff;border:0;border-radius:10px;width:42px;flex:none;
  font-size:17px;cursor:pointer;font-family:inherit}
.as-in button:disabled{opacity:.35;cursor:default}

@media(prefers-reduced-motion:reduce){
  .as-panel,.as-bub,.as-dots i,.as-pulse{animation:none}
  .as-open:hover{transform:none}
}
`;
