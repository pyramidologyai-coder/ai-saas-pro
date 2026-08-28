"use client";

/**
 * The demo page. A prospect opens /demo/<their-slug> and chats.
 *
 * White-labelled: colour, logo, agent name, greeting and suggested questions
 * all come from the database (tenants.brand_*). Adding a customer with their
 * own look is one UPDATE — no code change, no deploy.
 *
 * Built to docs/UI_UX.md.
 */

import { useState, useRef, useEffect } from "react";

type Msg = { role: "user" | "agent"; text: string };

type Brand = {
  business_name: string;
  agent_name: string;
  color: string;
  logo_url: string | null;
  subtitle: string;
  greeting: string;
  suggestions: string[];
};

const FALLBACK: Brand = {
  business_name: "",
  agent_name: "Assistant",
  color: "#1F4E46",
  logo_url: null,
  subtitle: "",
  greeting: "Hi! How can I help you today?",
  suggestions: [],
};

export default function DemoPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const [brand, setBrand] = useState<Brand | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // branding, from the database
  useEffect(() => {
    let live = true;
    fetch(`/api/widget-config?slug=${encodeURIComponent(slug)}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((b: Brand) => {
        if (!live) return;
        setBrand(b);
        setMessages([{ role: "agent", text: b.greeting }]);
      })
      .catch(() => {
        if (!live) return;
        setBrand(FALLBACK);
        setMessages([{ role: "agent", text: FALLBACK.greeting }]);
      });
    return () => { live = false; };
  }, [slug]);

  // one session id per browser, survives refresh
  useEffect(() => {
    const key = `automology-session-${slug}`;
    let s = "";
    try {
      s = window.localStorage.getItem(key) ?? "";
      if (!s) {
        s = `web-${Math.random().toString(36).slice(2)}-${Date.now()}`;
        window.localStorage.setItem(key, s);
      }
    } catch {
      s = `web-${Math.random().toString(36).slice(2)}`;
    }
    setSession(s);
  }, [slug]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
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
      const data = await res.json();
      setMessages(m => [
        ...m,
        {
          role: "agent",
          text:
            data.reply ??
            (data.error === "origin_not_allowed"
              ? "This chat isn't enabled for this site yet."
              : "Give me a moment — I'll have someone get back to you."),
        },
      ]);
    } catch {
      setMessages(m => [
        ...m,
        { role: "agent", text: "Give me a moment — I'll have someone get back to you." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  if (!brand) {
    return <div style={{ ...S.page, color: "#999", fontSize: 14 }}>Loading…</div>;
  }

  const C = brand.color;
  const showChips = messages.length === 1 && brand.suggestions.length > 0;
  const initial = (brand.agent_name || "A").charAt(0).toUpperCase();

  return (
    <div style={S.page}>
      <div style={S.card}>
        <header style={{ ...S.head, background: C }}>
          {brand.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logo_url} alt="" style={S.logo} />
          ) : (
            <div style={S.avatar}>{initial}</div>
          )}
          <div>
            <div style={S.name}>{brand.agent_name}</div>
            <div style={S.sub}>{brand.subtitle}</div>
          </div>
        </header>

        <div style={S.log}>
          {messages.map((m, i) => (
            <div key={i} style={m.role === "user" ? S.rowUser : S.rowAgent}>
              <div
                style={
                  m.role === "user" ? { ...S.bubbleUser, background: C } : S.bubbleAgent
                }
              >
                {m.text}
              </div>
            </div>
          ))}

          {busy && (
            <div style={S.rowAgent}>
              <div style={{ ...S.bubbleAgent, ...S.dots }}>
                <span style={S.dot} />
                <span style={{ ...S.dot, animationDelay: ".15s" }} />
                <span style={{ ...S.dot, animationDelay: ".3s" }} />
              </div>
            </div>
          )}

          {showChips && (
            <div style={S.chips}>
              {brand.suggestions.slice(0, 3).map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  style={{ ...S.chip, borderColor: C, color: C }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div ref={endRef} />
        </div>

        <div style={S.inputRow}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Type a message..."
            style={S.input}
            disabled={busy}
          />
          <button
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
            style={{ ...S.send, background: C, opacity: busy || !input.trim() ? 0.4 : 1 }}
          >
            Send
          </button>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,80%,100% { opacity:.25 } 40% { opacity:1 } }
        input:focus { outline: 2px solid ${C}; outline-offset: -2px; }
      `}</style>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F5F3EE",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    height: "min(640px, 92vh)",
    background: "#fff",
    borderRadius: 14,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 8px 40px rgba(0,0,0,.12)",
  },
  head: {
    color: "#fff",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 38, height: 38, borderRadius: "50%",
    background: "rgba(255,255,255,.2)",
    display: "grid", placeItems: "center",
    fontWeight: 600, fontSize: 16,
  },
  logo: { width: 38, height: 38, borderRadius: "50%", objectFit: "cover", background: "#fff" },
  name: { fontWeight: 600, fontSize: 15 },
  sub: { fontSize: 11.5, opacity: 0.8 },
  log: { flex: 1, overflowY: "auto", padding: 16, background: "#FAFAF8" },
  rowUser: { display: "flex", justifyContent: "flex-end", marginBottom: 10 },
  rowAgent: { display: "flex", justifyContent: "flex-start", marginBottom: 10 },
  bubbleUser: {
    color: "#fff",
    padding: "9px 13px", borderRadius: "14px 14px 3px 14px",
    maxWidth: "78%", fontSize: 14.5, lineHeight: 1.45,
  },
  bubbleAgent: {
    background: "#fff", color: "#1a1a1a", border: "1px solid #E6E4DE",
    padding: "9px 13px", borderRadius: "14px 14px 14px 3px",
    maxWidth: "78%", fontSize: 14.5, lineHeight: 1.45,
  },
  dots: { display: "flex", gap: 4, alignItems: "center", padding: "12px 14px" },
  dot: {
    width: 6, height: 6, borderRadius: "50%", background: "#999",
    display: "inline-block", animation: "blink 1.2s infinite",
  },
  chips: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 },
  chip: {
    background: "#fff", border: "1px solid",
    padding: "7px 12px", borderRadius: 16, fontSize: 13,
    cursor: "pointer", fontFamily: "inherit",
  },
  inputRow: {
    display: "flex", gap: 8, padding: 12,
    borderTop: "1px solid #EEEBE4", background: "#fff",
  },
  input: {
    flex: 1, border: "1px solid #DDD9D0", borderRadius: 20,
    padding: "10px 15px", fontSize: 14.5, fontFamily: "inherit",
  },
  send: {
    color: "#fff", border: 0, borderRadius: 20,
    padding: "10px 18px", fontSize: 14, fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit",
  },
};
