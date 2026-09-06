"use client";

/**
 * The review page. One tap on the stars, one optional line, done.
 *
 * The order matters: score first, comment after. Asking for a comment up front
 * makes people close the tab, and a score with no comment is still useful. A
 * poor score changes the follow-up copy — it's an apology and a promise to
 * call, not a request to post it publicly.
 */

import { useEffect, useState } from "react";

type Data = {
  ok: boolean; already?: number | null; reason?: string;
  business?: { name: string; color: string; logo_url: string | null };
  visit?: { service: string | null; with: string | null;
            customer: string | null; when: string };
};

export default function Review({ params }: { params: { token: string } }) {
  const token = params.token;
  const [d, setD] = useState<Data | null>(null);
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState<{ score: number; followUp: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/review?token=${encodeURIComponent(token)}`)
      .then(r => r.json()).then(setD).catch(() => setD({ ok: false }));
  }, [token]);

  async function submit(s: number) {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/review", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, score: s, comment }),
      });
      const j = await r.json();
      if (j.ok) setDone({ score: s, followUp: Boolean(j.follow_up) });
      else setErr("That didn't save. Please try again.");
    } catch { setErr("Couldn't reach the server."); }
    finally { setBusy(false); }
  }

  if (!d) return <Shell><p className="rv-quiet">…</p></Shell>;
  if (!d.ok || !d.business) {
    return <Shell><div className="rv-card">
      <h1>We couldn&apos;t find that visit</h1>
      <p className="rv-lede">The link may be old. Nothing to worry about.</p>
    </div></Shell>;
  }

  const b = d.business, v = d.visit;
  const C = b.color;

  if (done || d.already) {
    const s = done?.score ?? d.already!;
    return (
      <Shell color={C}>
        <div className="rv-card rv-done">
          <div className="rv-tick" style={{ background: C }}>✓</div>
          <h1>{s >= 4 ? "Thank you" : "Thank you for telling us"}</h1>
          <p className="rv-lede">
            {done?.followUp
              ? `We're sorry it wasn't better. Someone from ${b.name} will call you — we'd rather fix it than leave it.`
              : s >= 4
                ? `We're glad it went well. See you next time.`
                : `We've passed this on to ${b.name}.`}
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell color={C}>
      <div className="rv-card">
        <header className="rv-head">
          {b.logo_url
            ? <img src={b.logo_url} alt="" className="rv-logo" />
            : <span className="rv-mark" style={{ background: C }}>{b.name.charAt(0)}</span>}
          <div>
            <div className="rv-biz">{b.name}</div>
            {v && <div className="rv-sub">{v.service ?? "Your visit"} · {v.when}</div>}
          </div>
        </header>

        <h1>How was it?</h1>
        <p className="rv-lede">
          {v?.with ? `You saw ${v.with}. ` : ""}One tap is enough.
        </p>

        <div className="rv-stars" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} disabled={busy}
              onMouseEnter={() => setHover(n)}
              onClick={() => { setScore(n); if (n >= 4) submit(n); }}
              aria-label={`${n} out of 5`}
              style={{ color: (hover || score) >= n ? C : "#DDD9D2" }}>
              ★
            </button>
          ))}
        </div>

        {/* Only ask why when the answer is likely to be useful. */}
        {score > 0 && score <= 3 && (
          <div className="rv-more">
            <p className="rv-lede">
              Sorry to hear that. What went wrong? It goes straight to the owner.
            </p>
            <textarea rows={3} value={comment} autoFocus
                      onChange={e => setComment(e.target.value)}
                      placeholder="Optional — but it helps" />
            <button className="rv-btn" style={{ background: C }} disabled={busy}
                    onClick={() => submit(score)}>
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        )}

        {err && <p className="rv-err">{err}</p>}
      </div>
    </Shell>
  );
}

function Shell({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="rv" style={{ "--c": color ?? "#1D6A8C" } as React.CSSProperties}>
      <main>{children}</main>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
*{box-sizing:border-box}
html,body{margin:0}
.rv{--ink:#12100E;--mut:#66625B;--fade:#A5A099;--line:#E7E3DC;
  min-height:100vh;background:color-mix(in oklab,var(--c) 5%,#FBFAF7);color:var(--ink);
  font-family:"Instrument Sans",system-ui,sans-serif;
  display:flex;align-items:center;justify-content:center;padding:24px 18px}
.rv main{width:100%;max-width:420px}
.rv-quiet{text-align:center;color:var(--fade)}
.rv-card{background:#fff;border:1px solid var(--line);border-radius:20px;
  padding:clamp(22px,5vw,30px);box-shadow:0 14px 46px rgba(18,16,14,.07)}
.rv-head{display:flex;align-items:center;gap:12px;padding-bottom:18px;
  border-bottom:1px solid var(--line);margin-bottom:20px}
.rv-logo{width:40px;height:40px;border-radius:10px;object-fit:cover}
.rv-mark{width:40px;height:40px;border-radius:10px;color:#fff;display:grid;
  place-items:center;font-family:"Fraunces",serif;font-size:17px;font-weight:560}
.rv-biz{font-weight:600;font-size:15px}
.rv-sub{font-size:12px;color:var(--fade);margin-top:2px}
.rv h1{font-family:"Fraunces",serif;font-weight:560;font-size:clamp(22px,5vw,28px);
  letter-spacing:-0.025em;margin:0 0 8px}
.rv-lede{font-size:13.5px;color:var(--mut);line-height:1.6;margin:0 0 20px}
.rv-stars{display:flex;justify-content:center;gap:6px;margin:8px 0 4px}
.rv-stars button{background:none;border:0;font-size:clamp(38px,10vw,46px);
  line-height:1;cursor:pointer;padding:2px;transition:transform .12s ease,color .12s ease}
.rv-stars button:hover:not(:disabled){transform:scale(1.12)}
.rv-more{margin-top:18px;padding-top:18px;border-top:1px solid var(--line)}
.rv textarea{width:100%;border:1px solid var(--line);border-radius:12px;
  padding:12px 14px;font-size:14.5px;font-family:inherit;background:#FDFCFA;
  resize:vertical;line-height:1.5;margin-bottom:12px}
.rv textarea:focus{outline:2px solid var(--c);border-color:transparent}
.rv-btn{width:100%;background:var(--c);color:#fff;border:0;border-radius:12px;
  padding:14px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit}
.rv-btn:disabled{opacity:.4;cursor:default}
.rv-done{text-align:center}
.rv-tick{width:54px;height:54px;border-radius:50%;color:#fff;display:grid;
  place-items:center;font-size:25px;margin:0 auto 18px}
.rv-err{font-size:13px;color:#B3452F;margin:14px 0 0}
button:focus-visible,textarea:focus-visible{outline:2px solid var(--c);outline-offset:2px}
@media(prefers-reduced-motion:reduce){.rv-stars button{transition:none}}
`;
