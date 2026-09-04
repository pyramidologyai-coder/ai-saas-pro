"use client";

/**
 * The master portal. Automology's own view, not a business workspace.
 *
 * Two audiences, two tabs. The platform view is for you: what's live, what's
 * broken, which customers are quietly dying. The shareholder view is for
 * people who want the shape of the business and should never see a customer's
 * name or a conversation.
 *
 * The health column is the one that earns its place. A business that stopped
 * getting conversations has effectively churned while the subscription still
 * bills — knowing that two weeks early is the difference between a call and a
 * cancellation email.
 */

import { useEffect, useState } from "react";

type Health = {
  state: string; trend: string; days_since_last: number | null;
  conversations_7d: number; conversations_prev_7d: number;
  bookings_30d: number; wallet: number; action: string;
};
type Biz = {
  name: string; slug: string; vertical: string; plan: string; color: string;
  wallet: number; email: string | null; domain: string | null;
  organisation: string | null; agent: string | null; agents: number;
  conversations: number; bookings: number; ai_cost: number;
  their_revenue: number; sub_status: string | null; sub_amount: number | null;
  trial_ends: string | null; created_at: string; health: Health;
};
type Master = {
  ok: boolean;
  businesses?: { total: number; trial: number; paying: number; new_7d: number; new_30d: number };
  revenue?: { mrr: number; currency: string; active: number; trialing: number;
              past_due: number; cancelled: number };
  cost?: { ai_30d: number; ai_total: number; messages_30d: number };
  usage?: { conversations_total: number; conversations_7d: number;
            bookings_total: number; bookings_7d: number; agents: number; customers: number };
  attention?: { low_wallet: number; past_due: number; open_escalations: number;
                failed_emails: number; stuck_outbox: number; trials_ending: number };
  signups?: { week: string; n: number }[];
  by_sector?: { sector: string; n: number }[];
  list?: Biz[];
  health?: Record<string, unknown>;
};
type Share = {
  ok: boolean;
  revenue?: { mrr: number; arr: number; currency: string;
              paying_customers: number; average_per_customer: number };
  cost?: { ai_30d_usd: number; gross_margin_pct: number | null; note: string };
  customers?: { total: number; paying: number; active_30d: number;
                new_30d: number; churned_30d: number; activation_pct: number };
  growth?: { month: string; signups: number }[];
  caveats?: string[];
};

const STATE: Record<string, { label: string; tone: string }> = {
  active:     { label: "Active",     tone: "good" },
  quiet:      { label: "Quiet",      tone: "warn" },
  dormant:    { label: "Dormant",    tone: "bad" },
  never_used: { label: "Never used", tone: "bad" },
};

export default function MasterPortal() {
  const [tab, setTab] = useState<"platform" | "shareholder">("platform");
  const [d, setD] = useState<Master | null>(null);
  const [s, setS] = useState<Share | null>(null);
  const [sort, setSort] = useState<"new" | "busy" | "risk">("new");

  useEffect(() => {
    fetch("/api/master").then(r => r.json()).then(setD).catch(() => setD({ ok: false }));
  }, []);
  useEffect(() => {
    if (tab === "shareholder" && !s) {
      fetch("/api/master?view=shareholder").then(r => r.json()).then(setS).catch(() => {});
    }
  }, [tab, s]);

  if (!d) return <Shell><div className="ms-quiet">Loading</div></Shell>;
  if (!d.ok) return <Shell><div className="ms-quiet">
    Platform view needs the master password.
  </div></Shell>;

  const b = d.businesses!, r = d.revenue!, c = d.cost!, u = d.usage!, a = d.attention!;
  const alerts = a.low_wallet + a.past_due + a.stuck_outbox + a.failed_emails;

  const list = [...(d.list ?? [])].sort((x, y) =>
    sort === "busy" ? y.conversations - x.conversations :
    sort === "risk" ? rank(y.health.state) - rank(x.health.state) :
    new Date(y.created_at).getTime() - new Date(x.created_at).getTime());

  const maxWeek = Math.max(1, ...(d.signups ?? []).map(x => x.n));

  return (
    <Shell>
      <header className="ms-head">
        <div>
          <div className="ms-logo">Automology</div>
          <p>Platform control</p>
        </div>
        <div className="ms-tabs">
          <button className={tab === "platform" ? "on" : ""} onClick={() => setTab("platform")}>
            Platform
          </button>
          <button className={tab === "shareholder" ? "on" : ""} onClick={() => setTab("shareholder")}>
            Shareholders
          </button>
          <button className="ms-out" onClick={async () => {
            await fetch("/api/login", { method: "DELETE" });
            window.location.href = "/login";
          }}>Sign out</button>
        </div>
      </header>

      {tab === "platform" && (
        <>
          {alerts > 0 && (
            <div className="ms-alert">
              <b>{alerts} thing{alerts === 1 ? "" : "s"} need you.</b>
              {a.past_due > 0 && <span>{a.past_due} payment{a.past_due === 1 ? "" : "s"} failed</span>}
              {a.low_wallet > 0 && <span>{a.low_wallet} out of credit</span>}
              {a.stuck_outbox > 0 && <span>{a.stuck_outbox} messages stuck — is the cron running?</span>}
              {a.failed_emails > 0 && <span>{a.failed_emails} emails failed this week</span>}
              {a.trials_ending > 0 && <span>{a.trials_ending} trial{a.trials_ending === 1 ? "" : "s"} ending in 3 days</span>}
            </div>
          )}

          <section className="ms-figs">
            <Fig big label="MRR" value={`RM ${Number(r.mrr).toFixed(0)}`}
                 sub={`${r.active} paying · ${r.trialing} on trial`} />
            <Fig label="Businesses" value={String(b.total)}
                 sub={`+${b.new_30d} this month`} />
            <Fig label="Conversations" value={String(u.conversations_total)}
                 sub={`${u.conversations_7d} this week`} />
            <Fig label="Bookings" value={String(u.bookings_total)}
                 sub={`${u.bookings_7d} this week`} />
            <Fig label="AI cost, 30d" value={`$${Number(c.ai_30d).toFixed(2)}`}
                 sub={`${u.conversations_total > 0
                   ? "$" + (Number(c.ai_total) / u.conversations_total).toFixed(4) + " per chat"
                   : "—"}`} />
          </section>

          {(d.signups ?? []).length > 0 && (
            <>
              <h2 className="ms-h2">Signups, twelve weeks</h2>
              <div className="ms-chart">
                {(d.signups ?? []).map(w => (
                  <div key={w.week} className="ms-bar" title={`${w.week}: ${w.n}`}>
                    <div style={{ height: `${(w.n / maxWeek) * 100}%` }} />
                    <span>{w.n || ""}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="ms-listhead">
            <h2 className="ms-h2">Businesses</h2>
            <div className="ms-sort">
              {([["new", "Newest"], ["busy", "Busiest"], ["risk", "At risk"]] as const)
                .map(([k, l]) => (
                  <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>
                    {l}
                  </button>
                ))}
            </div>
          </div>

          <div className="ms-list">
            {list.map(x => {
              const st = STATE[x.health.state] ?? { label: x.health.state, tone: "warn" };
              return (
                <div key={x.slug} className="ms-row">
                  <span className="ms-dot" style={{ background: x.color }} />
                  <div className="ms-main">
                    <div className="ms-name">
                      {x.name}
                      <span className={`ms-tag ${st.tone}`}>{st.label}</span>
                      {x.plan !== "trial" && <span className="ms-tag pay">{x.plan}</span>}
                      {x.organisation && <span className="ms-tag org">{x.organisation}</span>}
                    </div>
                    <div className="ms-sub">
                      {x.vertical} · {x.agent ?? "no agent"}
                      {x.agents > 1 ? ` +${x.agents - 1}` : ""}
                      {x.domain ? ` · ${x.domain}` : ""}
                    </div>
                    {st.tone !== "good" && <div className="ms-action">{x.health.action}</div>}
                  </div>
                  <div className="ms-nums">
                    <div><b>{x.conversations}</b><span>chats</span></div>
                    <div><b>{x.bookings}</b><span>bookings</span></div>
                    <div><b>${Number(x.ai_cost).toFixed(3)}</b><span>cost</span></div>
                  </div>
                  <div className="ms-links">
                    <a href={`/dashboard/${x.slug}`}>dashboard</a>
                    <a href={`/demo/${x.slug}`} target="_blank" rel="noreferrer">page ↗</a>
                  </div>
                </div>
              );
            })}
            {list.length === 0 && <div className="ms-empty">No businesses yet.</div>}
          </div>
        </>
      )}

      {tab === "shareholder" && (
        !s ? <div className="ms-quiet">Loading</div> : <Shareholder s={s} />
      )}
    </Shell>
  );
}

function Shareholder({ s }: { s: Share }) {
  const r = s.revenue!, c = s.cost!, cu = s.customers!;
  const max = Math.max(1, ...(s.growth ?? []).map(g => g.signups));
  return (
    <>
      <div className="ms-share-head">
        <h1>Where the business stands</h1>
        <p>Growth, revenue and retention. No customer names, no conversations.</p>
      </div>

      <section className="ms-figs">
        <Fig big label="ARR" value={`RM ${Number(r.arr).toFixed(0)}`}
             sub={`RM ${Number(r.mrr).toFixed(0)} monthly`} />
        <Fig label="Paying customers" value={String(r.paying_customers)}
             sub={`RM ${Number(r.average_per_customer).toFixed(0)} each`} />
        <Fig label="Gross margin" value={c.gross_margin_pct != null
              ? `${c.gross_margin_pct}%` : "—"}
             sub={`$${c.ai_30d_usd} AI cost, 30d`} />
        <Fig label="Activation" value={`${cu.activation_pct}%`}
             sub={`${cu.active_30d} of ${cu.total} used it this month`} />
        <Fig label="Net new, 30d" value={`${cu.new_30d - cu.churned_30d >= 0 ? "+" : ""}${cu.new_30d - cu.churned_30d}`}
             sub={`${cu.new_30d} joined · ${cu.churned_30d} left`} />
      </section>

      {(s.growth ?? []).length > 0 && (
        <>
          <h2 className="ms-h2">Signups by month</h2>
          <div className="ms-chart tall">
            {(s.growth ?? []).map(g => (
              <div key={g.month} className="ms-bar" title={`${g.month}: ${g.signups}`}>
                <div style={{ height: `${(g.signups / max) * 100}%` }} />
                <span>{g.signups || ""}</span>
                <em>{g.month.split(" ")[0]}</em>
              </div>
            ))}
          </div>
        </>
      )}

      {s.caveats && (
        <div className="ms-caveats">
          <b>What these numbers do and don&apos;t include</b>
          <ul>{s.caveats.map(x => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
    </>
  );
}

function Fig({ label, value, sub, big }:
  { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <div className={`ms-fig ${big ? "big" : ""}`}>
      <div className="ms-fig-l">{label}</div>
      <div className="ms-fig-v">{value}</div>
      {sub && <div className="ms-fig-s">{sub}</div>}
    </div>
  );
}

function rank(state: string) {
  return { never_used: 4, dormant: 3, quiet: 2, active: 1 }[state] ?? 0;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ms">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560;9..144,700&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div className="ms-wrap">{children}</div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
*{box-sizing:border-box}
html,body{margin:0}
.ms{--ink:#0E0D0C;--mut:#6B6862;--fade:#9C9891;--line:#26241F;--sig:#4ADE9B;
  min-height:100vh;background:#12100E;color:#F2F0EC;
  font-family:"Instrument Sans",system-ui,sans-serif}
.ms-wrap{max-width:1180px;margin:0 auto;padding:clamp(22px,4vw,44px) clamp(16px,4vw,36px) 90px}
.ms-quiet{padding:110px 0;text-align:center;color:var(--fade)}

.ms-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;
  flex-wrap:wrap;margin-bottom:30px}
.ms-logo{font-family:"Fraunces",serif;font-weight:700;font-size:23px;letter-spacing:-0.02em}
.ms-head p{font-size:12.5px;color:var(--fade);margin:4px 0 0}
.ms-tabs{display:flex;gap:6px;flex-wrap:wrap}
.ms-tabs button{background:none;border:1px solid var(--line);color:var(--fade);
  border-radius:999px;padding:8px 16px;font-size:13px;cursor:pointer;font-family:inherit}
.ms-tabs button.on{background:#F2F0EC;color:#12100E;border-color:#F2F0EC;font-weight:600}
.ms-out{opacity:.6}

.ms-alert{background:#2A1614;border:1px solid #5A2A22;border-radius:12px;
  padding:14px 17px;margin-bottom:22px;display:flex;flex-wrap:wrap;gap:6px 16px;
  align-items:baseline;font-size:13px;color:#F2B8AC}
.ms-alert b{color:#FF9C86}
.ms-alert span{color:#D9A79C}

.ms-figs{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
  gap:1px;background:var(--line);border:1px solid var(--line);border-radius:14px;
  overflow:hidden;margin-bottom:30px}
.ms-fig{background:#16140F;padding:18px}
.ms-fig.big{background:#1A1813}
.ms-fig-l{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--fade);
  font-weight:600}
.ms-fig-v{font-family:"Fraunces",serif;font-weight:560;font-size:27px;
  letter-spacing:-0.02em;margin-top:6px}
.ms-fig.big .ms-fig-v{font-size:33px;color:var(--sig)}
.ms-fig-s{font-size:11.5px;color:var(--fade);margin-top:4px}

.ms-h2{font-size:11px;text-transform:uppercase;letter-spacing:.13em;color:var(--fade);
  font-weight:600;margin:0 0 14px}
.ms-chart{display:flex;gap:4px;align-items:flex-end;height:110px;
  background:#16140F;border:1px solid var(--line);border-radius:12px;padding:14px;
  margin-bottom:28px}
.ms-chart.tall{height:140px}
.ms-bar{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;
  align-items:center;gap:4px;position:relative}
.ms-bar>div{width:100%;background:var(--sig);border-radius:3px 3px 0 0;
  min-height:2px;transition:height .4s ease;opacity:.85}
.ms-bar>span{font-size:10px;color:var(--fade);font-variant-numeric:tabular-nums}
.ms-bar>em{font-size:9px;color:var(--fade);font-style:normal;position:absolute;bottom:-16px}

.ms-listhead{display:flex;justify-content:space-between;align-items:center;
  gap:14px;flex-wrap:wrap;margin-bottom:12px}
.ms-listhead .ms-h2{margin:0}
.ms-sort{display:flex;gap:5px}
.ms-sort button{background:none;border:1px solid var(--line);color:var(--fade);
  border-radius:999px;padding:5px 12px;font-size:11.5px;cursor:pointer;font-family:inherit}
.ms-sort button.on{background:#F2F0EC;color:#12100E;border-color:#F2F0EC}

.ms-list{display:flex;flex-direction:column;gap:6px}
.ms-row{display:flex;align-items:center;gap:13px;background:#16140F;
  border:1px solid var(--line);border-radius:12px;padding:14px 16px;flex-wrap:wrap}
.ms-dot{width:9px;height:9px;border-radius:50%;flex:none}
.ms-main{flex:1;min-width:180px}
.ms-name{font-size:14.5px;font-weight:600;display:flex;align-items:center;
  gap:7px;flex-wrap:wrap}
.ms-sub{font-size:11.5px;color:var(--fade);margin-top:3px}
.ms-action{font-size:11.5px;color:#E8B4A4;margin-top:5px}
.ms-tag{font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:700;
  padding:3px 8px;border-radius:999px}
.ms-tag.good{background:#14332A;color:var(--sig)}
.ms-tag.warn{background:#33290F;color:#E8C36A}
.ms-tag.bad{background:#331714;color:#FF9C86}
.ms-tag.pay{background:#1B2740;color:#8FB4F0}
.ms-tag.org{background:#241F33;color:#B9A8ED}
.ms-nums{display:flex;gap:18px}
.ms-nums b{display:block;font-size:14px;font-variant-numeric:tabular-nums}
.ms-nums span{font-size:9.5px;color:var(--fade);text-transform:uppercase;letter-spacing:.07em}
.ms-links{display:flex;flex-direction:column;gap:3px}
.ms-links a{font-size:11.5px;color:var(--sig);text-decoration:none}
.ms-links a:hover{text-decoration:underline}
.ms-empty{background:#16140F;border:1px solid var(--line);border-radius:12px;
  padding:40px;text-align:center;color:var(--fade);font-size:13.5px}

.ms-share-head{margin-bottom:26px}
.ms-share-head h1{font-family:"Fraunces",serif;font-weight:560;
  font-size:clamp(26px,4vw,38px);letter-spacing:-0.025em;margin:0}
.ms-share-head p{font-size:13.5px;color:var(--fade);margin:8px 0 0}
.ms-caveats{background:#16140F;border:1px solid var(--line);border-radius:12px;
  padding:16px 18px;margin-top:26px}
.ms-caveats b{font-size:11px;text-transform:uppercase;letter-spacing:.11em;
  color:var(--fade);font-weight:600}
.ms-caveats ul{margin:10px 0 0;padding-inline-start:18px}
.ms-caveats li{font-size:12.5px;color:var(--mut);line-height:1.65}

a:focus-visible,button:focus-visible{outline:2px solid var(--sig);outline-offset:3px}
@media(prefers-reduced-motion:reduce){.ms-bar>div{transition:none}}
`;
