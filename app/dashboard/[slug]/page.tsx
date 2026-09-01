"use client";

/**
 * The owner's dashboard.
 *
 * Design brief: a clinic reception desk runs on a day book — ruled lines, times
 * in the left margin, figures in a column you can scan down. That's the model
 * here: a ledger, not a SaaS dashboard. Figures are tabular and monospaced so
 * they line up; rows sit on hairline rules; the accent is the tenant's own
 * brand colour, so the page belongs to them rather than to us.
 *
 * Everything is quiet except one thing: the price field. That's the demo
 * closer, so that's where the boldness is spent.
 */

import { useState, useEffect, useCallback } from "react";

type Item = {
  id: string; name: string; description: string | null;
  price: number | null; currency: string;
  duration_minutes: number | null; is_bookable: boolean;
};
type Conversation = {
  id: string; customer: string; status: string;
  message_count: number; cost: number; last_message: string | null;
};
type Booking = {
  id: string; status: string; local_time: string;
  service: string | null; price: number | null; currency: string | null; customer: string;
};
type Escalation = {
  id: string; reason: string; trigger_source: string;
  status: string; created_at: string; customer: string;
};
type Data = {
  ok: boolean;
  business?: { name: string; slug: string; wallet: number; color: string; agent: string };
  stats?: { conversations: number; messages: number; bookings: number;
            open_escalations: number; total_cost: number };
  conversations?: Conversation[]; bookings?: Booking[];
  escalations?: Escalation[]; items?: Item[];
};
type Tab = "services" | "conversations" | "bookings" | "escalations";
type Thread = {
  ok: boolean; customer?: string; status?: string; cost?: number;
  messages?: { sender_type: string; body: string; at: string }[];
};

export default function Dashboard({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("services");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [threadBusy, setThreadBusy] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard?slug=${encodeURIComponent(slug)}`);
      setData(await res.json());
    } catch { setData({ ok: false }); }
  }, [slug]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  async function savePrice(item: Item) {
    const price = parseFloat(edits[item.id]);
    if (isNaN(price) || price < 0) {
      setToast({ text: "Enter a price of 0 or more.", bad: true });
      return;
    }
    setSaving(item.id);
    try {
      const res = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: item.id, price }),
      });
      const r = await res.json();
      if (r.ok) {
        setToast({ text: `Saved. ${data?.business?.agent ?? "Your assistant"} quotes ${item.currency} ${price.toFixed(2)} from the next message.` });
        setEdits(e => { const n = { ...e }; delete n[item.id]; return n; });
        load();
      } else {
        setToast({ text: `Not saved — ${String(r.reason ?? "unknown").replace(/_/g, " ")}.`, bad: true });
      }
    } catch {
      setToast({ text: "Not saved. Check your connection and try again.", bad: true });
    } finally { setSaving(null); }
  }

  async function openThread(id: string) {
    setThreadBusy(true);
    setThread({ ok: false });
    try {
      const res = await fetch(`/api/dashboard?thread=${id}`);
      setThread(await res.json());
    } catch {
      setThread({ ok: false });
    } finally { setThreadBusy(false); }
  }

  async function act(action: string, payload: Record<string, unknown>, done: string) {
    const key = String(payload.id);
    setActing(key);
    try {
      const res = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const r = await res.json();
      if (r.ok) { setToast({ text: done }); load(); }
      else setToast({ text: String(r.reason ?? "failed").replace(/_/g, " "), bad: true });
    } catch {
      setToast({ text: "Didn't save. Try again.", bad: true });
    } finally { setActing(null); }
  }

  if (!data) return <Shell><div style={S.quiet}>Loading</div></Shell>;
  if (!data.ok || !data.business) {
    return <Shell><div style={S.quiet}>No business found for &ldquo;{slug}&rdquo;.</div></Shell>;
  }

  const C = data.business.color || "#1D6A8C";
  const st = data.stats!;
  const TABS: { id: Tab; label: string; n?: number }[] = [
    { id: "services", label: "Services & prices" },
    { id: "conversations", label: "Conversations", n: st.conversations },
    { id: "bookings", label: "Diary", n: st.bookings },
    { id: "escalations", label: "Needs you", n: st.open_escalations },
  ];

  return (
    <Shell>
      <div style={{ ...S.accent, background: C }} />

      <header style={S.head}>
        <div>
          <h1 style={S.biz}>{data.business.name}</h1>
          <p style={S.sub}>
            <span style={{ ...S.live, background: C }} />
            {data.business.agent} is answering · credit{" "}
            <span style={S.mono}>${Number(data.business.wallet).toFixed(2)}</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/dashboard" style={S.linkQuiet}>All businesses</a>
          <a href={`/demo/${slug}`} target="_blank" rel="noreferrer"
             style={{ ...S.link, color: C, borderColor: C }}>
            Open the chat
          </a>
        </div>
      </header>

      <section style={S.figures}>
        <Fig n={st.conversations} l="conversations" />
        <Fig n={st.messages} l="messages" />
        <Fig n={st.bookings} l="upcoming" />
        <Fig n={st.open_escalations} l="need you" alert={st.open_escalations > 0} />
        <Fig n={`$${Number(st.total_cost).toFixed(3)}`} l="AI cost, all time" />
      </section>

      <nav style={S.tabs} role="tablist">
        {TABS.map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} role="tab" aria-selected={on} onClick={() => setTab(t.id)}
              style={{ ...S.tab, color: on ? "#14171A" : "#6E7573",
                       borderBottomColor: on ? C : "transparent" }}>
              {t.label}
              {t.n ? <span style={S.count}>{t.n}</span> : null}
            </button>
          );
        })}
      </nav>

      <main style={S.main}>
        {tab === "services" && (
          <>
            <p style={S.lead}>
              Change a price and save. {data.business.agent} quotes the new figure
              from the next message.
            </p>
            {(data.items ?? []).map(item => {
              const dirty = edits[item.id] !== undefined;
              return (
                <div key={item.id} data-row style={S.row}>
                  <div style={S.rowMain}>
                    <div style={S.name}>{item.name}</div>
                    {item.description && <div style={S.desc}>{item.description}</div>}
                  </div>
                  {item.duration_minutes ? (
                    <div style={{ ...S.mono, ...S.dur }}>{item.duration_minutes}m</div>
                  ) : null}
                  <div style={S.priceGroup}>
                    <span style={S.cur}>{item.currency}</span>
                    <input
                      type="number" step="0.01" min="0" inputMode="decimal"
                      aria-label={`Price for ${item.name}`}
                      value={dirty ? edits[item.id] : (item.price ?? "")}
                      onChange={e => setEdits(x => ({ ...x, [item.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter" && dirty) savePrice(item); }}
                      style={{
                        ...S.price,
                        borderBottomColor: dirty ? C : "#DAD9D3",
                        color: dirty ? C : "#14171A",
                      }}
                    />
                    <button onClick={() => savePrice(item)}
                      disabled={!dirty || saving === item.id}
                      style={{
                        ...S.save,
                        background: dirty ? C : "transparent",
                        color: dirty ? "#fff" : "#B4B3AC",
                        cursor: dirty ? "pointer" : "default",
                        borderColor: dirty ? C : "#E4E4DF",
                      }}>
                      {saving === item.id ? "Saving" : "Save"}
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === "conversations" && (
          (data.conversations ?? []).length === 0
            ? <Empty text="No conversations yet. Open the chat and send a message." />
            : (data.conversations ?? []).map(c => (
                <button key={c.id} data-row onClick={() => openThread(c.id)}
                        style={{ ...S.row, ...S.rowBtn }}>
                  <span style={S.rowMain}>
                    <span style={S.name}>
                      {c.customer}
                      {c.status === "escalated" && <span style={S.flag}>escalated</span>}
                    </span>
                    <span style={S.desc}>{c.last_message ?? "—"}</span>
                  </span>
                  <span style={S.rightCol}>
                    <span style={{ ...S.mono, display: "block" }}>{c.message_count}</span>
                    <span style={{ ...S.mono, ...S.faint, display: "block" }}>
                      ${Number(c.cost ?? 0).toFixed(4)}
                    </span>
                  </span>
                </button>
              ))
        )}

        {tab === "bookings" && (
          (data.bookings ?? []).length === 0
            ? <Empty text="No bookings yet. Try booking through the chat." />
            : (data.bookings ?? []).map(b => (
                <div key={b.id} data-row style={S.row}>
                  <div style={{ ...S.mono, ...S.time, color: C }}>{b.local_time}</div>
                  <div style={S.rowMain}>
                    <div style={S.name}>{b.service ?? "—"}</div>
                    <div style={S.desc}>{b.customer}</div>
                  </div>
                  <div style={S.rightCol}>
                    {b.price != null && (
                      <div style={S.mono}>{b.currency} {Number(b.price).toFixed(2)}</div>
                    )}
                    <div style={S.actions}>
                      {b.status === "pending" && (
                        <button disabled={acting === b.id}
                          onClick={() => act("booking_status", { id: b.id, status: "confirmed" }, "Booking confirmed.")}
                          style={{ ...S.act, color: C, borderColor: C }}>Confirm</button>
                      )}
                      {b.status === "confirmed" && (
                        <span style={{ ...S.faint, ...S.mono }}>confirmed</span>
                      )}
                      <button disabled={acting === b.id}
                        onClick={() => act("booking_status", { id: b.id, status: "cancelled" }, "Booking cancelled. The slot is free again.")}
                        style={S.actQuiet}>Cancel</button>
                    </div>
                  </div>
                </div>
              ))
        )}

        {tab === "escalations" && (
          (data.escalations ?? []).length === 0
            ? <Empty text="Nothing needs you right now. That's the point." />
            : (data.escalations ?? []).map(e => (
                <div key={e.id} data-row style={S.row}>
                  <div style={S.rowMain}>
                    <div style={S.name}>{e.customer}</div>
                    <div style={S.desc}>{e.reason.replace(/_/g, " ")}</div>
                  </div>
                  <div style={S.rightCol}>
                    <div style={{ ...S.mono, ...S.faint }}>
                      {new Date(e.created_at).toLocaleString("en-GB", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                    {e.status === "open" ? (
                      <button disabled={acting === e.id}
                        onClick={() => act("resolve_escalation", { id: e.id }, "Marked handled. The agent can answer again.")}
                        style={{ ...S.act, color: C, borderColor: C, marginTop: 5 }}>
                        Mark handled
                      </button>
                    ) : (
                      <div style={{ ...S.faint, ...S.mono }}>resolved</div>
                    )}
                  </div>
                </div>
              ))
        )}
      </main>

      {thread && (
        <div style={S.overlay} onClick={() => setThread(null)}>
          <div style={S.panel} onClick={ev => ev.stopPropagation()}>
            <div style={S.panelHead}>
              <div>
                <div style={S.name}>{thread.customer ?? "Conversation"}</div>
                <div style={S.desc}>
                  {thread.status ?? ""}
                  {thread.cost != null && ` · $${Number(thread.cost).toFixed(4)}`}
                </div>
              </div>
              <button onClick={() => setThread(null)} style={S.close} aria-label="Close">×</button>
            </div>
            <div style={S.panelBody}>
              {threadBusy && <div style={S.quiet}>Loading</div>}
              {!threadBusy && (thread.messages ?? []).length === 0 && (
                <div style={S.quiet}>No messages.</div>
              )}
              {(thread.messages ?? []).map((m, i) => (
                <div key={i} style={m.sender_type === "customer" ? S.msgIn : S.msgOut}>
                  <div style={{ ...S.mono, ...S.faint, marginBottom: 3 }}>
                    {m.sender_type === "customer" ? thread.customer : data.business!.agent} · {m.at}
                  </div>
                  <div style={S.msgBody}>{m.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" style={{ ...S.toast, borderLeftColor: toast.bad ? "#B3452F" : C }}>
          {toast.text}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={S.page}>
      <div style={S.sheet}>{children}</div>
      <style>{`
        input:focus-visible, button:focus-visible, a:focus-visible {
          outline: 2px solid currentColor; outline-offset: 3px;
        }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        @media (prefers-reduced-motion: no-preference) {
          [data-row] { animation: rise .28s ease both; }
        }
        @keyframes rise { from { opacity: 0; transform: translateY(4px); } }
      `}</style>
    </div>
  );
}

function Fig({ n, l, alert }: { n: number | string; l: string; alert?: boolean }) {
  return (
    <div>
      <div style={{ ...S.figN, color: alert ? "#B3452F" : "#14171A" }}>{n}</div>
      <div style={S.figL}>{l}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={S.empty}>{text}</div>;
}

const MONO = "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace";
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#EFEFEC", fontFamily: SANS, color: "#14171A", paddingBottom: 60 },
  sheet: { maxWidth: 860, margin: "0 auto", background: "#FCFCFA", minHeight: "100vh", boxShadow: "0 0 0 1px #E4E4DF" },
  accent: { height: 3 },
  quiet: { padding: "80px 28px", textAlign: "center", color: "#8B8F8C", fontSize: 14 },

  head: { padding: "26px 28px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  biz: { fontSize: 25, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 },
  sub: { fontSize: 13, color: "#6E7573", marginTop: 7, display: "flex", alignItems: "center", gap: 7 },
  live: { width: 6, height: 6, borderRadius: "50%", display: "inline-block" },
  link: { fontSize: 13, textDecoration: "none", border: "1px solid", borderRadius: 3, padding: "7px 13px", fontWeight: 500 },

  figures: { display: "flex", gap: 26, padding: "0 28px 22px", flexWrap: "wrap", borderBottom: "1px solid #E4E4DF" },
  figN: { fontFamily: MONO, fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" },
  figL: { fontSize: 10.5, color: "#8B8F8C", textTransform: "uppercase", letterSpacing: ".09em", marginTop: 3 },

  tabs: { display: "flex", padding: "0 22px", borderBottom: "1px solid #E4E4DF", overflowX: "auto" },
  tab: { background: "none", border: 0, borderBottom: "2px solid transparent", padding: "13px 8px", margin: "0 6px -1px", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  count: { marginLeft: 7, fontFamily: MONO, fontSize: 11.5, color: "#8B8F8C" },

  main: { padding: "8px 28px 0" },
  lead: { fontSize: 13.5, color: "#6E7573", lineHeight: 1.55, margin: "16px 0 6px", maxWidth: "60ch" },

  row: { display: "flex", alignItems: "center", gap: 16, padding: "15px 0", borderBottom: "1px solid #EDEDE8", flexWrap: "wrap" },
  rowMain: { flex: 1, minWidth: 180 },
  name: { fontSize: 14.5, fontWeight: 500, letterSpacing: "-0.005em" },
  desc: { fontSize: 12.5, color: "#8B8F8C", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "52ch" },
  mono: { fontFamily: MONO, fontSize: 12.5, fontVariantNumeric: "tabular-nums" },
  faint: { color: "#A3A6A2", fontSize: 11.5, marginTop: 3 },
  dur: { color: "#A3A6A2", width: 40, textAlign: "right" },
  time: { width: 108, fontSize: 13, fontWeight: 500 },
  rightCol: { textAlign: "right", minWidth: 76 },
  flag: { marginLeft: 8, fontFamily: MONO, fontSize: 10, color: "#B3452F", border: "1px solid #E8CFC9", padding: "1px 5px", borderRadius: 2, textTransform: "uppercase", letterSpacing: ".05em" },

  priceGroup: { display: "flex", alignItems: "baseline", gap: 8 },
  cur: { fontFamily: MONO, fontSize: 11, color: "#A3A6A2" },
  price: { width: 84, border: 0, borderBottom: "2px solid", background: "transparent", padding: "3px 0", fontSize: 17, fontFamily: MONO, fontVariantNumeric: "tabular-nums", textAlign: "right", fontWeight: 500 },
  save: { border: "1px solid", borderRadius: 3, padding: "6px 14px", fontSize: 12.5, fontWeight: 500, fontFamily: "inherit", transition: "background .15s" },

  empty: { padding: "44px 0", textAlign: "center", color: "#A3A6A2", fontSize: 13.5 },
  rowBtn: { background: "none", border: 0, borderBottom: "1px solid #EDEDE8", width: "100%", textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" },
  linkQuiet: { fontSize: 13, textDecoration: "none", border: "1px solid #E4E4DF", color: "#6E7573", borderRadius: 3, padding: "7px 13px" },
  actions: { display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 5 },
  act: { background: "none", border: "1px solid", borderRadius: 3, padding: "4px 10px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" },
  actQuiet: { background: "none", border: "1px solid #E4E4DF", color: "#A3A6A2", borderRadius: 3, padding: "4px 10px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" },
  overlay: { position: "fixed", inset: 0, background: "rgba(20,23,26,.28)", display: "flex", justifyContent: "flex-end", zIndex: 40 },
  panel: { width: "min(460px, 100vw)", background: "#FCFCFA", height: "100vh", display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(20,23,26,.16)" },
  panelHead: { padding: "20px 22px", borderBottom: "1px solid #E4E4DF", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  close: { background: "none", border: 0, fontSize: 22, lineHeight: 1, color: "#8B8F8C", cursor: "pointer", padding: 0 },
  panelBody: { flex: 1, overflowY: "auto", padding: "18px 22px" },
  msgIn: { marginBottom: 16 },
  msgOut: { marginBottom: 16, paddingLeft: 20 },
  msgBody: { fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap" },
  toast: { position: "fixed", left: "50%", bottom: 26, transform: "translateX(-50%)", background: "#FCFCFA", color: "#14171A", borderLeft: "3px solid", padding: "13px 18px", fontSize: 13, boxShadow: "0 6px 28px rgba(20,23,26,.14)", maxWidth: "min(92vw, 460px)", lineHeight: 1.5 },
};
