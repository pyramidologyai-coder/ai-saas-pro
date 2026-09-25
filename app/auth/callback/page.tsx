"use client";

/**
 * /auth/callback — where Google sends the user back.
 *
 * The Supabase browser client finishes the sign-in from the URL on its own, so
 * we wait for the session, hand its access token to /api/auth/google, and then
 * go where that route says: a dashboard, a chooser, or /start for a brand-new
 * account with no business yet.
 */
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

type Biz = { slug: string; name: string; role: string; color?: string };

export default function AuthCallback() {
  const [msg, setMsg] = useState("Signing you in…");
  const [choices, setChoices] = useState<Biz[] | null>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const sb = supabaseBrowser();
        // detectSessionInUrl completes the code exchange in the background, so
        // the session may not be ready on the first read. Poll briefly.
        let session = (await sb.auth.getSession()).data.session;
        for (let i = 0; i < 6 && !session?.access_token; i++) {
          await new Promise(r => setTimeout(r, 400));
          session = (await sb.auth.getSession()).data.session;
        }
        if (!session?.access_token) {
          setMsg("Sign-in didn't complete. Please go back and try again.");
          return;
        }
        setToken(session.access_token);

        const r = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ access_token: session.access_token }),
        });
        const j = await r.json();

        if (!j.ok) { setMsg("We couldn't sign you in. Please try again."); return; }
        if (j.next) { window.location.href = j.next; return; }
        if (Array.isArray(j.businesses) && j.businesses.length) {
          setChoices(j.businesses);
          setMsg("");
          return;
        }
        window.location.href = "/start";
      } catch {
        setMsg("Something went wrong. Please try again.");
      }
    })();
  }, []);

  async function choose(slug: string) {
    setMsg("Opening…");
    setChoices(null);
    try {
      const r = await fetch("/api/auth/choose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ access_token: token, slug }),
      });
      const j = await r.json();
      if (j.ok && j.next) window.location.href = j.next;
      else setMsg("Couldn't open that business. Please try again.");
    } catch {
      setMsg("Something went wrong. Please try again.");
    }
  }

  return (
    <main style={S.page}>
      <div style={S.card}>
        <div style={S.accent} />
        <div style={S.inner}>
          {choices ? (
            <>
              <h1 style={S.h1}>Choose a business</h1>
              <p style={S.body}>Your account has access to more than one.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
                {choices.map(b => (
                  <button key={b.slug} onClick={() => choose(b.slug)} style={S.choice}>
                    <span style={{ fontWeight: 600 }}>{b.name}</span>
                    <span style={{ fontSize: 12, color: "#6E7573", textTransform: "capitalize" }}>{b.role}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p style={{ ...S.body, marginTop: 4 }}>{msg}</p>
          )}
        </div>
      </div>
    </main>
  );
}

const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh", background: "#EFEFEC", display: "flex",
    alignItems: "center", justifyContent: "center", padding: 20,
    fontFamily: SANS, color: "#14171A",
  },
  card: {
    width: "100%", maxWidth: 380, background: "#FCFCFA",
    boxShadow: "0 0 0 1px #E4E4DF, 0 10px 40px rgba(20,23,26,.10)",
    borderRadius: 6, overflow: "hidden",
  },
  accent: { height: 3, background: "#1D6A8C" },
  inner: { padding: "34px 30px 30px" },
  h1: { fontSize: 21, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 },
  body: { fontSize: 13.5, color: "#6E7573", lineHeight: 1.6, marginTop: 9 },
  choice: {
    display: "flex", flexDirection: "column", gap: 2, textAlign: "left",
    padding: "12px 14px", borderRadius: 4, border: "1px solid #E4E4DF",
    background: "#fff", cursor: "pointer", fontFamily: "inherit",
  },
};
