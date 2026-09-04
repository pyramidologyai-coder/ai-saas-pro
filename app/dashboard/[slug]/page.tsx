"use client";

/**
 * The platform shell. Six modules down the side, one workspace on the right.
 *
 * Design brief: a business owner opening this at 7am wants one answer — what
 * happened while I was asleep. So the shell opens on that, and every module is
 * one click away rather than buried in menus. Sidebar on desktop, a scrolling
 * rail on mobile. The tenant's brand colour runs through it, because this is
 * their workspace, not ours.
 */

import { useState, useEffect, useCallback, useRef } from "react";

type Agent = { slug: string; name: string; department: string | null;
               audience: string; sector_id: string; is_primary: boolean; conversations: number };
type Staff = { id: string; name: string; email: string | null; role: string;
               status: string; access_code: string };
type Social = { id: string; platform: string; handle: string | null;
                status: string; followers: number | null };
type Post = { id: string; body: string; platforms: string[]; status: string;
              scheduled_at: string | null; published_at: string | null;
              reach: number | null; clicks: number | null };
type Invoice = { id: string; number: string; amount: number; currency: string;
                 status: string; issued_on: string; customer: string };
type Data = {
  ok: boolean;
  business?: { name: string; slug: string; color: string; plan: string; wallet: number;
               domain: string | null; tagline: string | null; address: string | null;
               phone: string | null; map_url: string | null; greeting: string | null;
               branch_label: string | null; organisation: string | null;
               suggestions: string[] | null; hours: Record<string, [string,string]|null> | null;
               logo_url: string | null; access_code: string };
  agents?: Agent[]; team?: Staff[]; social?: Social[]; posts?: Post[];
  invoices?: Invoice[]; finance?: { paid: number; unpaid: number; count: number };
  items?: Item[];
  knowledge?: Know[];
  knowledge_size?: { entries: number; words: number; tokens: number };
  billing?: Billing;
  automations?: Auto[]; broadcasts?: Cast[]; audit?: Audit[];
  domains?: Domain[]; analytics?: Stats | null;
  resources?: Resource[]; credentials?: Cred[];
  documents?: Doc[]; budget?: Budget;
  outbox?: { pending: number; sent: number; failed: number };
  stats?: { conversations: number; bookings: number; needs_you: number };
};
type Mod = "home" | "agents" | "services" | "knowledge" | "marketing" | "automations" | "connections"
         | "finance" | "insights" | "team" | "settings" | "billing" | "activity";
type Domain = { id: string; hostname: string; status: string; token: string };
type Resource = { id: string; name: string; title: string | null; bio: string | null;
                  kind: string; capacity: number; items: string[]; upcoming: number };
type Doc = { id: string; filename: string; status: string; pages: number | null;
             chunks: number; words: number; bytes: number | null;
             error: string | null; created_at: string };
type Budget = { words: number; tokens: number; entries: number; documents: number;
                cost_per_message_usd: number; state: string; advice: string };
type Cred = { provider: string; label: string | null; status: string;
              hint: string; last_used_at: string | null };
type Stats = {
  ok: boolean; days: number; conversion: number;
  summary: { conversations: number; messages: number; bookings: number;
             escalations: number; cost: number };
  by_day: { day: string; conversations: number; bookings: number }[];
  by_hour: { hour: number; messages: number }[];
  top_services: { name: string; n: number }[];
  escalation_reasons: { reason: string; n: number }[];
};
type Auto = { id: string; kind: string; is_on: boolean; offset_hours: number | null;
              body: string | null; channel: string; sent_count: number };
type Cast = { id: string; body: string; audience: string; status: string;
              scheduled_at: string | null; recipients: number | null };
type Audit = { actor: string; actor_role: string | null; action: string;
               target: string | null; created_at: string };
type Know = { id: string; title: string; body: string; agent_slug: string | null };
type Billing = { subscription: { plan: string; status: string; amount: number | null;
                   currency: string; trial_ends_at: string | null; period_end: string | null } | null;
                 plans: { code: string; label: string; amount: number; currency: string; features: string[] }[] };
type Item = { id: string; name: string; description: string | null;
              price: number | null; currency: string; minutes: number | null };

const PLATFORMS: Record<string, { label: string; glyph: string }> = {
  instagram: { label: "Instagram", glyph: "IG" },
  facebook: { label: "Facebook", glyph: "FB" },
  tiktok: { label: "TikTok", glyph: "TT" },
  google_business: { label: "Google Business", glyph: "GB" },
  whatsapp: { label: "WhatsApp", glyph: "WA" },
};

const SECTORS = [
  { id: "support", label: "Customer support", audience: "public" },
  { id: "hr", label: "HR", audience: "internal" },
  { id: "payroll", label: "Payroll", audience: "internal" },
  { id: "finance", label: "Finance", audience: "internal" },
];

export default function Platform({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const [d, setD] = useState<Data | null>(null);
  const [mod, setMod] = useState<Mod>("home");
  const [toast, setToast] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState("owner");

  useEffect(() => {
    fetch("/api/platform", { method: "OPTIONS" })
      .then(r => r.json()).then(j => setRole(j.role ?? "viewer")).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/platform?slug=${encodeURIComponent(slug)}`);
      setD(await r.json());
    } catch { setD({ ok: false }); }
  }, [slug]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!toast) return;
    const x = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(x);
  }, [toast]);

  async function act(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/platform", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, action: body.action, payload: body.payload ?? body }),
      });
      const j = await r.json();
      if (j.ok) { setToast({ t: ok }); await load(); return j; }
      setToast({ t: String(j.reason ?? "failed").replace(/_/g, " "), bad: true });
    } catch { setToast({ t: "Didn't save. Try again.", bad: true }); }
    finally { setBusy(false); }
    return null;
  }

  if (!d) return <Frame><div className="pf-quiet">Loading</div></Frame>;
  if (!d.ok || !d.business) return <Frame><div className="pf-quiet">No business found.</div></Frame>;

  const b = d.business;
  const C = b.color || "#1D6A8C";

  const MODS: { id: Mod; label: string; glyph: string; n?: number }[] = [
    { id: "home", label: "Overview", glyph: "◈" },
    { id: "agents", label: "AI employees", glyph: "◉", n: d.agents?.length },
    { id: "services", label: "Services", glyph: "▦", n: d.items?.length },
    { id: "knowledge", label: "Knowledge", glyph: "❋", n: d.knowledge?.length },
    { id: "marketing", label: "Marketing", glyph: "◐", n: d.posts?.length },
    { id: "automations", label: "Automations", glyph: "⟳",
      n: (d.automations ?? []).filter(a => a.is_on).length },
    { id: "finance", label: "Finance", glyph: "▤", n: d.finance?.count },
    { id: "insights", label: "Insights", glyph: "◔" },
    { id: "team", label: "Team", glyph: "◍", n: (d.resources?.length ?? 0) + (d.team?.length ?? 0) },
    { id: "connections", label: "Connections", glyph: "⚯",
      n: (d.credentials ?? []).filter(c => c.status === "active").length },
    { id: "settings", label: "Settings", glyph: "⚙" },
    { id: "billing", label: "Billing", glyph: "◫" },
    { id: "activity", label: "Activity", glyph: "☰" },
  ];

  return (
    <Frame color={C}>
      <div className="pf">
        <aside className="pf-side">
          <div className="pf-biz">
            <span className="pf-mark" style={{ background: C }}>{b.name.charAt(0)}</span>
            <div>
              <div className="pf-bizname">{b.branch_label ?? b.name}</div>
              <div className="pf-plan">{b.plan} plan</div>
            </div>
          </div>

          <nav className="pf-nav">
            {MODS.map(m => (
              <button key={m.id} onClick={() => setMod(m.id)}
                className={mod === m.id ? "on" : ""}
                style={mod === m.id ? { background: C } : undefined}>
                <span className="pf-glyph">{m.glyph}</span>
                <span>{m.label}</span>
                {m.n ? <em>{m.n}</em> : null}
              </button>
            ))}
          </nav>

          <div className="pf-side-foot">
            {b.organisation && (
              <a href={`/group/${b.organisation}`}>← All branches</a>
            )}
            <a href={`/dashboard/${slug}/chats`}>Chats &amp; bookings</a>
            <a href={`/demo/${slug}`} target="_blank" rel="noreferrer">Open my page ↗</a>
            <button onClick={async () => {
              await fetch("/api/login", { method: "DELETE" });
              window.location.href = "/login";
            }}>Sign out</button>
          </div>
        </aside>

        <main className="pf-work">
          {mod === "home" && <Home d={d} C={C} go={setMod} />}
          {mod === "agents" && <Agents d={d} C={C} slug={slug} act={act} busy={busy} />}
          {mod === "services" && <Services d={d} C={C} act={act} busy={busy} role={role} />}
          {mod === "knowledge" && <Knowledge d={d} C={C} act={act} busy={busy}
                                             role={role} slug={slug} reload={load} />}
          {mod === "marketing" && <Marketing d={d} C={C} act={act} busy={busy} />}
          {mod === "automations" && <Automations d={d} C={C} act={act} busy={busy} role={role} />}
          {mod === "insights" && <Insights d={d} C={C} />}
          {mod === "activity" && <Activity d={d} C={C} />}
          {mod === "finance" && <Finance d={d} C={C} act={act} />}
          {mod === "connections" && <Connections d={d} C={C} act={act} busy={busy} role={role} />}
          {mod === "team" && <Team d={d} C={C} act={act} busy={busy} />}
          {mod === "billing" && <Billing d={d} C={C} slug={slug} />}
          {mod === "settings" && <Settings d={d} C={C} slug={slug} act={act} busy={busy} role={role} />}
        </main>
      </div>

      {toast && (
        <div className="pf-toast" style={{ borderInlineStartColor: toast.bad ? "#B3452F" : C }}>
          {toast.t}
        </div>
      )}
    </Frame>
  );
}

/* ── Overview ──────────────────────────────────────────────────────────── */
function Home({ d, C, go }: { d: Data; C: string; go: (m: Mod) => void }) {
  const f = d.finance!;
  const queued = (d.posts ?? []).filter(p => p.status === "queued").length;
  const connected = (d.social ?? []).filter(s => s.status === "connected").length;
  return (
    <>
      <h1 className="pf-h1">Overview</h1>
      <p className="pf-lede">Everything running in your business, in one place.</p>

      <div className="pf-cards">
        <Card label="AI employees" value={String(d.agents?.length ?? 0)}
              sub="answering right now" onClick={() => go("agents")} C={C} />
        <Card label="Paid this period" value={`${f.paid.toFixed(0)}`} prefix="RM"
              sub={`RM ${f.unpaid.toFixed(0)} outstanding`} onClick={() => go("finance")} C={C} />
        <Card label="Posts queued" value={String(queued)}
              sub={`${connected} channels connected`} onClick={() => go("marketing")} C={C} />
        <Card label="Team" value={String(d.team?.length ?? 0)}
              sub="with access" onClick={() => go("team")} C={C} />
      </div>

      <h2 className="pf-h2">Your AI employees</h2>
      <div className="pf-list">
        {(d.agents ?? []).map(a => (
          <div key={a.slug} className="pf-row">
            <span className="pf-avatar" style={{ background: C }}>{a.name.charAt(0)}</span>
            <div className="pf-row-main">
              <div className="pf-row-title">
                {a.name}
                <span className={`pf-tag ${a.audience}`}>{a.audience === "internal" ? "staff only" : "public"}</span>
              </div>
              <div className="pf-row-sub">{a.department ?? a.sector_id}</div>
            </div>
            <div className="pf-num">{a.conversations}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function Card({ label, value, sub, prefix, onClick, C }:
  { label: string; value: string; sub: string; prefix?: string; onClick: () => void; C: string }) {
  return (
    <button className="pf-card" onClick={onClick}>
      <div className="pf-card-label">{label}</div>
      <div className="pf-card-value" style={{ color: C }}>
        {prefix && <em>{prefix}</em>}{value}
      </div>
      <div className="pf-card-sub">{sub}</div>
    </button>
  );
}

/* ── AI employees ──────────────────────────────────────────────────────── */
function Agents({ d, C, slug, act, busy }:
  { d: Data; C: string; slug: string; act: Function; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [sector, setSector] = useState("support");
  const [name, setName] = useState("");
  const [knows, setKnows] = useState("");
  const chosen = SECTORS.find(s => s.id === sector)!;

  return (
    <>
      <div className="pf-head-row">
        <div>
          <h1 className="pf-h1">AI employees</h1>
          <p className="pf-lede">
            One for your customers, more for your staff. Each has its own rules.
          </p>
        </div>
        <button className="pf-btn" style={{ background: C }} onClick={() => setOpen(o => !o)}>
          {open ? "Cancel" : "+ Hire one"}
        </button>
      </div>

      {open && (
        <div className="pf-panel">
          <label>What should it do?
            <div className="pf-chips">
              {SECTORS.map(s => (
                <button key={s.id} onClick={() => setSector(s.id)}
                  className={s.id === sector ? "on" : ""}
                  style={s.id === sector ? { background: C, borderColor: C } : undefined}>
                  {s.label}
                </button>
              ))}
            </div>
          </label>

          <p className={`pf-hint ${chosen.audience}`}>
            {chosen.audience === "internal"
              ? "Staff only. Sits behind your access code, and never quotes anyone's personal figures — it explains policy and points to the right person."
              : "Public. Anyone on your page can talk to it. It only knows your published services and prices."}
          </p>

          <label>Give it a name
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Maya" />
          </label>

          {chosen.audience === "internal" && (
            <label>What should it know?
              <textarea rows={5} value={knows} onChange={e => setKnows(e.target.value)}
                placeholder={"- Annual leave: 16 days per year\n- Apply through the HR portal, 3 days ahead\n- Notice period: 1 month after probation"} />
              <span className="pf-sub">
                Policies and processes only. Never anyone&apos;s personal records.
              </span>
            </label>
          )}

          <button className="pf-btn" style={{ background: C }} disabled={busy}
            onClick={async () => {
              const r = await act({ action: "add_agent",
                payload: { sector, agent: name || null, knows: knows || null } },
                "Hired. Your new AI employee is ready.");
              if (r?.ok) { setOpen(false); setName(""); setKnows(""); }
            }}>
            {busy ? "Hiring…" : "Hire"}
          </button>
        </div>
      )}

      <div className="pf-list">
        {(d.agents ?? []).map(a => (
          <div key={a.slug} className="pf-row">
            <span className="pf-avatar" style={{ background: C }}>{a.name.charAt(0)}</span>
            <div className="pf-row-main">
              <div className="pf-row-title">
                {a.name}
                <span className={`pf-tag ${a.audience}`}>
                  {a.audience === "internal" ? "staff only" : "public"}
                </span>
                {a.is_primary && <span className="pf-tag pri">main</span>}
              </div>
              <div className="pf-row-sub">{a.department ?? a.sector_id}</div>
            </div>
            <div className="pf-row-right">
              <div className="pf-num">{a.conversations}</div>
              {a.audience === "public" && (
                <a className="pf-link" style={{ color: C }}
                   href={`/demo/${slug}?agent=${a.slug}`} target="_blank" rel="noreferrer">
                  open ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}


/* ── Services ──────────────────────────────────────────────────────────── */
function Services({ d, C, act, busy, role }:
  { d: Data; C: string; act: Function; busy: boolean; role: string }) {
  const can = ["owner", "manager"].includes(role);
  const [draft, setDraft] = useState({ name: "", price: "", minutes: "", description: "" });
  const [edits, setEdits] = useState<Record<string, string>>({});

  return (
    <>
      <h1 className="pf-h1">Services</h1>
      <p className="pf-lede">
        Your AI quotes these exactly. It never invents a price or a service that
        isn&apos;t here.
      </p>

      {!can && <p className="pf-note">Your role can view these but not change them.</p>}

      {can && (
        <div className="pf-panel">
          <div className="pf-schedrow">
            <input value={draft.name} onChange={e => setDraft(x => ({ ...x, name: e.target.value }))}
                   placeholder="Service name" />
            <input value={draft.price} onChange={e => setDraft(x => ({ ...x, price: e.target.value }))}
                   placeholder="Price" inputMode="decimal" style={{ maxWidth: 100 }} />
            <input value={draft.minutes} onChange={e => setDraft(x => ({ ...x, minutes: e.target.value }))}
                   placeholder="Mins" inputMode="numeric" style={{ maxWidth: 80 }} />
            <button className="pf-btn" style={{ background: C }}
              disabled={busy || !draft.name.trim()}
              onClick={async () => {
                const r = await act({ action: "save_item", payload: draft }, "Added. Your AI knows about it now.");
                if (r?.ok) setDraft({ name: "", price: "", minutes: "", description: "" });
              }}>Add</button>
          </div>
          <input value={draft.description}
                 onChange={e => setDraft(x => ({ ...x, description: e.target.value }))}
                 placeholder="Short description — optional" style={{ marginTop: 8 }} />
        </div>
      )}

      <div className="pf-list">
        {(d.items ?? []).map(it => {
          const dirty = edits[it.id] !== undefined;
          return (
            <div key={it.id} className="pf-row">
              <div className="pf-row-main">
                <div className="pf-row-title">{it.name}</div>
                <div className="pf-row-sub">
                  {it.description ?? "no description"}
                  {it.minutes ? ` · ${it.minutes} min` : ""}
                </div>
              </div>
              <div className="pf-priceedit">
                <span>{it.currency}</span>
                <input type="number" step="0.01" min="0" disabled={!can}
                  value={dirty ? edits[it.id] : (it.price ?? "")}
                  onChange={e => setEdits(x => ({ ...x, [it.id]: e.target.value }))}
                  style={{ borderBottomColor: dirty ? C : "#E7E3DC", color: dirty ? C : undefined }} />
                {dirty && (
                  <button className="pf-mini on" style={{ borderColor: C, color: C }}
                    onClick={async () => {
                      const r = await act({ action: "price",
                        payload: { id: it.id, price: Number(edits[it.id]) } },
                        `Saved. Quoted at ${it.currency} ${Number(edits[it.id]).toFixed(2)} from the next message.`);
                      if (r?.ok) setEdits(x => { const n = { ...x }; delete n[it.id]; return n; });
                    }}>save</button>
                )}
              </div>
              {can && !dirty && (
                <button className="pf-mini"
                  onClick={() => act({ action: "remove_item", payload: { id: it.id } }, "Removed.")}>
                  remove
                </button>
              )}
            </div>
          );
        })}
        {(d.items ?? []).length === 0 && <div className="pf-empty">Nothing listed yet.</div>}
      </div>
    </>
  );
}

/* ── Marketing ─────────────────────────────────────────────────────────── */
function Marketing({ d, C, act, busy }: { d: Data; C: string; act: Function; busy: boolean }) {
  const [body, setBody] = useState("");
  const [when, setWhen] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (p: string) =>
    setPicked(x => x.includes(p) ? x.filter(y => y !== p) : [...x, p]);

  return (
    <>
      <h1 className="pf-h1">Marketing</h1>
      <p className="pf-lede">Write once, schedule everywhere.</p>

      <h2 className="pf-h2">Your channels</h2>
      <div className="pf-channels">
        {(d.social ?? []).map(s => {
          const meta = PLATFORMS[s.platform] ?? { label: s.platform, glyph: "??" };
          return (
            <div key={s.id} className={`pf-chan ${s.status}`}>
              <span className="pf-chan-g">{meta.glyph}</span>
              <div>
                <div className="pf-chan-name">{meta.label}</div>
                <div className="pf-chan-st">
                  {s.status === "connected" ? (s.handle ?? "connected") : "not connected"}
                </div>
              </div>
              <button className="pf-chan-btn" style={{ borderColor: C, color: C }}>
                {s.status === "connected" ? "Manage" : "Connect"}
              </button>
            </div>
          );
        })}
      </div>
      <p className="pf-note">
        Connecting a channel needs approval from each platform — that&apos;s their
        process, not ours, and it takes a few weeks. Posts you write now are saved
        and scheduled; they publish the moment a channel is live.
      </p>

      <h2 className="pf-h2">Write a post</h2>
      <div className="pf-panel">
        <textarea rows={4} value={body} onChange={e => setBody(e.target.value)}
          placeholder="Flu jabs are RM 85 this month. Walk in, or book through our page." />
        <div className="pf-picks">
          {Object.entries(PLATFORMS).map(([k, v]) => (
            <button key={k} onClick={() => toggle(k)}
              className={picked.includes(k) ? "on" : ""}
              style={picked.includes(k) ? { background: C, borderColor: C } : undefined}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="pf-schedrow">
          <label className="pf-inline">Schedule
            <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} />
          </label>
          <button className="pf-btn" style={{ background: C }}
            disabled={busy || !body.trim()}
            onClick={async () => {
              const r = await act({ action: "save_post",
                payload: { body, platforms: picked, scheduled_at: when || null } },
                when ? "Scheduled." : "Saved as a draft.");
              if (r?.ok) { setBody(""); setWhen(""); setPicked([]); }
            }}>
            {when ? "Schedule" : "Save draft"}
          </button>
        </div>
      </div>

      <h2 className="pf-h2">Posts</h2>
      <div className="pf-list">
        {(d.posts ?? []).length === 0 && <div className="pf-empty">Nothing yet.</div>}
        {(d.posts ?? []).map(p => (
          <div key={p.id} className="pf-row">
            <div className="pf-row-main">
              <div className="pf-row-title pf-clip">{p.body}</div>
              <div className="pf-row-sub">
                {p.platforms.map(x => PLATFORMS[x]?.label ?? x).join(" · ") || "no channel"}
                {p.scheduled_at && ` · ${new Date(p.scheduled_at).toLocaleString("en-GB", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`}
              </div>
            </div>
            <span className={`pf-tag ${p.status}`}>{p.status}</span>
            {p.status !== "cancelled" && (
              <button className="pf-mini"
                onClick={() => act({ action: "set_post_status", id: p.id, status: "cancelled" }, "Cancelled.")}>
                cancel
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Finance ───────────────────────────────────────────────────────────── */
function Finance({ d, C, act }: { d: Data; C: string; act: Function }) {
  const f = d.finance!;
  return (
    <>
      <h1 className="pf-h1">Finance</h1>
      <p className="pf-lede">Invoices come straight off your bookings, so the figures are real.</p>

      <div className="pf-cards">
        <div className="pf-card static">
          <div className="pf-card-label">Paid</div>
          <div className="pf-card-value" style={{ color: C }}><em>RM</em>{f.paid.toFixed(2)}</div>
        </div>
        <div className="pf-card static">
          <div className="pf-card-label">Outstanding</div>
          <div className="pf-card-value" style={{ color: "#B3452F" }}><em>RM</em>{f.unpaid.toFixed(2)}</div>
        </div>
        <div className="pf-card static">
          <div className="pf-card-label">Invoices</div>
          <div className="pf-card-value">{f.count}</div>
        </div>
      </div>

      <h2 className="pf-h2">Invoices</h2>
      <div className="pf-list">
        {(d.invoices ?? []).length === 0 && (
          <div className="pf-empty">
            No invoices yet. Confirm a booking and raise one from there.
          </div>
        )}
        {(d.invoices ?? []).map(i => (
          <div key={i.id} className="pf-row">
            <span className="pf-inv">{i.number}</span>
            <div className="pf-row-main">
              <div className="pf-row-title">{i.customer}</div>
              <div className="pf-row-sub">{i.issued_on}</div>
            </div>
            <div className="pf-amt">{i.currency} {Number(i.amount).toFixed(2)}</div>
            {i.status === "unpaid" ? (
              <button className="pf-mini on" style={{ borderColor: C, color: C }}
                onClick={() => act({ action: "set_invoice_status", id: i.id, status: "paid" }, "Marked paid.")}>
                mark paid
              </button>
            ) : <span className={`pf-tag ${i.status}`}>{i.status}</span>}
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Team ──────────────────────────────────────────────────────────────── */
function Team({ d, C, act, busy }: { d: Data; C: string; act: Function; busy: boolean }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("staff");
  const [rName, setRName] = useState("");
  const [rTitle, setRTitle] = useState("");
  const [rBio, setRBio] = useState("");
  const ROLES = [
    ["owner", "Everything, including billing and team"],
    ["manager", "Prices, marketing, finance, bookings"],
    ["staff", "Chats and bookings"],
    ["viewer", "Read only"],
  ];
  return (
    <>
      <h1 className="pf-h1">Team</h1>
      <p className="pf-lede">
        Two different things here. Who customers get booked with, and who can
        sign in to this dashboard.
      </p>

      <h2 className="pf-h2">Who takes appointments</h2>
      <p className="pf-sub" style={{ marginTop: -6, marginBottom: 14 }}>
        Add everyone who sees customers. Bookings are spread across them, so two
        people can be booked at the same time without clashing. Your AI knows
        who they are and what they do.
      </p>

      <div className="pf-panel">
        <div className="pf-schedrow">
          <input value={rName} onChange={e => setRName(e.target.value)} placeholder="Dr Lim" />
          <input value={rTitle} onChange={e => setRTitle(e.target.value)}
                 placeholder="Family physician" />
          <button className="pf-btn" style={{ background: C }} disabled={busy || !rName.trim()}
            onClick={async () => {
              const r = await act({ action: "save_resource",
                payload: { name: rName, title: rTitle, bio: rBio } },
                "Added. Bookings can go to them now.");
              if (r?.ok) { setRName(""); setRTitle(""); setRBio(""); }
            }}>Add</button>
        </div>
        <input value={rBio} onChange={e => setRBio(e.target.value)} style={{ marginTop: 8 }}
               placeholder="One line your AI can tell customers — optional" />
      </div>

      <div className="pf-list" style={{ marginBottom: 8 }}>
        {(d.resources ?? []).length === 0 && (
          <div className="pf-empty">
            Nobody added. Right now only one appointment can be held per time slot.
          </div>
        )}
        {(d.resources ?? []).map(r => (
          <div key={r.id} className="pf-row">
            <span className="pf-avatar" style={{ background: C }}>{r.name.charAt(0)}</span>
            <div className="pf-row-main">
              <div className="pf-row-title">{r.name}</div>
              <div className="pf-row-sub">{r.title ?? "no title"}{r.bio ? ` · ${r.bio}` : ""}</div>
            </div>
            <div className="pf-row-right">
              <div className="pf-num">{r.upcoming}</div>
              <div className="pf-row-sub">upcoming</div>
            </div>
            <button className="pf-mini"
              onClick={() => act({ action: "remove_resource", payload: { id: r.id } }, "Removed.")}>
              remove
            </button>
          </div>
        ))}
      </div>

      <h2 className="pf-h2">Who can sign in</h2>

      <div className="pf-panel">
        <div className="pf-schedrow">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Their name" />
          <select value={role} onChange={e => setRole(e.target.value)}>
            {ROLES.map(([r]) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button className="pf-btn" style={{ background: C }} disabled={busy || !name.trim()}
            onClick={async () => {
              const r = await act({ action: "add_staff", payload: { name, role } }, "Added. Give them their key.");
              if (r?.ok) setName("");
            }}>Add</button>
        </div>
        <div className="pf-roles">
          {ROLES.map(([r, what]) => (
            <div key={r}><b>{r}</b><span>{what}</span></div>
          ))}
        </div>
      </div>

      <div className="pf-list">
        {(d.team ?? []).map(s => (
          <div key={s.id} className="pf-row">
            <span className="pf-avatar" style={{ background: C }}>{s.name.charAt(0)}</span>
            <div className="pf-row-main">
              <div className="pf-row-title">{s.name}</div>
              <div className="pf-row-sub">{s.email ?? "no email"}</div>
            </div>
            <code className="pf-key">{s.access_code}</code>
            <span className={`pf-tag role`}>{s.role}</span>
          </div>
        ))}
      </div>
    </>
  );
}


/* ── Knowledge ─────────────────────────────────────────────────────────── */
function Knowledge({ d, C, act, busy, role, slug, reload }:
  { d: Data; C: string; act: Function; busy: boolean; role: string;
    slug: string; reload: () => void }) {
  const can = role === "owner";
  const b = d.budget;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [up, setUp] = useState<{ name: string; state: string; detail?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUp({ name: file.name, state: "reading" });
    const fd = new FormData();
    fd.append("slug", slug);
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const r = await res.json();
      if (r.ok) {
        setUp({ name: file.name, state: "done",
                detail: `${r.chunks} section${r.chunks === 1 ? "" : "s"}, ${r.words} words` });
        reload();
        setTimeout(() => setUp(null), 6000);
      } else {
        setUp({ name: file.name, state: "failed",
                detail: r.detail ?? String(r.reason ?? "").replace(/_/g, " ") });
      }
    } catch {
      setUp({ name: file.name, state: "failed", detail: "Upload didn't complete." });
    }
  }

  return (
    <>
      <h1 className="pf-h1">Knowledge</h1>
      <p className="pf-lede">
        Everything your AI should know that isn&apos;t a price. Upload what you
        already have, or type it in. It reads all of this before every reply.
      </p>

      {!can && <p className="pf-note">Only the owner can change this.</p>}

      {can && (
        <>
          <h2 className="pf-h2">Upload a document</h2>
          <div className="pf-drop"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) upload(f);
            }}
            onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" hidden
              accept=".pdf,.docx,.txt,.md,.csv"
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
            <div className="pf-drop-in">
              <div className="pf-drop-icon" style={{ background: C }}>↑</div>
              <div>
                <div className="pf-row-title">Drop a file, or click to choose</div>
                <div className="pf-row-sub">
                  PDF, Word, or plain text · up to 8 MB · your policy sheet, FAQ, price list
                </div>
              </div>
            </div>
          </div>

          {up && (
            <div className={`pf-upstat ${up.state}`}>
              <b>{up.name}</b>
              {up.state === "reading" && <span> — reading…</span>}
              {up.state === "done" && <span> — added, {up.detail}</span>}
              {up.state === "failed" && <span> — {up.detail}</span>}
            </div>
          )}
        </>
      )}

      {(d.documents ?? []).length > 0 && (
        <>
          <h2 className="pf-h2">Documents</h2>
          <div className="pf-list">
            {(d.documents ?? []).map(doc => (
              <div key={doc.id} className="pf-row">
                <span className="pf-doc" style={{ borderColor: C, color: C }}>
                  {(doc.filename.split(".").pop() ?? "?").slice(0, 4).toUpperCase()}
                </span>
                <div className="pf-row-main">
                  <div className="pf-row-title">{doc.filename}</div>
                  <div className="pf-row-sub">
                    {doc.chunks} section{doc.chunks === 1 ? "" : "s"} · {doc.words} words
                    {doc.pages ? ` · ${doc.pages} pages` : ""}
                  </div>
                </div>
                {can && (
                  <button className="pf-mini"
                    onClick={() => act({ action: "remove_document", payload: { id: doc.id } },
                      "Removed, along with everything it taught your AI.")}>
                    remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {can && (
        <>
          <h2 className="pf-h2">Or type something in</h2>
          <div className="pf-panel">
            <label>Title
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Parking" />
            </label>
            <label>What should it know?
              <textarea rows={4} value={body} onChange={e => setBody(e.target.value)}
                placeholder={"Free parking behind the building. Enter from Jalan SS15/4.\nSpaces are limited after 10am."} />
            </label>
            <button className="pf-btn" style={{ background: C }} disabled={busy || !body.trim()}
              onClick={async () => {
                const r = await act({ action: "save_knowledge", payload: { title, body } },
                  "Saved. Your AI knows this from the next message.");
                if (r?.ok) { setTitle(""); setBody(""); }
              }}>{busy ? "Saving…" : "Add"}</button>
          </div>
        </>
      )}

      {b && b.entries > 0 && (
        <div className={`pf-budget ${b.state}`}>
          <div className="pf-budget-top">
            <span>{b.entries} entries · {b.words} words</span>
            <span className="pf-mono">${b.cost_per_message_usd.toFixed(5)} per message</span>
          </div>
          <div className="pf-budget-bar">
            <div style={{ width: `${Math.min(100, (b.words / 6000) * 100)}%`,
                          background: b.state === "heavy" ? "#B3452F" : C }} />
          </div>
          <p>{b.advice}</p>
        </div>
      )}

      <h2 className="pf-h2">Typed entries</h2>
      <div className="pf-list">
        {(d.knowledge ?? []).filter(k => !(d.documents ?? []).some(doc =>
            k.title.startsWith(doc.filename))).length === 0 && (
          <div className="pf-empty">Nothing typed in yet.</div>
        )}
        {(d.knowledge ?? []).map(k => (
          <div key={k.id} className="pf-row">
            <div className="pf-row-main">
              <div className="pf-row-title">{k.title}</div>
              <div className="pf-row-sub pf-clip">{k.body}</div>
            </div>
            {can && (
              <button className="pf-mini"
                onClick={() => act({ action: "remove_knowledge", payload: { id: k.id } }, "Removed.")}>
                remove
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Billing ───────────────────────────────────────────────────────────── */
function Billing({ d, C, slug }: { d: Data; C: string; slug: string }) {
  const bill = d.billing;
  const sub = bill?.subscription;
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const daysLeft = sub?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null;

  async function subscribe(plan: string) {
    setBusy(plan); setMsg("");
    try {
      const r = await fetch("/api/billing", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, plan }),
      });
      const j = await r.json();
      if (j.ok && j.url) { window.location.href = j.url; return; }
      setMsg(j.reason === "not_configured"
        ? "Card payments aren't switched on yet on this deployment."
        : "Couldn't start checkout. Try again in a moment.");
    } catch { setMsg("Couldn't reach the payment provider."); }
    finally { setBusy(null); }
  }

  return (
    <>
      <h1 className="pf-h1">Billing</h1>
      <p className="pf-lede">
        {sub?.status === "trialing" && daysLeft !== null
          ? `You're on the free trial — ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left.`
          : `You're on the ${sub?.plan ?? "trial"} plan.`}
      </p>

      <div className="pf-plans">
        {(bill?.plans ?? []).map(p => {
          const current = sub?.plan === p.code;
          return (
            <div key={p.code} className={`pf-plan ${current ? "cur" : ""}`}
                 style={current ? { borderColor: C } : undefined}>
              {current && <span className="pf-plan-badge" style={{ background: C }}>Current</span>}
              <div className="pf-plan-name">{p.label}</div>
              <div className="pf-plan-cost" style={{ color: C }}>
                {p.amount > 0 ? <><em>{p.currency}</em>{p.amount}<i>/mo</i></> : "Free"}
              </div>
              <ul>{p.features.map(f => <li key={f}>{f}</li>)}</ul>
              {!current && p.amount > 0 && (
                <button className="pf-btn" style={{ background: C, width: "100%", marginTop: 14 }}
                  disabled={busy === p.code} onClick={() => subscribe(p.code)}>
                  {busy === p.code ? "Opening…" : "Choose"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {msg && <p className="pf-note">{msg}</p>}
    </>
  );
}


/* ── Automations ───────────────────────────────────────────────────────── */
const AUTO_COPY: Record<string, { label: string; what: string; when: string }> = {
  booking_reminder: { label: "Appointment reminder",
    what: "Nudges customers before they're due in. The cheapest way to cut no-shows.",
    when: "hours before the appointment" },
  no_show_followup: { label: "Missed appointment",
    what: "Follows up when someone doesn't turn up, and offers to rebook.",
    when: "hours after they missed it" },
  win_back: { label: "Win back",
    what: "Reaches customers who haven't been in for a while.",
    when: "hours since their last visit" },
  review_request: { label: "Ask for a review",
    what: "Asks after a good visit, while it's fresh.",
    when: "hours after the appointment" },
};

const AUDIENCES: [string, string][] = [
  ["all", "Everyone"], ["recent", "Been in the last 90 days"],
  ["lapsed", "Not seen in 6 months"], ["no_show", "Missed an appointment"],
];

function Automations({ d, C, act, busy, role }:
  { d: Data; C: string; act: Function; busy: boolean; role: string }) {
  const can = ["owner", "manager"].includes(role);
  const [body, setBody] = useState("");
  const [aud, setAud] = useState("all");
  const [when, setWhen] = useState("");

  return (
    <>
      <h1 className="pf-h1">Automations</h1>
      <p className="pf-lede">
        Things that happen without anyone pressing anything. Reminders alone
        usually pay for the whole thing.
      </p>

      {!can && <p className="pf-note">Your role can see these but not change them.</p>}

      {(d.automations ?? []).map(a => {
        const meta = AUTO_COPY[a.kind] ?? { label: a.kind, what: "", when: "hours" };
        return (
          <div key={a.id} className={`pf-auto ${a.is_on ? "on" : ""}`}
               style={a.is_on ? { borderColor: C } : undefined}>
            <div className="pf-auto-head">
              <div>
                <div className="pf-row-title">{meta.label}</div>
                <div className="pf-row-sub">{meta.what}</div>
              </div>
              <label className="pf-switch">
                <input type="checkbox" checked={a.is_on} disabled={!can || busy}
                  onChange={e => act({ action: "set_automation",
                    payload: { kind: a.kind, is_on: e.target.checked } },
                    e.target.checked ? `${meta.label} is on.` : `${meta.label} is off.`)} />
                <span style={a.is_on ? { background: C } : undefined} />
              </label>
            </div>
            {a.is_on && (
              <div className="pf-auto-body">
                <div className="pf-auto-timing">
                  <input type="number" defaultValue={Math.abs(a.offset_hours ?? 24)}
                    disabled={!can}
                    onBlur={e => act({ action: "set_automation",
                      payload: { kind: a.kind,
                        offset_hours: a.kind === "booking_reminder"
                          ? -Math.abs(Number(e.target.value))
                          : Math.abs(Number(e.target.value)) } }, "Timing saved.")} />
                  <span>{meta.when}</span>
                </div>
                <textarea rows={2} defaultValue={a.body ?? ""} disabled={!can}
                  onBlur={e => act({ action: "set_automation",
                    payload: { kind: a.kind, body: e.target.value } }, "Message saved.")} />
                {a.sent_count > 0 && <span className="pf-sub">{a.sent_count} sent so far</span>}
              </div>
            )}
          </div>
        );
      })}

      <h2 className="pf-h2">Send a broadcast</h2>
      <div className="pf-panel">
        <p className="pf-sub" style={{ marginTop: 0 }}>
          A one-off message to a group of your customers. Use it for an offer,
          a closure, or a new service.
        </p>
        <textarea rows={3} value={body} onChange={e => setBody(e.target.value)}
          placeholder="Flu jabs are RM 85 this month. Book through our page or call us." />
        <div className="pf-chips">
          {AUDIENCES.map(([k, label]) => (
            <button key={k} onClick={() => setAud(k)} className={aud === k ? "on" : ""}
              style={aud === k ? { background: C, borderColor: C } : undefined}>{label}</button>
          ))}
        </div>
        <div className="pf-schedrow">
          <label className="pf-inline">Send at
            <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} />
          </label>
          <button className="pf-btn" style={{ background: C }}
            disabled={!can || busy || !body.trim()}
            onClick={async () => {
              const r = await act({ action: "save_broadcast",
                payload: { body, audience: aud, scheduled_at: when || null } },
                "Queued.");
              if (r?.ok) {
                setBody(""); setWhen("");
              }
            }}>{when ? "Schedule" : "Save draft"}</button>
        </div>
      </div>

      {(d.broadcasts ?? []).length > 0 && (
        <>
          <h2 className="pf-h2">Broadcasts</h2>
          <div className="pf-list">
            {(d.broadcasts ?? []).map(b => (
              <div key={b.id} className="pf-row">
                <div className="pf-row-main">
                  <div className="pf-row-title pf-clip">{b.body}</div>
                  <div className="pf-row-sub">
                    {AUDIENCES.find(([k]) => k === b.audience)?.[1] ?? b.audience}
                    {b.recipients != null && ` · ${b.recipients} people`}
                  </div>
                </div>
                <span className={`pf-tag ${b.status}`}>{b.status}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="pf-note">
        Sending runs on a schedule that isn&apos;t switched on yet — messages are
        queued and counted, not delivered. Email needs a verified sending domain
        first; WhatsApp needs a Business API number.
      </p>
    </>
  );
}


/* ── Insights ──────────────────────────────────────────────────────────── */
function Insights({ d, C }: { d: Data; C: string }) {
  const a = d.analytics;
  if (!a?.ok) return (<><h1 className="pf-h1">Insights</h1>
    <div className="pf-empty">Not enough yet. Come back after a few conversations.</div></>);

  const s = a.summary;
  const maxDay = Math.max(1, ...a.by_day.map(x => x.conversations));
  const maxHour = Math.max(1, ...a.by_hour.map(x => x.messages));
  const busiest = [...a.by_hour].sort((x, y) => y.messages - x.messages)[0];

  return (
    <>
      <h1 className="pf-h1">Insights</h1>
      <p className="pf-lede">The last {a.days} days.</p>

      <div className="pf-cards">
        <div className="pf-card static">
          <div className="pf-card-label">Conversations</div>
          <div className="pf-card-value" style={{ color: C }}>{s.conversations}</div>
        </div>
        <div className="pf-card static">
          <div className="pf-card-label">Turned into bookings</div>
          <div className="pf-card-value" style={{ color: C }}>{a.conversion}<em style={{ marginInlineStart: 3 }}>%</em></div>
        </div>
        <div className="pf-card static">
          <div className="pf-card-label">Handed to a human</div>
          <div className="pf-card-value">{s.escalations}</div>
          <div className="pf-card-sub">
            {s.conversations > 0
              ? `${Math.round(100 * s.escalations / s.conversations)}% of conversations`
              : ""}
          </div>
        </div>
        <div className="pf-card static">
          <div className="pf-card-label">AI cost</div>
          <div className="pf-card-value"><em>$</em>{Number(s.cost).toFixed(2)}</div>
          <div className="pf-card-sub">
            {s.bookings > 0 ? `$${(Number(s.cost) / s.bookings).toFixed(3)} per booking` : ""}
          </div>
        </div>
      </div>

      <h2 className="pf-h2">Day by day</h2>
      <div className="pf-chart">
        {a.by_day.map(x => (
          <div key={x.day} className="pf-bar" title={`${x.day}: ${x.conversations} chats, ${x.bookings} booked`}>
            <div className="pf-bar-stack">
              <div className="pf-bar-fill" style={{
                height: `${(x.conversations / maxDay) * 100}%`,
                background: `color-mix(in oklab, ${C} 26%, transparent)` }} />
              <div className="pf-bar-fill on" style={{
                height: `${(x.bookings / maxDay) * 100}%`, background: C }} />
            </div>
          </div>
        ))}
      </div>
      <div className="pf-legend">
        <span><i style={{ background: `color-mix(in oklab, ${C} 26%, transparent)` }} />conversations</span>
        <span><i style={{ background: C }} />bookings</span>
      </div>

      {a.by_hour.length > 0 && (
        <>
          <h2 className="pf-h2">When people message you</h2>
          <div className="pf-chart hours">
            {Array.from({ length: 24 }, (_, h) => {
              const found = a.by_hour.find(x => x.hour === h);
              const n = found?.messages ?? 0;
              return (
                <div key={h} className="pf-bar" title={`${h}:00 — ${n} messages`}>
                  <div className="pf-bar-stack">
                    <div className="pf-bar-fill on" style={{
                      height: `${(n / maxHour) * 100}%`, background: C }} />
                  </div>
                  {h % 6 === 0 && <span className="pf-bar-label">{h}</span>}
                </div>
              );
            })}
          </div>
          {busiest && (
            <p className="pf-sub">
              Busiest around {busiest.hour}:00. Worth knowing when you&apos;re deciding
              who&apos;s on the desk.
            </p>
          )}
        </>
      )}

      {a.top_services.length > 0 && (
        <>
          <h2 className="pf-h2">Most booked</h2>
          <div className="pf-list">
            {a.top_services.map(x => (
              <div key={x.name} className="pf-row">
                <div className="pf-row-main"><div className="pf-row-title">{x.name}</div></div>
                <div className="pf-num">{x.n}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {a.escalation_reasons.length > 0 && (
        <>
          <h2 className="pf-h2">Why it handed over</h2>
          <div className="pf-list">
            {a.escalation_reasons.map(x => (
              <div key={x.reason} className="pf-row">
                <div className="pf-row-main">
                  <div className="pf-row-title">{x.reason.replace(/_/g, " ")}</div>
                </div>
                <div className="pf-num">{x.n}</div>
              </div>
            ))}
          </div>
          <p className="pf-sub">
            A reason showing up often is usually something to add to Knowledge.
          </p>
        </>
      )}
    </>
  );
}

/* ── Activity ──────────────────────────────────────────────────────────── */
function Activity({ d, C }: { d: Data; C: string }) {
  return (
    <>
      <h1 className="pf-h1">Activity</h1>
      <p className="pf-lede">
        Everything anyone has done here, including us. If Automology support
        opens your account, it shows up in this list like anyone else.
      </p>

      <div className="pf-list">
        {(d.audit ?? []).length === 0 && (
          <div className="pf-empty">Nothing recorded yet.</div>
        )}
        {(d.audit ?? []).map((a, i) => (
          <div key={i} className="pf-row">
            <span className="pf-avatar" style={{
              background: a.actor === "platform" ? "#B3452F" : C, fontSize: 12,
            }}>{a.actor === "platform" ? "A" : a.actor.charAt(0).toUpperCase()}</span>
            <div className="pf-row-main">
              <div className="pf-row-title">
                {a.action.replace(/_/g, " ")}
                {a.actor === "platform" && <span className="pf-tag internal">Automology</span>}
              </div>
              <div className="pf-row-sub">{a.actor}{a.actor_role ? ` · ${a.actor_role}` : ""}</div>
            </div>
            <div className="pf-row-sub">
              {new Date(a.created_at).toLocaleString("en-GB", {
                day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}


/* ── Connections ───────────────────────────────────────────────────────── */
const PROVIDERS: { id: string; label: string; what: string; where: string }[] = [
  { id: "whatsapp", label: "WhatsApp Business",
    what: "Send reminders and confirmations on WhatsApp instead of email.",
    where: "Meta Business → WhatsApp → API Setup → permanent token" },
  { id: "google_calendar", label: "Google Calendar",
    what: "Bookings appear in the calendar your team already uses.",
    where: "Google Cloud Console → Credentials → OAuth client" },
  { id: "instagram", label: "Instagram",
    what: "Publish the posts you schedule here.",
    where: "Meta Business → Instagram → access token" },
  { id: "facebook", label: "Facebook",
    what: "Publish to your page.", where: "Meta Business → page access token" },
  { id: "tiktok", label: "TikTok",
    what: "Publish to TikTok.", where: "TikTok for Developers → app → access token" },
  { id: "google_business", label: "Google Business Profile",
    what: "Keep your hours and replies in sync with Google.",
    where: "Google Cloud Console → Business Profile API" },
  { id: "smtp", label: "Your own email sender",
    what: "Send from your own address rather than ours.",
    where: "Your email provider → SMTP credentials" },
];

function Connections({ d, C, act, busy, role }:
  { d: Data; C: string; act: Function; busy: boolean; role: string }) {
  const can = role === "owner";
  const have = new Map((d.credentials ?? []).map(c => [c.provider, c]));
  const [open, setOpen] = useState<string | null>(null);
  const [secret, setSecret] = useState("");

  return (
    <>
      <h1 className="pf-h1">Connections</h1>
      <p className="pf-lede">
        Plug in your own accounts. Your keys stay on your business — we never
        show them again once saved, and nothing is shared with other businesses.
      </p>

      {!can && <p className="pf-note">Only the owner can change these.</p>}

      <div className="pf-list">
        {PROVIDERS.map(p => {
          const c = have.get(p.id);
          const isOpen = open === p.id;
          return (
            <div key={p.id} className="pf-conn">
              <div className="pf-conn-head">
                <div className="pf-row-main">
                  <div className="pf-row-title">
                    {p.label}
                    {c && <span className="pf-tag public">connected ····{c.hint}</span>}
                  </div>
                  <div className="pf-row-sub">{p.what}</div>
                </div>
                {can && (
                  <button className="pf-mini"
                    onClick={() => { setOpen(isOpen ? null : p.id); setSecret(""); }}>
                    {c ? "replace" : "connect"}
                  </button>
                )}
                {can && c && (
                  <button className="pf-mini"
                    onClick={() => act({ action: "remove_credential", payload: { provider: p.id } },
                      "Disconnected.")}>remove</button>
                )}
              </div>

              {isOpen && can && (
                <div className="pf-conn-body">
                  <p className="pf-sub" style={{ marginTop: 0 }}>Where to find it: {p.where}</p>
                  <div className="pf-schedrow">
                    <input type="password" value={secret} autoFocus
                      onChange={e => setSecret(e.target.value)}
                      placeholder="Paste your key or token" />
                    <button className="pf-btn" style={{ background: C }}
                      disabled={busy || !secret.trim()}
                      onClick={async () => {
                        const r = await act({ action: "save_credential",
                          payload: { provider: p.id, secret } },
                          `${p.label} connected.`);
                        if (r?.ok) { setOpen(null); setSecret(""); }
                      }}>Save</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="pf-note">
        Saving a key stores it — it doesn&apos;t switch the channel on yet. Sending
        through WhatsApp and publishing to social still need the delivery side
        built, and each platform has its own approval process before they let
        anyone post through an API.
      </p>
    </>
  );
}

/* ── Settings ──────────────────────────────────────────────────────────── */
const DAYS: [string, string][] = [
  ["mon","Monday"],["tue","Tuesday"],["wed","Wednesday"],["thu","Thursday"],
  ["fri","Friday"],["sat","Saturday"],["sun","Sunday"],
];
const SWATCHES = ["#1D6A8C","#1E6F5C","#8C4A2F","#5B4B8A","#B3452F","#2F5D8C","#7A6A3F","#14171A"];

function Settings({ d, C, slug, act, busy, role }:
  { d: Data; C: string; slug: string; act: Function; busy: boolean; role: string }) {
  const b = d.business!;
  const can = role === "owner";
  const url = typeof window !== "undefined" ? `${window.location.origin}/demo/${slug}` : "";

  const [f, setF] = useState({
    name: b.name, color: b.color, tagline: b.tagline ?? "", address: b.address ?? "",
    phone: b.phone ?? "", greeting: b.greeting ?? "", agent: d.agents?.[0]?.name ?? "",
    logo_url: b.logo_url ?? "",
  });
  const [sugg, setSugg] = useState<string[]>(b.suggestions ?? ["", "", ""]);
  const [dom, setDom] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const embedSnippet =
    `<script src="${origin}/api/embed?slug=${slug}" async></script>`;
  const [hours, setHours] = useState(b.hours ?? {});

  const set = (k: string, v: string) => setF(x => ({ ...x, [k]: v }));

  return (
    <>
      <h1 className="pf-h1">Settings</h1>
      <p className="pf-lede">This is your page. Change anything here and it updates live.</p>

      {!can && <p className="pf-note">Only the owner can change these.</p>}

      <h2 className="pf-h2">Your link</h2>
      <div className="pf-panel">
        <div className="pf-linkbox">
          <code>{url}</code>
          <button style={{ background: C }} onClick={() => navigator.clipboard?.writeText(url)}>Copy</button>
        </div>
        <span className="pf-sub">Put this on your website, your Instagram bio, or send it to a customer.</span>
      </div>

      <h2 className="pf-h2">Your brand</h2>
      <div className="pf-panel">
        <label>Business name
          <input value={f.name} disabled={!can} onChange={e => set("name", e.target.value)} />
        </label>
        <label>Your AI&apos;s name
          <input value={f.agent} disabled={!can} onChange={e => set("agent", e.target.value)} />
        </label>
        <label>Brand colour
          <div className="pf-swatches">
            {SWATCHES.map(c => (
              <button key={c} disabled={!can} style={{ background: c }}
                className={c === f.color ? "on" : ""} onClick={() => set("color", c)} aria-label={c} />
            ))}
            <input type="color" value={f.color} disabled={!can}
                   onChange={e => set("color", e.target.value)} aria-label="Custom colour" />
          </div>
        </label>
        <label>Tagline
          <input value={f.tagline} disabled={!can} onChange={e => set("tagline", e.target.value)}
                 placeholder="A family clinic. Walk in, or book ahead." />
        </label>
        <label>First thing your AI says
          <input value={f.greeting} disabled={!can} onChange={e => set("greeting", e.target.value)}
                 placeholder="Hello! How can I help?" />
        </label>
        <label>Three suggested questions
          {sugg.slice(0, 3).map((q, i) => (
            <input key={i} value={q} disabled={!can} style={{ marginTop: 7 }}
              onChange={e => setSugg(x => x.map((y, j) => j === i ? e.target.value : y))} />
          ))}
        </label>
        <div className="pf-schedrow">
          <label className="pf-inline">Phone
            <input value={f.phone} disabled={!can} onChange={e => set("phone", e.target.value)} />
          </label>
          <label className="pf-inline">Address
            <input value={f.address} disabled={!can} onChange={e => set("address", e.target.value)} />
          </label>
        </div>
        {can && (
          <button className="pf-btn" style={{ background: C }} disabled={busy}
            onClick={() => act({ action: "branding",
              payload: { ...f, suggestions: sugg.filter(x => x.trim()) } },
              "Saved. Your page is updated.")}>
            {busy ? "Saving…" : "Save brand"}
          </button>
        )}
      </div>

      <h2 className="pf-h2">Opening hours</h2>
      <div className="pf-panel">
        {DAYS.map(([k, label]) => {
          const h = (hours as any)[k];
          return (
            <div key={k} className="pf-day">
              <label className="pf-toggle">
                <input type="checkbox" checked={!!h} disabled={!can}
                  onChange={e => setHours((x: any) => ({ ...x, [k]: e.target.checked ? ["09:00","18:00"] : null }))} />
                <span>{label}</span>
              </label>
              {h ? (
                <div className="pf-times">
                  <input type="time" value={h[0]} disabled={!can}
                    onChange={e => setHours((x: any) => ({ ...x, [k]: [e.target.value, h[1]] }))} />
                  <em>to</em>
                  <input type="time" value={h[1]} disabled={!can}
                    onChange={e => setHours((x: any) => ({ ...x, [k]: [h[0], e.target.value] }))} />
                </div>
              ) : <span className="pf-closed">Closed</span>}
            </div>
          );
        })}
        {can && (
          <button className="pf-btn" style={{ background: C, marginTop: 16 }} disabled={busy}
            onClick={() => act({ action: "hours", payload: { hours } },
              "Hours saved. Your AI quotes these now and won't book outside them.")}>
            Save hours
          </button>
        )}
        <span className="pf-sub">
          Your AI reads these. It refuses bookings outside them and tells customers when you next open.
        </span>
      </div>

      <h2 className="pf-h2">Put it on your website</h2>
      <div className="pf-panel">
        <p className="pf-sub" style={{ marginTop: 0 }}>
          Paste this one line before the closing &lt;/body&gt; tag of your site.
          A chat button appears in the corner of every page.
        </p>
        <pre className="pf-code">{embedSnippet}</pre>
        <button className="pf-btn" style={{ background: C }}
          onClick={() => navigator.clipboard?.writeText(embedSnippet)}>
          Copy the code
        </button>
        <span className="pf-sub">
          Works on WordPress, Wix, Squarespace, Shopify — anywhere you can add
          HTML. Send it to whoever looks after your website if that isn&apos;t you.
        </span>
      </div>

      <h2 className="pf-h2">Your own domain</h2>
      <div className="pf-panel">
        {(d.domains ?? []).map(dom => (
          <div key={dom.id} className="pf-domrow">
            <div>
              <div className="pf-row-title">
                {dom.hostname}
                <span className={`pf-tag ${dom.status === "live" ? "public" : "queued"}`}>
                  {dom.status === "live" ? "live" : "waiting for DNS"}
                </span>
              </div>
              {dom.status !== "live" && (
                <div className="pf-dns">
                  Add this record with your domain provider, then wait a few minutes:
                  <div className="pf-dnsrow">
                    <span>Type</span><code>CNAME</code>
                    <span>Name</span><code>{dom.hostname.split(".")[0]}</code>
                    <span>Value</span><code>cname.vercel-dns.com</code>
                  </div>
                </div>
              )}
            </div>
            {can && (
              <button className="pf-mini"
                onClick={() => act({ action: "remove_domain", payload: { id: dom.id } }, "Removed.")}>
                remove
              </button>
            )}
          </div>
        ))}
        {can && (d.domains ?? []).length === 0 && (
          <>
            <div className="pf-domain">
              <input placeholder="chat.yourbusiness.com" value={dom}
                     onChange={e => setDom(e.target.value)} />
              <button className="pf-btn" style={{ background: C }} disabled={busy || !dom.trim()}
                onClick={async () => {
                  const r = await act({ action: "claim_domain", payload: { hostname: dom } },
                    "Claimed. Add the DNS record and it goes live within minutes.");
                  if (r?.ok) setDom("");
                }}>Claim</button>
            </div>
            <span className="pf-sub">
              Your customers see your domain, not ours. We handle the certificate.
            </span>
          </>
        )}
      </div>

      <h2 className="pf-h2">Owner key</h2>
      <div className="pf-panel">
        <div className="pf-keyrow">
          <span>Owner key</span>
          <code className="pf-key">{b.access_code}</code>
        </div>
        <span className="pf-sub">
          Keep this private — anyone with it can change your prices. Give staff their own
          keys in Team rather than sharing this one.
        </span>
      </div>
    </>
  );
}

/* ── Frame ─────────────────────────────────────────────────────────────── */
function Frame({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ "--c": color ?? "#1D6A8C" } as React.CSSProperties}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      {children}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; background: #F4F2ED; }
.pf-quiet { min-height: 100vh; display: grid; place-items: center; color: #A5A099;
  font-family: "Instrument Sans", system-ui, sans-serif; }

.pf {
  --ink:#12100E; --mut:#66625B; --fade:#A5A099; --line:#E7E3DC; --paper:#FBFAF7;
  display: grid; grid-template-columns: 1fr; min-height: 100vh;
  font-family: "Instrument Sans", system-ui, -apple-system, sans-serif; color: var(--ink);
}
@media (min-width: 860px) { .pf { grid-template-columns: 246px 1fr; } }

/* sidebar */
.pf-side { background: #fff; border-inline-end: 1px solid var(--line); display: flex;
  flex-direction: column; gap: 18px; padding: 20px 14px; }
@media (max-width: 859px) { .pf-side { border-inline-end: 0; border-bottom: 1px solid var(--line); } }
.pf-biz { display: flex; align-items: center; gap: 11px; padding: 0 8px; }
.pf-mark { width: 38px; height: 38px; border-radius: 10px; color: #fff; display: grid;
  place-items: center; font-family: "Fraunces", serif; font-size: 17px; font-weight: 560; }
.pf-bizname { font-weight: 600; font-size: 14.5px; letter-spacing: -0.01em; }
.pf-plan { font-size: 11px; color: var(--fade); text-transform: capitalize; }
.pf-nav { display: flex; flex-direction: column; gap: 2px; }
@media (max-width: 859px) { .pf-nav { flex-direction: row; overflow-x: auto; padding-bottom: 4px; } }
.pf-nav button {
  display: flex; align-items: center; gap: 10px; width: 100%; background: none; border: 0;
  padding: 10px 12px; border-radius: 9px; font-size: 13.5px; cursor: pointer;
  font-family: inherit; color: var(--mut); text-align: start; white-space: nowrap;
  transition: background .15s ease, color .15s ease;
}
.pf-nav button:hover { background: #F4F2ED; color: var(--ink); }
.pf-nav button.on { color: #fff; font-weight: 500; }
.pf-nav button.on em { background: rgba(255,255,255,.24); color: #fff; }
.pf-glyph { font-size: 13px; opacity: .8; }
.pf-nav em { margin-inline-start: auto; font-style: normal; font-size: 11px;
  background: #F4F2ED; color: var(--fade); border-radius: 999px; padding: 1px 7px; }
.pf-side-foot { margin-top: auto; display: flex; flex-direction: column; gap: 6px; padding: 0 8px; }
@media (max-width: 859px) { .pf-side-foot { flex-direction: row; margin-top: 8px; } }
.pf-side-foot a, .pf-side-foot button {
  font-size: 12px; color: var(--mut); text-decoration: none; background: none;
  border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; cursor: pointer;
  font-family: inherit; text-align: center;
}
.pf-side-foot a:hover, .pf-side-foot button:hover { border-color: var(--ink); color: var(--ink); }

/* workspace */
.pf-work { padding: clamp(22px, 4vw, 40px); max-width: 900px; }
.pf-h1 { font-family: "Fraunces", serif; font-weight: 560; font-size: clamp(25px, 4vw, 34px);
  letter-spacing: -0.025em; margin: 0; }
.pf-lede { font-size: 14px; color: var(--mut); margin: 8px 0 28px; line-height: 1.6; max-width: 52ch; }
.pf-h2 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .14em;
  color: var(--fade); margin: 34px 0 14px; }
.pf-head-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.pf-note { font-size: 12.5px; color: var(--mut); background: #FFF9EC; border: 1px solid #F0E4C8;
  border-radius: 10px; padding: 12px 14px; line-height: 1.55; margin: 12px 0 0; }
.pf-sub { font-size: 12px; color: var(--fade); display: block; margin-top: 8px; line-height: 1.5; }
.pf-empty { padding: 32px; text-align: center; color: var(--fade); font-size: 13.5px;
  background: #fff; border: 1px solid var(--line); border-radius: 12px; }

/* cards */
.pf-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(158px, 1fr)); gap: 12px; }
.pf-card { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 18px;
  text-align: start; cursor: pointer; font-family: inherit;
  transition: transform .18s ease, box-shadow .18s ease; }
.pf-card:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(18,16,14,.08); }
.pf-card.static { cursor: default; }
.pf-card.static:hover { transform: none; box-shadow: none; }
.pf-card-label { font-size: 11px; color: var(--fade); text-transform: uppercase; letter-spacing: .09em; font-weight: 600; }
.pf-card-value { font-family: "Fraunces", serif; font-weight: 560; font-size: 30px;
  letter-spacing: -0.02em; margin-top: 6px; }
.pf-card-value em { font-style: normal; font-size: 13px; color: var(--fade);
  font-family: "Instrument Sans", sans-serif; margin-inline-end: 3px; }
.pf-card-sub { font-size: 11.5px; color: var(--fade); margin-top: 3px; }

/* rows */
.pf-list { display: flex; flex-direction: column; gap: 7px; }
.pf-row { display: flex; align-items: center; gap: 12px; background: #fff;
  border: 1px solid var(--line); border-radius: 12px; padding: 13px 15px; flex-wrap: wrap; }
.pf-avatar { width: 34px; height: 34px; border-radius: 50%; color: #fff; display: grid;
  place-items: center; font-weight: 600; font-size: 14px; flex: none; }
.pf-row-main { flex: 1; min-width: 130px; }
.pf-row-title { font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.pf-row-sub { font-size: 12px; color: var(--fade); margin-top: 2px; }
.pf-clip { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 42ch; }
.pf-row-right { text-align: end; }
.pf-num { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
.pf-link { font-size: 11.5px; text-decoration: none; display: block; margin-top: 2px; }
.pf-amt { font-variant-numeric: tabular-nums; font-weight: 600; font-size: 14px; }
.pf-inv { font-family: ui-monospace, Menlo, monospace; font-size: 11.5px; color: var(--fade); }
.pf-key { font-family: ui-monospace, Menlo, monospace; font-size: 12px; background: #F4F2ED;
  padding: 4px 9px; border-radius: 5px; letter-spacing: .03em; }

.pf-tag { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; font-weight: 600;
  padding: 3px 8px; border-radius: 999px; background: #F0EEE9; color: var(--mut); }
.pf-tag.internal { background: #FBEAE7; color: #B3452F; }
.pf-tag.public   { background: #E8F3EE; color: #1E6F5C; }
.pf-tag.pri      { background: #EEF1F6; color: #3B5A7A; }
.pf-tag.queued   { background: #FFF3D6; color: #8A6A1F; }
.pf-tag.published{ background: #E8F3EE; color: #1E6F5C; }
.pf-tag.paid     { background: #E8F3EE; color: #1E6F5C; }
.pf-tag.role     { background: #EEF1F6; color: #3B5A7A; }

/* panels + forms */
.pf-panel { background: #fff; border: 1px solid var(--line); border-radius: 14px;
  padding: 18px; margin-bottom: 14px; }
.pf-panel label { display: block; font-size: 12.5px; font-weight: 500; margin-bottom: 14px; }
.pf-panel input, .pf-panel textarea, .pf-panel select {
  width: 100%; margin-top: 7px; border: 1px solid var(--line); border-radius: 9px;
  padding: 10px 12px; font-size: 14px; font-family: inherit; color: var(--ink); background: #FDFCFA;
}
.pf-panel textarea { resize: vertical; line-height: 1.55; }
.pf-panel input:focus, .pf-panel textarea:focus, .pf-panel select:focus {
  outline: 2px solid var(--c); border-color: transparent; }
.pf-chips, .pf-picks { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 9px; }
.pf-chips button, .pf-picks button {
  background: #fff; border: 1px solid var(--line); border-radius: 999px; padding: 8px 14px;
  font-size: 12.5px; cursor: pointer; font-family: inherit; color: var(--mut); }
.pf-chips button.on, .pf-picks button.on { color: #fff; font-weight: 500; }
.pf-hint { font-size: 12.5px; line-height: 1.55; border-radius: 9px; padding: 11px 13px; margin: 0 0 16px; }
.pf-hint.internal { background: #FBEAE7; color: #8A3524; }
.pf-hint.public   { background: #E8F3EE; color: #17594A; }
.pf-schedrow { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; margin-top: 12px; }
.pf-schedrow input, .pf-schedrow select { flex: 1; min-width: 130px; margin-top: 0; }
.pf-inline { display: flex !important; flex-direction: column; margin: 0 !important; flex: 1; }
.pf-btn { background: var(--c); color: #fff; border: 0; border-radius: 9px; padding: 11px 20px;
  font-size: 13.5px; font-weight: 600; cursor: pointer; font-family: inherit; white-space: nowrap; }
.pf-btn:disabled { opacity: .4; cursor: default; }
.pf-btn.ghost { background: none; color: var(--mut); border: 1px solid var(--line); }
.pf-mini { background: none; border: 1px solid var(--line); border-radius: 7px; padding: 5px 11px;
  font-size: 11.5px; color: var(--fade); cursor: pointer; font-family: inherit; }
.pf-mini.on { font-weight: 600; }
.pf-roles { display: grid; gap: 6px; margin-top: 16px; }
.pf-roles div { display: flex; gap: 10px; font-size: 12px; }
.pf-roles b { min-width: 62px; text-transform: capitalize; }
.pf-roles span { color: var(--fade); }

/* channels */
.pf-channels { display: grid; grid-template-columns: repeat(auto-fit, minmax(212px, 1fr)); gap: 10px; }
.pf-chan { display: flex; align-items: center; gap: 11px; background: #fff;
  border: 1px solid var(--line); border-radius: 12px; padding: 13px; }
.pf-chan-g { width: 34px; height: 34px; border-radius: 9px; background: #F0EEE9; display: grid;
  place-items: center; font-size: 11.5px; font-weight: 700; color: var(--mut); flex: none; }
.pf-chan.connected .pf-chan-g { background: var(--c); color: #fff; }
.pf-chan-name { font-size: 13.5px; font-weight: 500; }
.pf-chan-st { font-size: 11px; color: var(--fade); }
.pf-chan-btn { margin-inline-start: auto; background: none; border: 1px solid; border-radius: 7px;
  padding: 6px 12px; font-size: 11.5px; cursor: pointer; font-family: inherit; font-weight: 500; }

/* settings bits */
.pf-linkbox { display: flex; gap: 8px; align-items: center; }
.pf-linkbox code { flex: 1; font-family: ui-monospace, Menlo, monospace; font-size: 12px;
  background: #F4F2ED; padding: 10px 12px; border-radius: 8px; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; color: var(--mut); }
.pf-linkbox button { color: #fff; border: 0; border-radius: 8px; padding: 10px 16px;
  font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
.pf-domain { display: flex; gap: 8px; }
.pf-domain input { flex: 1; margin-top: 0 !important; }
.pf-keyrow { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.pf-keyrow span { font-size: 12px; color: var(--fade); text-transform: uppercase; letter-spacing: .08em; font-weight: 600; }
.pf-brandrow { display: flex; align-items: center; gap: 13px; }
.pf-swatch { width: 42px; height: 42px; border-radius: 10px; }

.pf-priceedit { display: flex; align-items: baseline; gap: 7px; }
.pf-priceedit span { font-size: 11px; color: var(--fade); }
.pf-priceedit input { width: 82px; border: 0; border-bottom: 2px solid; background: transparent;
  padding: 3px 0; font-size: 15px; text-align: end; font-variant-numeric: tabular-nums;
  font-weight: 500; font-family: inherit; margin: 0 !important; }
.pf-swatches { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 9px; align-items: center; }
.pf-swatches button { width: 30px; height: 30px; border-radius: 50%; border: 2px solid transparent;
  cursor: pointer; transition: transform .14s ease; }
.pf-swatches button.on { border-color: var(--ink); transform: scale(1.12); }
.pf-swatches input[type=color] { width: 40px !important; height: 30px; padding: 2px !important;
  margin: 0 !important; cursor: pointer; }
.pf-day { display: flex; justify-content: space-between; align-items: center; gap: 14px;
  padding: 9px 0; border-bottom: 1px solid var(--line); }
.pf-toggle { display: flex !important; align-items: center; gap: 9px; margin: 0 !important;
  cursor: pointer; font-size: 13px; }
.pf-toggle input { width: 16px !important; height: 16px; accent-color: var(--c); margin: 0 !important; }
.pf-times { display: flex; align-items: center; gap: 7px; }
.pf-times input { width: 104px !important; margin: 0 !important; padding: 7px 9px !important;
  font-size: 13px !important; }
.pf-times em { font-style: normal; color: var(--fade); font-size: 11.5px; }
.pf-closed { font-size: 12.5px; color: var(--fade); }
.pf-plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.pf-plan { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 22px;
  position: relative; }
.pf-plan.cur { border-width: 2px; }
.pf-plan-badge { position: absolute; top: -10px; inset-inline-start: 20px; color: #fff;
  font-size: 10px; font-weight: 600; padding: 3px 10px; border-radius: 999px;
  text-transform: uppercase; letter-spacing: .05em; }
.pf-plan-name { font-size: 13px; color: var(--mut); font-weight: 600; }
.pf-plan-cost { font-family: "Fraunces", serif; font-weight: 560; font-size: 30px;
  letter-spacing: -0.02em; margin: 6px 0 14px; }
.pf-plan-cost em { font-style: normal; font-size: 12px; color: var(--fade);
  font-family: "Instrument Sans", sans-serif; margin-inline-end: 3px; }
.pf-plan-cost i { font-style: normal; font-size: 12px; color: var(--fade);
  font-family: "Instrument Sans", sans-serif; }
.pf-plan ul { list-style: none; padding: 0; margin: 0; }
.pf-plan li { font-size: 12.5px; color: var(--mut); padding: 5px 0 5px 18px; position: relative; }
.pf-plan li::before { content: "✓"; position: absolute; inset-inline-start: 0;
  color: #1E6F5C; font-weight: 700; font-size: 11px; }
.pf-auto { background: #fff; border: 1px solid var(--line); border-radius: 14px;
  padding: 16px 18px; margin-bottom: 9px; transition: border-color .2s ease; }
.pf-auto.on { border-width: 1.5px; }
.pf-auto-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; }
.pf-auto-body { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); }
.pf-auto-body textarea { width: 100%; border: 1px solid var(--line); border-radius: 9px;
  padding: 9px 12px; font-size: 13.5px; font-family: inherit; background: #FDFCFA;
  resize: vertical; line-height: 1.5; }
.pf-auto-timing { display: flex; align-items: center; gap: 9px; margin-bottom: 10px; }
.pf-auto-timing input { width: 68px; border: 1px solid var(--line); border-radius: 8px;
  padding: 7px 9px; font-size: 13.5px; font-family: inherit; text-align: center; }
.pf-auto-timing span { font-size: 12.5px; color: var(--fade); }
.pf-switch { position: relative; width: 42px; height: 24px; flex: none; cursor: pointer; }
.pf-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
.pf-switch span { position: absolute; inset: 0; background: #DDD9D2; border-radius: 999px;
  transition: background .2s ease; }
.pf-switch span::after { content: ""; position: absolute; top: 3px; inset-inline-start: 3px;
  width: 18px; height: 18px; background: #fff; border-radius: 50%; transition: transform .2s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,.2); }
.pf-switch input:checked + span::after { transform: translateX(18px); }
[dir="rtl"] .pf-switch input:checked + span::after { transform: translateX(-18px); }
.pf-chart { display: flex; gap: 3px; align-items: flex-end; height: 130px;
  background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 14px; }
.pf-chart.hours { height: 100px; }
.pf-bar { flex: 1; height: 100%; display: flex; flex-direction: column;
  justify-content: flex-end; position: relative; min-width: 4px; }
.pf-bar-stack { position: relative; height: 100%; display: flex; align-items: flex-end; }
.pf-bar-fill { width: 100%; border-radius: 2px 2px 0 0; transition: height .4s ease; }
.pf-bar-fill.on { position: absolute; bottom: 0; inset-inline-start: 0; }
.pf-bar-label { position: absolute; bottom: -16px; inset-inline-start: 0;
  font-size: 9px; color: var(--fade); }
.pf-legend { display: flex; gap: 16px; margin-top: 10px; }
.pf-legend span { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--fade); }
.pf-legend i { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
.pf-domrow { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start;
  padding-bottom: 12px; }
.pf-dns { font-size: 12px; color: var(--mut); margin-top: 10px; line-height: 1.55; }
.pf-dnsrow { display: grid; grid-template-columns: auto 1fr; gap: 5px 10px; margin-top: 8px;
  align-items: center; }
.pf-dnsrow span { font-size: 10px; text-transform: uppercase; letter-spacing: .08em;
  color: var(--fade); font-weight: 600; }
.pf-dnsrow code { font-family: ui-monospace, Menlo, monospace; font-size: 12px;
  background: #F4F2ED; padding: 5px 9px; border-radius: 5px; }
.pf-conn { background: #fff; border: 1px solid var(--line); border-radius: 12px;
  padding: 14px 16px; margin-bottom: 7px; }
.pf-conn-head { display: flex; align-items: flex-start; gap: 10px; }
.pf-conn-body { margin-top: 13px; padding-top: 13px; border-top: 1px solid var(--line); }
.pf-conn-body input { margin-top: 0 !important; border: 1px solid var(--line);
  border-radius: 9px; padding: 10px 12px; font-size: 14px; font-family: inherit;
  background: #FDFCFA; flex: 1; }
.pf-code { background: #12100E; color: #E8E6E0; border-radius: 10px; padding: 14px 16px;
  font-family: ui-monospace, Menlo, monospace; font-size: 12px; overflow-x: auto;
  margin: 0 0 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; }
.pf-drop { border: 2px dashed var(--line); border-radius: 14px; padding: 26px;
  cursor: pointer; background: #fff; transition: border-color .18s ease, background .18s ease; }
.pf-drop:hover { border-color: var(--c); background: color-mix(in oklab, var(--c) 3%, #fff); }
.pf-drop-in { display: flex; align-items: center; gap: 14px; }
.pf-drop-icon { width: 40px; height: 40px; border-radius: 11px; color: #fff;
  display: grid; place-items: center; font-size: 18px; flex: none; }
.pf-upstat { margin-top: 10px; font-size: 13px; padding: 11px 14px; border-radius: 10px;
  background: #F4F2ED; color: var(--mut); }
.pf-upstat.done { background: #E8F3EE; color: #17594A; }
.pf-upstat.failed { background: #FBEAE7; color: #8A3524; }
.pf-doc { width: 38px; height: 38px; border-radius: 8px; border: 1.5px solid;
  display: grid; place-items: center; font-size: 9.5px; font-weight: 700;
  letter-spacing: .04em; flex: none; }
.pf-budget { background: #fff; border: 1px solid var(--line); border-radius: 12px;
  padding: 15px 17px; margin: 16px 0; }
.pf-budget.heavy { border-color: #E8CFC9; background: #FDF6F4; }
.pf-budget-top { display: flex; justify-content: space-between; gap: 12px;
  font-size: 12.5px; color: var(--mut); flex-wrap: wrap; }
.pf-budget-bar { height: 5px; background: #EFEDE8; border-radius: 999px;
  overflow: hidden; margin: 10px 0 9px; }
.pf-budget-bar div { height: 100%; border-radius: 999px; transition: width .4s ease; }
.pf-budget p { font-size: 12.5px; color: var(--mut); margin: 0; line-height: 1.55; }
.pf-mono { font-family: ui-monospace, Menlo, monospace; }
.pf-toast { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%);
  background: #fff; border: 1px solid var(--line); border-inline-start: 3px solid;
  border-radius: 10px; padding: 13px 18px; font-size: 13px; z-index: 80;
  box-shadow: 0 10px 40px rgba(18,16,14,.15); max-width: min(92vw, 460px);
  font-family: "Instrument Sans", system-ui, sans-serif; }

button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--c); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;
