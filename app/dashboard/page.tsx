"use client";

/**
 * The index. Every business you manage, and where each one needs attention.
 * Same ledger language as the tenant dashboard: ruled rows, tabular figures.
 */

import { useEffect, useState } from "react";

type Business = {
  name: string; slug: string; vertical: string; status: string;
  color: string; wallet: number; agent: string | null;
  conversations: number; bookings: number; needs_you: number;
};

export default function Index() {
  const [list, setList] = useState<Business[] | null>(null);

  useEffect(() => {
    fetch("/api/dashboard?businesses=1")
      .then(r => r.json())
      .then(d => setList(d.businesses ?? []))
      .catch(() => setList([]));
  }, []);

  async function signOut() {
    await fetch("/api/login", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <div style={S.page}>
      <div style={S.sheet}>
        <div style={{ ...S.accent, background: "#1D6A8C" }} />

        <header style={S.head}>
          <div>
            <h1 style={S.h1}>Businesses</h1>
            <p style={S.sub}>Every account with an AI employee answering.</p>
          </div>
          <button onClick={signOut} style={S.signout}>Sign out</button>
        </header>

        <main style={S.main}>
          {list === null && <div style={S.quiet}>Loading</div>}
          {list?.length === 0 && (
            <div style={S.quiet}>No businesses yet. Run the seed migrations.</div>
          )}

          {list?.map(b => (
            <a key={b.slug} href={`/dashboard/${b.slug}`} style={S.row}>
              <span style={{ ...S.dot, background: b.color }} />

              <span style={S.rowMain}>
                <span style={S.name}>{b.name}</span>
                <span style={S.desc}>
                  {b.agent ?? "no agent"} · {b.vertical} · {b.status}
                </span>
              </span>

              <span style={S.figs}>
                <Fig n={b.conversations} l="chats" />
                <Fig n={b.bookings} l="booked" />
                <Fig n={b.needs_you} l="needs you" alert={b.needs_you > 0} />
                <Fig n={`$${Number(b.wallet).toFixed(2)}`} l="credit" />
              </span>
            </a>
          ))}
        </main>

        <p style={S.foot}>
          The chat pages are public: <span style={S.mono}>/demo/&lt;slug&gt;</span>.
          These dashboards are not.
        </p>
      </div>
      <style>{`
        a:hover [data-name] { text-decoration: underline; }
        a:focus-visible, button:focus-visible { outline: 2px solid #1D6A8C; outline-offset: 3px; }
      `}</style>
    </div>
  );
}

function Fig({ n, l, alert }: { n: number | string; l: string; alert?: boolean }) {
  return (
    <span style={S.fig}>
      <span style={{ ...S.figN, color: alert ? "#B3452F" : "#14171A" }}>{n}</span>
      <span style={S.figL}>{l}</span>
    </span>
  );
}

const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#EFEFEC", fontFamily: SANS, color: "#14171A", paddingBottom: 60 },
  sheet: { maxWidth: 860, margin: "0 auto", background: "#FCFCFA", minHeight: "100vh", boxShadow: "0 0 0 1px #E4E4DF" },
  accent: { height: 3 },
  head: { padding: "26px 28px 20px", borderBottom: "1px solid #E4E4DF", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  h1: { fontSize: 25, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 },
  sub: { fontSize: 13, color: "#6E7573", marginTop: 7 },
  signout: { background: "none", border: "1px solid #E4E4DF", borderRadius: 3, padding: "7px 13px", fontSize: 12.5, color: "#6E7573", cursor: "pointer", fontFamily: "inherit" },
  main: { padding: "4px 28px 0" },
  quiet: { padding: "50px 0", textAlign: "center", color: "#A3A6A2", fontSize: 13.5 },
  row: { display: "flex", alignItems: "center", gap: 14, padding: "17px 0", borderBottom: "1px solid #EDEDE8", textDecoration: "none", color: "inherit", flexWrap: "wrap" },
  dot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  rowMain: { flex: 1, minWidth: 160, display: "block" },
  name: { fontSize: 15, fontWeight: 500, display: "block" },
  desc: { fontSize: 12, color: "#8B8F8C", marginTop: 3, display: "block" },
  figs: { display: "flex", gap: 20 },
  fig: { display: "block", textAlign: "right", minWidth: 44 },
  figN: { fontFamily: MONO, fontSize: 14.5, fontVariantNumeric: "tabular-nums", display: "block" },
  figL: { fontSize: 9.5, color: "#A3A6A2", textTransform: "uppercase", letterSpacing: ".08em", marginTop: 2, display: "block" },
  foot: { padding: "22px 28px", fontSize: 11.5, color: "#A3A6A2", lineHeight: 1.6 },
  mono: { fontFamily: MONO },
};
