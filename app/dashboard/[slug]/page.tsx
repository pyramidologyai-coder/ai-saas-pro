"use client";

/**
 * The owner's dashboard. One page, four tabs, no navigation menu.
 * Built to docs/UI_UX.md: legible rather than invisible, restraint reads as trust.
 *
 * The Services tab is the demo closer — edit a price, the agent quotes the new
 * one within seconds. Build that well; the rest is supporting cast.
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
  conversations?: Conversation[];
  bookings?: Booking[];
  escalations?: Escalation[];
  items?: Item[];
};

type Tab = "services" | "conversations" | "bookings" | "escalations";

export default function Dashboard({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("services");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard?slug=${encodeURIComponent(slug)}`);
      setData(await res.json());
    } catch {
      setData({ ok: false });
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function savePrice(item: Item) {
    const raw = edits[item.id];
    const price = parseFloat(raw);
    if (isNaN(price) || price < 0) { setToast("That's not a valid price."); return; }

    setSaving(item.id);
    try {
      const res = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: item.id, price }),
      });
      const r = await res.json();
      if (r.ok) {
        setToast(`Updated. ${data?.business?.agent ?? "The agent"} will quote ${item.currency} ${price.toFixed(2)} from the next message.`);
        setEdits(e => { const n = { ...e }; delete n[item.id]; return n; });
        load();
      } else {
        setToast(`Couldn't save: ${r.reason ?? "unknown error"}`);
      }
    } catch {
      setToast("Couldn't save. Try again?");
    } finally {
      setSaving(null);
    }
  }

  if (!data) return <div style={S.center}>Loading…</div>;
  if (!data.ok || !data.business) {
    return <div style={S.center}>No business found for “{slug}”.</div>;
  }

  const C = data.business.color || "#1D6A8C";
  const st = data.stats!;

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: "services", label: "Services" },
    { id: "conversations", label: "Conversations", badge: st.conversations },
    { id: "bookings", label: "Bookings", badge: st.bookings },
    { id: "escalations", label: "Needs you", badge: st.open_escalations },
  ];

  return (
    <div style={S.page}>
      <header style={{ ...S.head, borderTopColor: C }}>
        <div>
          <div style={S.biz}>{data.business.name}</div>
          <div style={S.sub}>
            {data.business.agent} is answering · credit ${Number(data.business.wallet).toFixed(2)}
          </div>
        </div>
        <a href={`/demo/${slug}`} target="_blank" rel="noreferrer"
           style={{ ...S.openBtn, background: C }}>
          Open the chat →
        </a>
      </header>

      <div style={S.stats}>
        <Stat n={st.conversations} l="conversations" />
        <Stat n={st.messages} l="messages" />
        <Stat n={st.bookings} l="upcoming bookings" />
        <Stat n={st.open_escalations} l="need a human" warn={st.open_escalations > 0} />
        <Stat n={`$${Number(st.total_cost).toFixed(3)}`} l="AI cost, all time" />
      </div>

      <nav style={S.tabs}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              ...S.tab,
              color: tab === t.id ? C : "#666",
              borderBottomColor: tab === t.id ? C : "transparent",
              fontWeight: tab === t.id ? 600 : 400,
            }}>
            {t.label}
            {t.badge ? <span style={S.badge}>{t.badge}</span> : null}
          </button>
        ))}
      </nav>

      <main style={S.main}>
        {tab === "services" && (
          <>
            <p style={S.hint}>
              Change a price and save. {data.business.agent} quotes the new one from
              the next message — no reload, no waiting.
            </p>
            {(data.items ?? []).map(item => {
              const dirty = edits[item.id] !== undefined;
              return (
                <div key={item.id} style={S.row}>
                  <div style={{ flex: 1 }}>
                    <div style={S.rowTitle}>{item.name}</div>
                    {item.description && <div style={S.rowSub}>{item.description}</div>}
                    {item.duration_minutes && (
                      <div style={S.rowMeta}>{item.duration_minutes} min</div>
                    )}
                  </div>
                  <div style={S.priceBox}>
                    <span style={S.cur}>{item.currency}</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={dirty ? edits[item.id] : (item.price ?? "")}
                      onChange={e => setEdits(x => ({ ...x, [item.id]: e.target.value }))}
                      style={{ ...S.priceInput, borderColor: dirty ? C : "#DDD9D0" }}
                    />
                    <button
                      onClick={() => savePrice(item)}
                      disabled={!dirty || saving === item.id}
                      style={{
                        ...S.saveBtn,
                        background: dirty ? C : "#E8E6E0",
                        color: dirty ? "#fff" : "#999",
                        cursor: dirty ? "pointer" : "default",
                      }}>
                      {saving === item.id ? "Saving…" : "Save"}
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
              <div key={c.id} style={S.row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.rowTitle}>
                    {c.customer}
                    {c.status === "escalated" && <span style={S.pill}>escalated</span>}
                  </div>
                  <div style={S.rowSub}>{c.last_message ?? "—"}</div>
                </div>
                <div style={S.right}>
                  <div style={S.rowMeta}>{c.message_count} msgs</div>
                  <div style={S.cost}>${Number(c.cost ?? 0).toFixed(4)}</div>
                </div>
              </div>
            ))
        )}

        {tab === "bookings" && (
          (data.bookings ?? []).length === 0
            ? <Empty text="No bookings yet. Try booking through the chat." />
            : (data.bookings ?? []).map(b => (
              <div key={b.id} style={S.row}>
                <div style={{ flex: 1 }}>
                  <div style={S.rowTitle}>{b.service ?? "—"}</div>
                  <div style={S.rowSub}>{b.customer}</div>
                </div>
                <div style={S.right}>
                  <div style={S.when}>{b.local_time}</div>
                  <div style={S.rowMeta}>
                    {b.price ? `${b.currency} ${Number(b.price).toFixed(2)}` : ""} · {b.status}
                  </div>
                </div>
              </div>
            ))
        )}

        {tab === "escalations" && (
          (data.escalations ?? []).length === 0
            ? <Empty text="Nothing needs you right now. That's the point." />
            : (data.escalations ?? []).map(e => (
              <div key={e.id} style={S.row}>
                <div style={{ flex: 1 }}>
                  <div style={S.rowTitle}>{e.customer}</div>
                  <div style={S.rowSub}>{e.reason.replace(/_/g, " ")}</div>
                </div>
                <div style={S.right}>
                  <div style={S.rowMeta}>{new Date(e.created_at).toLocaleString("en-GB")}</div>
                  <div style={S.rowMeta}>via {e.trigger_source}</div>
                </div>
              </div>
            ))
        )}
      </main>

      {toast && <div style={{ ...S.toast, background: C }}>{toast}</div>}
    </div>
  );
}

function Stat({ n, l, warn }: { n: number | string; l: string; warn?: boolean }) {
  return (
    <div style={S.stat}>
      <div style={{ ...S.statN, color: warn ? "#9E3B2A" : "#1a1a1a" }}>{n}</div>
      <div style={S.statL}>{l}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={S.empty}>{text}</div>;
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#F5F3EE", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", paddingBottom: 60 },
  center: { minHeight: "100vh", display: "grid", placeItems: "center", color: "#888", fontFamily: "system-ui, sans-serif" },
  head: { background: "#fff", borderTop: "3px solid", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
  biz: { fontSize: 20, fontWeight: 600 },
  sub: { fontSize: 13, color: "#777", marginTop: 3 },
  openBtn: { color: "#fff", textDecoration: "none", padding: "9px 16px", borderRadius: 6, fontSize: 13.5, fontWeight: 500 },
  stats: { display: "flex", gap: 1, background: "#E8E6E0", flexWrap: "wrap" },
  stat: { flex: "1 1 120px", background: "#fff", padding: "14px 18px" },
  statN: { fontSize: 22, fontWeight: 600 },
  statL: { fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: ".06em", marginTop: 2 },
  tabs: { display: "flex", background: "#fff", borderBottom: "1px solid #E8E6E0", overflowX: "auto" },
  tab: { background: "none", border: 0, borderBottom: "2px solid transparent", padding: "13px 18px", fontSize: 14, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  badge: { marginLeft: 7, background: "#EFEDE7", color: "#666", borderRadius: 10, padding: "1px 7px", fontSize: 11.5 },
  main: { padding: "18px 24px", maxWidth: 900, margin: "0 auto" },
  hint: { fontSize: 13.5, color: "#777", marginBottom: 14, lineHeight: 1.5 },
  row: { background: "#fff", padding: "14px 18px", marginBottom: 8, borderRadius: 8, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" },
  rowTitle: { fontSize: 15, fontWeight: 500 },
  rowSub: { fontSize: 13, color: "#777", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 460 },
  rowMeta: { fontSize: 11.5, color: "#999", marginTop: 3 },
  right: { textAlign: "right" },
  when: { fontSize: 14, fontWeight: 500 },
  cost: { fontSize: 11.5, color: "#999", fontFamily: "ui-monospace, monospace", marginTop: 3 },
  pill: { marginLeft: 8, background: "#FBEAE7", color: "#9E3B2A", fontSize: 10.5, padding: "2px 7px", borderRadius: 9, textTransform: "uppercase", letterSpacing: ".05em" },
  priceBox: { display: "flex", alignItems: "center", gap: 7 },
  cur: { fontSize: 12.5, color: "#999" },
  priceInput: { width: 92, padding: "8px 10px", border: "1px solid", borderRadius: 6, fontSize: 14.5, fontFamily: "inherit" },
  saveBtn: { border: 0, borderRadius: 6, padding: "9px 15px", fontSize: 13.5, fontWeight: 500, fontFamily: "inherit" },
  empty: { background: "#fff", padding: "34px 24px", borderRadius: 8, textAlign: "center", color: "#999", fontSize: 14 },
  toast: { position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", color: "#fff", padding: "12px 20px", borderRadius: 8, fontSize: 13.5, boxShadow: "0 4px 20px rgba(0,0,0,.18)", maxWidth: "90vw", textAlign: "center" },
};
