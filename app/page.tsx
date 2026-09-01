"use client";

/**
 * Automology's own page. Not a tenant's page — this is the product.
 *
 * Direction: the thing being sold is a person who never sleeps. So the page is
 * built around a conversation, not a feature grid — a live exchange types
 * itself out in the hero, because showing the product working beats describing
 * it. Ink and paper with a single signal green, Fraunces display against
 * Instrument Sans, generous space.
 */

import { useState, useEffect } from "react";

const SCRIPT: { role: "c" | "a"; text: string }[] = [
  { role: "c", text: "hi, how much for a full health screening?" },
  { role: "a", text: "The full screening is RM 380, about an hour. You'll need to fast for 10 hours beforehand — shall I find you a slot?" },
  { role: "c", text: "tuesday afternoon if you have it" },
  { role: "a", text: "Tuesday 3pm is free. Can I take your name?" },
  { role: "c", text: "Ahmad" },
  { role: "a", text: "Booked — Tuesday 3pm, full screening. See you then, Ahmad." },
];

export default function Landing() {
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (shown >= SCRIPT.length) {
      const r = setTimeout(() => setShown(0), 6000);
      return () => clearTimeout(r);
    }
    const isAgent = SCRIPT[shown].role === "a";
    if (isAgent) setTyping(true);
    const t = setTimeout(() => {
      setTyping(false);
      setShown(s => s + 1);
    }, isAgent ? 1100 : 700);
    return () => clearTimeout(t);
  }, [shown]);

  return (
    <div className="al">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,560;9..144,700&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      <header className="al-head">
        <div className="al-logo">Automology</div>
        <nav>
          <a href="/demo/damai-clinic">See it live</a>
          <a href="/login" className="quiet">Sign in</a>
          <a href="/start" className="cta">Get started</a>
        </nav>
      </header>

      {/* ── hero ───────────────────────────────────────────────── */}
      <section className="al-hero">
        <div className="al-hero-copy">
          <p className="al-eyebrow">AI receptionist for small businesses</p>
          <h1>Nobody should lose a customer to an unanswered message.</h1>
          <p className="al-lede">
            Automology answers your customers instantly — quoting your real
            prices, following your rules, and booking appointments straight into
            your diary. Day or night.
          </p>
          <div className="al-actions">
            <a href="/start" className="al-btn">Set yours up free</a>
            <a href="/demo/damai-clinic" className="al-btn ghost">Try a live one →</a>
          </div>
          <p className="al-note">No card. Live in about two minutes.</p>
        </div>

        <div className="al-demo" aria-hidden>
          <div className="al-phone">
            <div className="al-phone-top">
              <span className="al-avatar">N</span>
              <div>
                <div className="al-phone-name">Nadia</div>
                <div className="al-phone-sub">
                  <i className="al-live" /> Damai Family Clinic
                </div>
              </div>
            </div>
            <div className="al-phone-log">
              {SCRIPT.slice(0, shown).map((m, i) => (
                <div key={i} className={`al-b ${m.role}`}>{m.text}</div>
              ))}
              {typing && <div className="al-b a al-dots"><i /><i /><i /></div>}
            </div>
          </div>
        </div>
      </section>

      {/* ── proof strip ────────────────────────────────────────── */}
      <section className="al-strip">
        <div><b>24/7</b><span>always answering</span></div>
        <div><b>~2 min</b><span>to set up</span></div>
        <div><b>4</b><span>languages, incl. Arabic</span></div>
        <div><b>Your brand</b><span>not ours</span></div>
      </section>

      {/* ── how ────────────────────────────────────────────────── */}
      <section className="al-sec">
        <h2 className="al-h2">How it works</h2>
        <div className="al-steps">
          {[
            ["Tell us about your business", "Name, services, prices, opening hours. Two minutes, one form."],
            ["We build your receptionist", "Your brand colour, your agent's name, your rules. Nothing says Automology."],
            ["Share your link", "Put it on your website, your Instagram bio, your WhatsApp. It starts answering."],
          ].map(([h, p], i) => (
            <div key={h} className="al-step">
              <span className="al-num">{i + 1}</span>
              <h3>{h}</h3>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── what it does ───────────────────────────────────────── */}
      <section className="al-sec al-dark">
        <h2 className="al-h2 light">What it actually does</h2>
        <div className="al-feats">
          {[
            ["Quotes your real prices", "It reads from your price list. Change a price in your dashboard and it quotes the new one on the next message. It never makes one up."],
            ["Books into your diary", "It checks your opening hours, refuses double bookings, and writes the appointment down. You confirm or cancel with one tap."],
            ["Knows when to stop", "Complaints, refunds, anything it isn't allowed to decide — it hands over to you instead of guessing."],
            ["Speaks your customers' language", "English, Bahasa Melayu, Arabic, Chinese. It replies in whatever they write in."],
          ].map(([h, p]) => (
            <div key={h} className="al-feat">
              <h3>{h}</h3>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── pricing ────────────────────────────────────────────── */}
      <section className="al-sec">
        <h2 className="al-h2">Simple pricing</h2>
        <div className="al-plans">
          {[
            { n: "Trial", p: "Free", d: "Everything, for 14 days.",
              f: ["Your own branded page", "Unlimited conversations", "Bookings and dashboard", "No card needed"], cta: "Start free", best: false },
            { n: "Standard", p: "RM 149", u: "/month", d: "For one location.",
              f: ["Everything in Trial", "Your own domain", "Priority replies", "Email support"], cta: "Start free", best: true },
            { n: "Multi", p: "RM 399", u: "/month", d: "For three or more locations.",
              f: ["Everything in Standard", "Up to 5 businesses", "One dashboard for all", "Onboarding call"], cta: "Talk to us", best: false },
          ].map(pl => (
            <div key={pl.n} className={`al-plan ${pl.best ? "best" : ""}`}>
              {pl.best && <span className="al-badge">Most popular</span>}
              <h3>{pl.n}</h3>
              <div className="al-cost">{pl.p}<em>{pl.u ?? ""}</em></div>
              <p className="al-plan-d">{pl.d}</p>
              <ul>{pl.f.map(f => <li key={f}>{f}</li>)}</ul>
              <a href="/start" className={`al-btn ${pl.best ? "" : "ghost"} full`}>{pl.cta}</a>
            </div>
          ))}
        </div>
        <p className="al-note center">Prices in Malaysian ringgit. Cancel any time.</p>
      </section>

      {/* ── close ──────────────────────────────────────────────── */}
      <section className="al-close">
        <h2>Your receptionist could be answering in two minutes.</h2>
        <a href="/start" className="al-btn big">Set yours up free</a>
      </section>

      <footer className="al-foot">
        <div>Automology</div>
        <div className="al-foot-links">
          <a href="/demo/damai-clinic">Live demo</a>
          <a href="/start">Get started</a>
          <a href="/login">Sign in</a>
        </div>
      </footer>

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; }

.al {
  --ink: #12100E;
  --mut: #66625B;
  --fade: #A5A099;
  --line: #E7E3DC;
  --paper: #FBFAF7;
  --sig: #1E6F5C;
  background: var(--paper); color: var(--ink);
  font-family: "Instrument Sans", system-ui, -apple-system, sans-serif;
  overflow-x: hidden;
}

/* header */
.al-head {
  position: sticky; top: 0; z-index: 40;
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px clamp(18px, 5vw, 56px);
  background: rgba(251,250,247,.86); backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--line);
}
.al-logo { font-family: "Fraunces", serif; font-weight: 700; font-size: 20px; letter-spacing: -0.02em; }
.al-head nav { display: flex; align-items: center; gap: 6px; }
.al-head nav a {
  text-decoration: none; color: var(--mut); font-size: 13.5px;
  padding: 9px 13px; border-radius: 999px;
}
.al-head nav a:hover { color: var(--ink); }
.al-head nav a.quiet { display: none; }
.al-head nav a.cta {
  background: var(--ink); color: #fff; font-weight: 600; padding: 10px 18px;
}
.al-head nav a.cta:hover { background: var(--sig); color: #fff; }
@media (min-width: 700px) { .al-head nav a.quiet { display: inline-block; } }

/* hero */
.al-hero {
  display: grid; grid-template-columns: 1fr; gap: 48px;
  max-width: 1180px; margin: 0 auto;
  padding: clamp(48px, 8vw, 96px) clamp(18px, 5vw, 56px) clamp(40px, 6vw, 72px);
  align-items: center;
}
@media (min-width: 940px) { .al-hero { grid-template-columns: 1.05fr .95fr; gap: 64px; } }

.al-eyebrow {
  font-size: 12.5px; letter-spacing: .16em; text-transform: uppercase;
  color: var(--sig); font-weight: 600; margin: 0 0 20px;
}
.al-hero h1 {
  font-family: "Fraunces", Georgia, serif; font-weight: 560;
  font-size: clamp(38px, 6.2vw, 66px); line-height: 1.02; letter-spacing: -0.03em;
  margin: 0; max-width: 15ch;
}
.al-lede {
  font-size: clamp(15.5px, 1.6vw, 18px); color: var(--mut);
  line-height: 1.62; margin: 22px 0 0; max-width: 46ch;
}
.al-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 32px; }
.al-btn {
  display: inline-block; background: var(--ink); color: #fff; text-decoration: none;
  border-radius: 999px; padding: 14px 28px; font-size: 15px; font-weight: 600;
  transition: transform .16s ease, background .16s ease, box-shadow .16s ease;
  box-shadow: 0 6px 22px rgba(18,16,14,.14);
}
.al-btn:hover { transform: translateY(-2px); background: var(--sig); box-shadow: 0 12px 32px rgba(30,111,92,.28); }
.al-btn.ghost { background: none; color: var(--ink); border: 1px solid var(--line); box-shadow: none; }
.al-btn.ghost:hover { background: #fff; color: var(--sig); border-color: var(--sig); }
.al-btn.full { display: block; text-align: center; margin-top: 20px; }
.al-btn.big { padding: 17px 38px; font-size: 16.5px; }
.al-note { font-size: 12.5px; color: var(--fade); margin-top: 14px; }
.al-note.center { text-align: center; margin-top: 26px; }

/* phone demo */
.al-demo { display: flex; justify-content: center; }
.al-phone {
  width: min(370px, 100%); background: #fff; border: 1px solid var(--line);
  border-radius: 26px; overflow: hidden;
  box-shadow: 0 30px 80px rgba(18,16,14,.13), 0 4px 14px rgba(18,16,14,.05);
  animation: float 7s ease-in-out infinite;
}
@keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
.al-phone-top {
  display: flex; align-items: center; gap: 11px; padding: 15px 17px;
  background: linear-gradient(135deg, #1D6A8C, #124257); color: #fff;
}
.al-avatar {
  width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,.22);
  display: grid; place-items: center; font-family: "Fraunces", serif; font-weight: 560; font-size: 16px;
}
.al-phone-name { font-weight: 600; font-size: 14.5px; }
.al-phone-sub { font-size: 11px; opacity: .85; display: flex; align-items: center; gap: 5px; margin-top: 1px; }
.al-live { width: 6px; height: 6px; border-radius: 50%; background: #6FE3B4; display: inline-block; }
.al-phone-log {
  padding: 16px; min-height: 340px; display: flex; flex-direction: column; gap: 9px;
  background: #FDFCFA;
}
.al-b {
  max-width: 84%; padding: 10px 14px; font-size: 13.5px; line-height: 1.5;
  animation: pop .28s ease both;
}
@keyframes pop { from { opacity: 0; transform: translateY(7px); } }
.al-b.c { align-self: flex-end; background: #1D6A8C; color: #fff; border-radius: 15px 15px 4px 15px; }
.al-b.a { align-self: flex-start; background: #fff; border: 1px solid var(--line); border-radius: 15px 15px 15px 4px; }
.al-dots { display: flex; gap: 4px; align-items: center; padding: 13px 15px; }
.al-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--fade); animation: blink 1.2s infinite; }
.al-dots i:nth-child(2) { animation-delay: .15s; }
.al-dots i:nth-child(3) { animation-delay: .3s; }
@keyframes blink { 0%,80%,100% { opacity: .25; } 40% { opacity: 1; } }

/* strip */
.al-strip {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1px; background: var(--line);
  border-block: 1px solid var(--line);
}
.al-strip > div { background: var(--paper); padding: 26px 22px; text-align: center; }
.al-strip b {
  display: block; font-family: "Fraunces", serif; font-weight: 560;
  font-size: 26px; letter-spacing: -0.02em;
}
.al-strip span { font-size: 12px; color: var(--fade); margin-top: 4px; display: block; }

/* sections */
.al-sec { max-width: 1180px; margin: 0 auto; padding: clamp(56px, 9vw, 104px) clamp(18px, 5vw, 56px); }
.al-h2 {
  font-family: "Fraunces", serif; font-weight: 560;
  font-size: clamp(27px, 4vw, 40px); letter-spacing: -0.025em; margin: 0 0 40px;
}
.al-h2.light { color: #fff; }

.al-steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 32px; }
.al-step h3 { font-size: 17px; font-weight: 600; margin: 14px 0 8px; letter-spacing: -0.01em; }
.al-step p { font-size: 14px; color: var(--mut); line-height: 1.62; margin: 0; }
.al-num {
  display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%;
  background: var(--sig); color: #fff; font-size: 14px; font-weight: 600;
  font-family: "Fraunces", serif;
}

/* dark band */
.al-dark { background: var(--ink); color: #fff; max-width: none; }
.al-dark > * { max-width: 1180px; margin-inline: auto; }
.al-feats { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 32px; max-width: 1180px; margin-inline: auto; }
.al-feat h3 {
  font-family: "Fraunces", serif; font-weight: 560; font-size: 20px;
  margin: 0 0 10px; letter-spacing: -0.015em;
}
.al-feat p { font-size: 14px; line-height: 1.65; margin: 0; color: rgba(255,255,255,.66); }

/* pricing */
.al-plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(268px, 1fr)); gap: 18px; }
.al-plan {
  background: #fff; border: 1px solid var(--line); border-radius: 20px; padding: 30px 26px;
  position: relative; transition: transform .2s ease, box-shadow .2s ease;
}
.al-plan:hover { transform: translateY(-3px); box-shadow: 0 18px 46px rgba(18,16,14,.09); }
.al-plan.best { border-color: var(--sig); box-shadow: 0 14px 44px rgba(30,111,92,.14); }
.al-badge {
  position: absolute; top: -11px; inset-inline-start: 26px;
  background: var(--sig); color: #fff; font-size: 11px; font-weight: 600;
  padding: 4px 12px; border-radius: 999px; letter-spacing: .02em;
}
.al-plan h3 { font-size: 15px; font-weight: 600; margin: 0; color: var(--mut); letter-spacing: .01em; }
.al-cost {
  font-family: "Fraunces", serif; font-weight: 560; font-size: 40px;
  letter-spacing: -0.03em; margin: 10px 0 4px;
}
.al-cost em { font-style: normal; font-size: 14px; color: var(--fade); font-family: "Instrument Sans", sans-serif; }
.al-plan-d { font-size: 13px; color: var(--mut); margin: 0 0 18px; }
.al-plan ul { list-style: none; padding: 0; margin: 0; }
.al-plan li {
  font-size: 13.5px; color: var(--mut); padding: 7px 0 7px 22px; position: relative;
}
.al-plan li::before {
  content: "✓"; position: absolute; inset-inline-start: 0; color: var(--sig); font-weight: 700; font-size: 12px;
}

/* close */
.al-close {
  text-align: center; padding: clamp(60px, 10vw, 120px) clamp(18px, 5vw, 56px);
  border-top: 1px solid var(--line);
}
.al-close h2 {
  font-family: "Fraunces", serif; font-weight: 560;
  font-size: clamp(28px, 5vw, 48px); letter-spacing: -0.03em;
  margin: 0 auto 34px; max-width: 20ch; line-height: 1.1;
}

/* footer */
.al-foot {
  background: var(--ink); color: #fff; padding: 34px clamp(18px, 5vw, 56px);
  display: flex; justify-content: space-between; align-items: center; gap: 18px; flex-wrap: wrap;
  font-family: "Fraunces", serif; font-weight: 560; font-size: 19px;
}
.al-foot-links { display: flex; gap: 20px; font-family: "Instrument Sans", sans-serif; font-size: 13px; font-weight: 400; }
.al-foot-links a { color: rgba(255,255,255,.62); text-decoration: none; }
.al-foot-links a:hover { color: #fff; }

a:focus-visible { outline: 2px solid var(--sig); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) {
  .al-phone, .al-b, .al-dots i { animation: none !important; }
  .al-btn:hover, .al-plan:hover { transform: none; }
}
`;
