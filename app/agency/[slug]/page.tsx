"use client";

/**
 * The agency dashboard.
 *
 * A reseller's job is different from a business owner's: they onboard, they
 * configure, they support, and they watch margin. They do not run anyone's
 * front desk. So this is a portfolio view, not a workspace — clients, health,
 * and what each one is worth.
 *
 * It wears the agency's own colour, because the whole proposition is that
 * their clients never learn Automology exists.
 */

import { useEffect, useState, useCallback } from "react";

type Health = { state: string; trend: string; action: string; days_since_last: number | null };
type Client = {
  name: string; slug: string; vertical: string; plan: string; color: string;
  created_at: string; access_code: string; agent: string | null;
  conversations: number; bookings: number; needs_you: number; health: Health;
};
type Data = {
  ok: boolean; role?: string;
  agency?: { name: string; slug: string; brand_name: string | null; color: string;
             logo_url: string | null; support_email: string | null; domain: string | null;
             plan: string; client_limit: number; wholesale_pct: number; access_code: string };
  clients?: Client[];
  totals?: { clients: number; slots_left: number; conversations: number;
             bookings: number; needs_you: number; ai_cost: number };
  billing?: { paying: number; trialing: number; list_price: number;
              wholesale_cost: number; margin: number; currency: string };
  staff?: { id: string; name: string; email: string | null; role: string;
            status: string; access_code: string }[];
};

const SECTORS = [
  ["clinic", "Clinic"], ["salon", "Salon"], ["restaurant", "Restaurant"],
  ["fitness", "Gym"], ["general", "Other"],
];

const STATE: Record<string, string> = {
  active: "good", quiet: "warn", dormant: "bad", never_used: "bad",
};

export default function Agency({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const [d, setD] = useState<Data | null>(null);
  const [tab, setTab] = useState<"clients" | "add" | "brand" | "team">("clients");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ t: string; bad?: boolean } | null>(null);

  const [nc, setNc] = useState({ name: "", sector: "clinic", email: "", phone: "" });
  const [brand, setBrand] = useState({ brand_name: "", color: "", support_email: "", logo_url: "" });
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState("agent");
  const [created, setCreated] = useState<{ slug: string; code: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/agency?agency=${encodeURIComponent(slug)}`);
      const j = await r.json();
      setD(j);
      if (j.agency) setBrand(b => ({
        brand_name: b.brand_name || j.agency.brand_name || "",
        color: b.color || j.agency.color || "",
        support_email: b.support_email || j.agency.support_email || "",
        logo_url: b.logo_url || j.agency.logo_url || "",
      }));
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
      const r = await fetch("/api/agency", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ agency: slug, ...body }),
      });
      const j = await r.json();
      if (j.ok) { setToast({ t: ok }); await load(); return j; }
      setToast({ t: j.hint ?? String(j.reason ?? "failed").replace(/_/g, " "), bad: true });
    } catch { setToast({ t: "Didn't save. Try again.", bad: true }); }
    finally { setBusy(false); }
    return null;
  }

  if (!d) return <Shell><p className="ag-quiet">Loading</p></Shell>;
  if (!d.ok || !d.agency) return <Shell><p className="ag-quiet">No agency found.</p></Shell>;

  const a = d.agency, t = d.totals!, bill = d.billing!;
  const C = a.color || "#1D6A8C";
  const role = d.role ?? "viewer";
  const canAdd = ["principal", "manager", "agent"].includes(role);
  const canBrand = ["principal", "manager"].includes(role);
  const canStaff = role === "principal";

  return (
    <Shell color={C}>
      <header className="ag-head">
        <div className="ag-brand">
          {a.logo_url
            ? <img src={a.logo_url} alt="" className="ag-logo" />
            : <span className="ag-mark" style={{ background: C }}>
                {(a.brand_name ?? a.name).charAt(0)}
              </span>}
          <div>
            <h1>{a.brand_name ?? a.name}</h1>
            <p>
              {t.clients} of {a.client_limit} clients · signed in as {role}
            </p>
          </div>
        </div>
        <button className="ag-out" onClick={async () => {
          await fetch("/api/login", { method: "DELETE" });
          window.location.href = "/login";
        }}>Sign out</button>
      </header>

      <section className="ag-figs">
        <Fig label="Clients" value={String(t.clients)} sub={`${t.slots_left} slots left`} />
        <Fig label="Your margin" value={`RM ${Number(bill.margin).toFixed(0)}`}
             sub={`of RM ${Number(bill.list_price).toFixed(0)} billed`} accent={C} />
        <Fig label="Conversations" value={String(t.conversations)} />
        <Fig label="Bookings" value={String(t.bookings)} />
        <Fig label="Need attention" value={String(t.needs_you)} alert={t.needs_you > 0} />
      </section>

      <nav className="ag-tabs">
        {([["clients", "Clients"], ["add", "Add a client"],
           ["brand", "Your brand"], ["team", "Your team"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={tab === k ? "on" : ""}
            style={tab === k ? { background: C, borderColor: C } : undefined}>{l}</button>
        ))}
      </nav>

      {tab === "clients" && (
        <div className="ag-list">
          {(d.clients ?? []).length === 0 && (
            <div className="ag-empty">
              No clients yet. Add your first from the tab above — it takes about a minute.
            </div>
          )}
          {(d.clients ?? []).map(c => (
            <div key={c.slug} className="ag-row">
              <span className="ag-dot" style={{ background: c.color }} />
              <div className="ag-main">
                <div className="ag-name">
                  {c.name}
                  <span className={`ag-tag ${STATE[c.health.state] ?? "warn"}`}>
                    {c.health.state.replace("_", " ")}
                  </span>
                  {c.needs_you > 0 && <span className="ag-tag bad">{c.needs_you} waiting</span>}
                </div>
                <div className="ag-sub">
                  {c.vertical} · {c.agent ?? "no agent"} · key <code>{c.access_code}</code>
                </div>
                {c.health.state !== "active" && (
                  <div className="ag-action">{c.health.action}</div>
                )}
              </div>
              <div className="ag-nums">
                <div><b>{c.conversations}</b><span>chats</span></div>
                <div><b>{c.bookings}</b><span>booked</span></div>
              </div>
              <div className="ag-links">
                <a href={`/dashboard/${c.slug}`}>manage</a>
                <a href={`/demo/${c.slug}`} target="_blank" rel="noreferrer">page ↗</a>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "add" && (
        <div className="ag-panel">
          {!canAdd ? (
            <p className="ag-note">Your role can view clients but not add them.</p>
          ) : created ? (
            <>
              <div className="ag-tick" style={{ background: C }}>✓</div>
              <h2>{created.slug} is live</h2>
              <p className="ag-lede">
                Their page is answering already. Send them the link and their key.
              </p>
              <div className="ag-keys">
                <div><span>Their page</span><code>/demo/{created.slug}</code></div>
                <div><span>Their key</span><code>{created.code}</code></div>
              </div>
              <div className="ag-acts">
                <a className="ag-btn" style={{ background: C }}
                   href={`/demo/${created.slug}`} target="_blank" rel="noreferrer">
                  Open their page
                </a>
                <button className="ag-btn ghost" onClick={() => {
                  setCreated(null); setNc({ name: "", sector: "clinic", email: "", phone: "" });
                }}>Add another</button>
              </div>
            </>
          ) : (
            <>
              <h2>Add a client</h2>
              <p className="ag-lede">
                They get a working AI receptionist under your brand. You can
                refine their services and hours afterwards.
              </p>
              <label>Business name
                <input value={nc.name} onChange={e => setNc(x => ({ ...x, name: e.target.value }))}
                       placeholder="Kedai Gunting Ali" />
              </label>
              <label>What kind of business
                <div className="ag-chips">
                  {SECTORS.map(([k, l]) => (
                    <button key={k} onClick={() => setNc(x => ({ ...x, sector: k }))}
                      className={nc.sector === k ? "on" : ""}
                      style={nc.sector === k ? { background: C, borderColor: C } : undefined}>
                      {l}
                    </button>
                  ))}
                </div>
              </label>
              <div className="ag-two">
                <label>Their email <span>optional</span>
                  <input value={nc.email} onChange={e => setNc(x => ({ ...x, email: e.target.value }))} />
                </label>
                <label>Their phone <span>optional</span>
                  <input value={nc.phone} onChange={e => setNc(x => ({ ...x, phone: e.target.value }))} />
                </label>
              </div>
              <button className="ag-btn" style={{ background: C }}
                disabled={busy || nc.name.trim().length < 2}
                onClick={async () => {
                  const r = await act({ action: "add_client", payload: nc }, "Client added.");
                  if (r?.ok) setCreated({ slug: r.slug, code: r.access_code });
                }}>
                {busy ? "Setting up…" : "Create their receptionist"}
              </button>
            </>
          )}
        </div>
      )}

      {tab === "brand" && (
        <div className="ag-panel">
          <h2>Your brand</h2>
          <p className="ag-lede">
            This is what your clients see. Nothing on their page mentions
            Automology.
          </p>
          {!canBrand && <p className="ag-note">Your role can view this but not change it.</p>}
          <label>Name your clients see
            <input value={brand.brand_name} disabled={!canBrand}
                   onChange={e => setBrand(x => ({ ...x, brand_name: e.target.value }))} />
          </label>
          <label>Your colour
            <div className="ag-colorrow">
              <input type="color" value={brand.color || C} disabled={!canBrand}
                     onChange={e => setBrand(x => ({ ...x, color: e.target.value }))} />
              <input value={brand.color} disabled={!canBrand} placeholder="#1D6A8C"
                     onChange={e => setBrand(x => ({ ...x, color: e.target.value }))} />
            </div>
          </label>
          <label>Support email
            <input value={brand.support_email} disabled={!canBrand}
                   onChange={e => setBrand(x => ({ ...x, support_email: e.target.value }))}
                   placeholder="help@youragency.com" />
          </label>
          <label>Logo URL <span>optional</span>
            <input value={brand.logo_url} disabled={!canBrand}
                   onChange={e => setBrand(x => ({ ...x, logo_url: e.target.value }))} />
          </label>
          {canBrand && (
            <button className="ag-btn" style={{ background: C }} disabled={busy}
              onClick={() => act({ action: "branding", payload: brand }, "Brand saved.")}>
              Save
            </button>
          )}

          <div className="ag-commercial">
            <h3>Your commercials</h3>
            <div className="ag-rows">
              <div><span>You pay</span><b>{bill.wholesale_cost} MYR/mo</b></div>
              <div><span>You bill</span><b>{bill.list_price} MYR/mo</b></div>
              <div><span>You keep</span><b style={{ color: C }}>{bill.margin} MYR/mo</b></div>
              <div><span>Wholesale rate</span><b>{a.wholesale_pct}%</b></div>
            </div>
          </div>
        </div>
      )}

      {tab === "team" && (
        <div className="ag-panel">
          <h2>Your team</h2>
          <p className="ag-lede">Each person gets their own key.</p>
          {canStaff && (
            <div className="ag-addrow">
              <input value={staffName} onChange={e => setStaffName(e.target.value)}
                     placeholder="Their name" />
              <select value={staffRole} onChange={e => setStaffRole(e.target.value)}>
                <option value="manager">manager</option>
                <option value="agent">agent</option>
                <option value="viewer">viewer</option>
              </select>
              <button className="ag-btn" style={{ background: C }}
                disabled={busy || !staffName.trim()}
                onClick={async () => {
                  const r = await act({ action: "add_staff",
                    payload: { name: staffName, role: staffRole } }, "Added.");
                  if (r?.ok) setStaffName("");
                }}>Add</button>
            </div>
          )}
          <div className="ag-list">
            {(d.staff ?? []).map(s => (
              <div key={s.id} className="ag-row">
                <span className="ag-mark sm" style={{ background: C }}>{s.name.charAt(0)}</span>
                <div className="ag-main">
                  <div className="ag-name">{s.name}</div>
                  <div className="ag-sub">{s.email ?? "no email"}</div>
                </div>
                <code className="ag-key">{s.access_code}</code>
                <span className="ag-tag role">{s.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="ag-toast" style={{ borderInlineStartColor: toast.bad ? "#B3452F" : C }}>
          {toast.t}
        </div>
      )}
    </Shell>
  );
}

function Fig({ label, value, sub, alert, accent }:
  { label: string; value: string; sub?: string; alert?: boolean; accent?: string }) {
  return (
    <div className="ag-fig">
      <div className="ag-fig-l">{label}</div>
      <div className="ag-fig-v" style={{ color: alert ? "#B3452F" : accent ?? undefined }}>
        {value}
      </div>
      {sub && <div className="ag-fig-s">{sub}</div>}
    </div>
  );
}

function Shell({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="ag" style={{ "--c": color ?? "#1D6A8C" } as React.CSSProperties}>
      <div className="ag-wrap">{children}</div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
*{box-sizing:border-box}
html,body{margin:0}
.ag{--ink:#12100E;--mut:#66625B;--fade:#A5A099;--line:#E7E3DC;
  min-height:100vh;background:#F4F2ED;color:var(--ink);
  font-family:"Instrument Sans",system-ui,sans-serif}
.ag-wrap{max-width:1080px;margin:0 auto;padding:clamp(22px,4vw,44px) clamp(16px,4vw,32px) 90px}
.ag-quiet{padding:100px 0;text-align:center;color:var(--fade)}

.ag-head{display:flex;justify-content:space-between;align-items:flex-start;
  gap:16px;flex-wrap:wrap;margin-bottom:26px}
.ag-brand{display:flex;align-items:center;gap:13px}
.ag-logo{width:46px;height:46px;border-radius:11px;object-fit:cover}
.ag-mark{width:46px;height:46px;border-radius:11px;color:#fff;display:grid;
  place-items:center;font-family:"Fraunces",serif;font-size:20px;font-weight:560}
.ag-mark.sm{width:34px;height:34px;font-size:15px;border-radius:50%}
.ag-head h1{font-family:"Fraunces",serif;font-weight:560;
  font-size:clamp(23px,4vw,32px);letter-spacing:-0.025em;margin:0}
.ag-head p{font-size:12.5px;color:var(--fade);margin:4px 0 0}
.ag-out{background:none;border:1px solid var(--line);border-radius:8px;
  padding:9px 14px;font-size:12.5px;color:var(--mut);cursor:pointer;font-family:inherit}

.ag-figs{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
  gap:1px;background:var(--line);border:1px solid var(--line);border-radius:14px;
  overflow:hidden;margin-bottom:22px}
.ag-fig{background:#FBFAF7;padding:17px}
.ag-fig-l{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;
  color:var(--fade);font-weight:600}
.ag-fig-v{font-family:"Fraunces",serif;font-weight:560;font-size:25px;
  letter-spacing:-0.02em;margin-top:5px}
.ag-fig-s{font-size:11.5px;color:var(--fade);margin-top:3px}

.ag-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px}
.ag-tabs button{background:#fff;border:1px solid var(--line);color:var(--mut);
  border-radius:999px;padding:9px 17px;font-size:13px;cursor:pointer;font-family:inherit}
.ag-tabs button.on{color:#fff;font-weight:600}

.ag-list{display:flex;flex-direction:column;gap:7px}
.ag-row{display:flex;align-items:center;gap:13px;background:#fff;
  border:1px solid var(--line);border-radius:12px;padding:14px 16px;flex-wrap:wrap}
.ag-dot{width:9px;height:9px;border-radius:50%;flex:none}
.ag-main{flex:1;min-width:170px}
.ag-name{font-size:14.5px;font-weight:600;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.ag-sub{font-size:11.5px;color:var(--fade);margin-top:3px}
.ag-sub code{font-family:ui-monospace,Menlo,monospace;background:#F4F2ED;
  padding:2px 6px;border-radius:4px}
.ag-action{font-size:11.5px;color:#8A5A2A;margin-top:5px}
.ag-tag{font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:700;
  padding:3px 8px;border-radius:999px}
.ag-tag.good{background:#E8F3EE;color:#1E6F5C}
.ag-tag.warn{background:#FFF3D6;color:#8A6A1F}
.ag-tag.bad{background:#FBEAE7;color:#B3452F}
.ag-tag.role{background:#EEF1F6;color:#3B5A7A}
.ag-nums{display:flex;gap:16px}
.ag-nums b{display:block;font-size:14px;font-variant-numeric:tabular-nums}
.ag-nums span{font-size:9.5px;color:var(--fade);text-transform:uppercase;letter-spacing:.07em}
.ag-links{display:flex;flex-direction:column;gap:3px}
.ag-links a{font-size:11.5px;color:var(--c);text-decoration:none}
.ag-links a:hover{text-decoration:underline}
.ag-key{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;background:#F4F2ED;
  padding:4px 9px;border-radius:5px}
.ag-empty{background:#fff;border:1px solid var(--line);border-radius:12px;
  padding:40px;text-align:center;color:var(--fade);font-size:13.5px}

.ag-panel{background:#fff;border:1px solid var(--line);border-radius:16px;
  padding:clamp(20px,4vw,28px)}
.ag-panel h2{font-family:"Fraunces",serif;font-weight:560;font-size:21px;
  letter-spacing:-0.02em;margin:0 0 8px}
.ag-panel h3{font-size:11px;text-transform:uppercase;letter-spacing:.12em;
  color:var(--fade);font-weight:600;margin:26px 0 12px}
.ag-lede{font-size:13.5px;color:var(--mut);line-height:1.6;margin:0 0 22px;max-width:54ch}
.ag-note{font-size:12.5px;color:var(--mut);background:#FFF9EC;border:1px solid #F0E4C8;
  border-radius:10px;padding:12px 14px;margin:0 0 18px}
.ag-panel label{display:block;font-size:12.5px;font-weight:500;margin-bottom:18px}
.ag-panel label span{color:var(--fade);font-weight:400;margin-inline-start:5px}
.ag-panel input,.ag-panel select{width:100%;margin-top:7px;border:1px solid var(--line);
  border-radius:10px;padding:11px 13px;font-size:14.5px;font-family:inherit;background:#FDFCFA}
.ag-panel input:focus,.ag-panel select:focus{outline:2px solid var(--c);border-color:transparent}
.ag-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:560px){.ag-two{grid-template-columns:1fr}}
.ag-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
.ag-chips button{background:#fff;border:1px solid var(--line);border-radius:999px;
  padding:8px 15px;font-size:12.5px;cursor:pointer;font-family:inherit;color:var(--mut)}
.ag-chips button.on{color:#fff;font-weight:500}
.ag-colorrow{display:flex;gap:9px;align-items:center;margin-top:7px}
.ag-colorrow input[type=color]{width:52px;flex:none;height:40px;padding:3px;margin:0}
.ag-colorrow input[type=text],.ag-colorrow input:not([type]){margin:0}
.ag-addrow{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap}
.ag-addrow input{flex:1;min-width:130px;margin:0}
.ag-addrow select{width:auto;margin:0}
.ag-btn{background:var(--c);color:#fff;border:0;border-radius:10px;padding:13px 24px;
  font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;
  text-decoration:none;display:inline-block;text-align:center}
.ag-btn:disabled{opacity:.4;cursor:default}
.ag-btn.ghost{background:none;color:var(--mut);border:1px solid var(--line)}
.ag-acts{display:flex;gap:9px;flex-wrap:wrap;margin-top:20px}
.ag-tick{width:52px;height:52px;border-radius:50%;color:#fff;display:grid;
  place-items:center;font-size:24px;margin-bottom:18px}
.ag-keys{background:#F4F2ED;border-radius:11px;padding:16px}
.ag-keys div{display:flex;justify-content:space-between;gap:12px;padding:7px 0;flex-wrap:wrap}
.ag-keys span{font-size:11px;text-transform:uppercase;letter-spacing:.09em;
  color:var(--fade);font-weight:600}
.ag-keys code{font-family:ui-monospace,Menlo,monospace;font-size:13px;font-weight:600}
.ag-commercial{border-top:1px solid var(--line);margin-top:8px}
.ag-rows div{display:flex;justify-content:space-between;padding:9px 0;
  border-bottom:1px solid #F2F0EB;font-size:13.5px}
.ag-rows span{color:var(--mut)}
.ag-rows b{font-variant-numeric:tabular-nums}

.ag-toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);
  background:#fff;border:1px solid var(--line);border-inline-start:3px solid;
  border-radius:10px;padding:13px 18px;font-size:13px;z-index:80;
  box-shadow:0 10px 40px rgba(18,16,14,.15);max-width:min(92vw,460px)}

button:focus-visible,a:focus-visible,input:focus-visible{
  outline:2px solid var(--c);outline-offset:2px}
`;
