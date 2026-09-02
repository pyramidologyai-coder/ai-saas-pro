"use client";

/**
 * The group view. A chain owner opens this and sees every branch at once:
 * who's busy, who needs attention, who's making money.
 *
 * Branches are separate businesses that share an owner. Each keeps its own
 * hours, diary, staff and page — clicking through opens that branch's full
 * dashboard.
 */

import { useEffect, useState } from "react";

type Branch = {
  name: string; slug: string; label: string; color: string;
  address: string | null; phone: string | null; agent: string | null;
  conversations: number; bookings: number; needs_you: number; revenue: number;
};
type Data = {
  ok: boolean;
  organisation?: { name: string; slug: string; plan: string };
  branches?: Branch[];
  totals?: { branches: number; conversations: number; bookings: number; needs_you: number };
};

export default function Group({ params }: { params: { org: string } }) {
  const [d, setD] = useState<Data | null>(null);
  const [sort, setSort] = useState<"name" | "busy" | "attention">("name");

  useEffect(() => {
    fetch(`/api/group?org=${encodeURIComponent(params.org)}`)
      .then(r => r.json()).then(setD).catch(() => setD({ ok: false }));
  }, [params.org]);

  if (!d) return <Shell><div className="gp-quiet">Loading</div></Shell>;
  if (!d.ok || !d.organisation) {
    return <Shell><div className="gp-quiet">No group found.</div></Shell>;
  }

  const t = d.totals!;
  const branches = [...(d.branches ?? [])].sort((a, b) =>
    sort === "busy" ? b.conversations - a.conversations :
    sort === "attention" ? b.needs_you - a.needs_you :
    a.label.localeCompare(b.label));

  return (
    <Shell>
      <header className="gp-head">
        <div>
          <h1>{d.organisation.name}</h1>
          <p>{t.branches} {t.branches === 1 ? "branch" : "branches"} · {d.organisation.plan} plan</p>
        </div>
        <button className="gp-out" onClick={async () => {
          await fetch("/api/login", { method: "DELETE" });
          window.location.href = "/login";
        }}>Sign out</button>
      </header>

      <section className="gp-totals">
        <div><b>{t.branches}</b><span>branches</span></div>
        <div><b>{t.conversations}</b><span>conversations</span></div>
        <div><b>{t.bookings}</b><span>upcoming bookings</span></div>
        <div><b className={t.needs_you > 0 ? "alert" : ""}>{t.needs_you}</b><span>need attention</span></div>
      </section>

      <div className="gp-sortrow">
        <span>Sort by</span>
        {([["name", "Name"], ["busy", "Busiest"], ["attention", "Needs attention"]] as const)
          .map(([k, label]) => (
            <button key={k} onClick={() => setSort(k)} className={sort === k ? "on" : ""}>
              {label}
            </button>
          ))}
      </div>

      <div className="gp-grid">
        {branches.map(b => (
          <a key={b.slug} href={`/dashboard/${b.slug}`} className="gp-card"
             style={{ "--bc": b.color } as React.CSSProperties}>
            <div className="gp-card-bar" />
            <div className="gp-card-in">
              <div className="gp-card-top">
                <div>
                  <div className="gp-card-name">{b.label}</div>
                  <div className="gp-card-sub">
                    {b.agent ? `${b.agent} answering` : "no agent"}
                    {b.address ? ` · ${b.address}` : ""}
                  </div>
                </div>
                {b.needs_you > 0 && <span className="gp-alert">{b.needs_you}</span>}
              </div>
              <div className="gp-card-figs">
                <div><b>{b.conversations}</b><span>chats</span></div>
                <div><b>{b.bookings}</b><span>booked</span></div>
                <div><b>RM {Number(b.revenue).toFixed(0)}</b><span>collected</span></div>
              </div>
            </div>
          </a>
        ))}
        {branches.length === 0 && (
          <div className="gp-empty">
            No branches in this group yet.
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="gp">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div className="gp-wrap">{children}</div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; }
.gp { --ink:#12100E; --mut:#66625B; --fade:#A5A099; --line:#E7E3DC;
  min-height: 100vh; background: #F4F2ED; color: var(--ink);
  font-family: "Instrument Sans", system-ui, sans-serif; }
.gp-wrap { max-width: 1080px; margin: 0 auto; padding: clamp(24px,4vw,48px) clamp(18px,4vw,32px) 80px; }
.gp-quiet { padding: 100px 0; text-align: center; color: var(--fade); }

.gp-head { display: flex; justify-content: space-between; align-items: flex-start;
  gap: 16px; flex-wrap: wrap; margin-bottom: 28px; }
.gp-head h1 { font-family: "Fraunces", serif; font-weight: 560;
  font-size: clamp(27px,4.5vw,38px); letter-spacing: -0.025em; margin: 0; }
.gp-head p { font-size: 13.5px; color: var(--mut); margin: 7px 0 0; }
.gp-out { background: none; border: 1px solid var(--line); border-radius: 8px;
  padding: 9px 14px; font-size: 12.5px; color: var(--mut); cursor: pointer; font-family: inherit; }

.gp-totals { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px,1fr));
  gap: 1px; background: var(--line); border: 1px solid var(--line);
  border-radius: 14px; overflow: hidden; margin-bottom: 26px; }
.gp-totals > div { background: #FBFAF7; padding: 18px; }
.gp-totals b { display: block; font-family: "Fraunces", serif; font-weight: 560;
  font-size: 26px; letter-spacing: -0.02em; }
.gp-totals b.alert { color: #B3452F; }
.gp-totals span { font-size: 10.5px; color: var(--fade); text-transform: uppercase;
  letter-spacing: .09em; margin-top: 3px; display: block; }

.gp-sortrow { display: flex; align-items: center; gap: 7px; margin-bottom: 14px; flex-wrap: wrap; }
.gp-sortrow > span { font-size: 11.5px; color: var(--fade); text-transform: uppercase;
  letter-spacing: .09em; font-weight: 600; margin-inline-end: 4px; }
.gp-sortrow button { background: #fff; border: 1px solid var(--line); border-radius: 999px;
  padding: 7px 14px; font-size: 12.5px; cursor: pointer; font-family: inherit; color: var(--mut); }
.gp-sortrow button.on { background: var(--ink); border-color: var(--ink); color: #fff; font-weight: 500; }

.gp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(272px,1fr)); gap: 13px; }
.gp-card { background: #fff; border: 1px solid var(--line); border-radius: 16px;
  overflow: hidden; text-decoration: none; color: inherit; display: block;
  transition: transform .2s ease, box-shadow .2s ease; }
.gp-card:hover { transform: translateY(-3px);
  box-shadow: 0 16px 42px color-mix(in oklab, var(--bc) 16%, rgba(18,16,14,.10)); }
.gp-card-bar { height: 3px; background: var(--bc); }
.gp-card-in { padding: 18px; }
.gp-card-top { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
.gp-card-name { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
.gp-card-sub { font-size: 11.5px; color: var(--fade); margin-top: 3px; line-height: 1.45; }
.gp-alert { background: #FBEAE7; color: #B3452F; font-size: 11px; font-weight: 700;
  border-radius: 999px; padding: 3px 9px; flex: none; }
.gp-card-figs { display: flex; gap: 20px; margin-top: 16px; padding-top: 14px;
  border-top: 1px solid #F2F0EB; }
.gp-card-figs b { display: block; font-size: 15px; font-weight: 600;
  font-variant-numeric: tabular-nums; }
.gp-card-figs span { font-size: 10px; color: var(--fade); text-transform: uppercase;
  letter-spacing: .08em; margin-top: 2px; display: block; }
.gp-empty { grid-column: 1/-1; background: #fff; border: 1px solid var(--line);
  border-radius: 14px; padding: 40px; text-align: center; color: var(--fade); font-size: 13.5px; }

a:focus-visible, button:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .gp-card:hover { transform: none; } }
`;
