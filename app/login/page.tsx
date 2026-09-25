"use client";

import { useState, Suspense } from "react";
import { Logo } from "@/components/Logo";
import { useSearchParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const setup = params.get("setup") === "1";
  const next = params.get("next") ?? "";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setError("");
    try {
      const sb = supabaseBrowser();
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setError("Couldn't start Google sign-in. Try again.");
    } catch {
      setError("Couldn't start Google sign-in. Try again.");
    }
  }

  async function submit() {
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const r = await res.json();
      if (r.ok) {
        const dest = next && next.startsWith("/dashboard") ? next : (r.next ?? "/dashboard");
        router.push(dest);
        router.refresh();
      } else if (r.reason === "not_configured") {
        setError("No password is set on this deployment yet.");
      } else {
        setError("That key doesn't match any business.");
        setPassword("");
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (setup) {
    return (
      <>
        <h1 style={S.h1}>Set a password first</h1>
        <p style={S.body}>
          The dashboard is locked until a password exists. In Vercel, add an
          environment variable named{" "}
          <code style={S.code}>DASHBOARD_PASSWORD</code>, give it any value you
          like, then redeploy.
        </p>
        <p style={S.foot}>
          The chat widget is unaffected — customers never see this screen.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 style={S.h1}>Dashboard</h1>
      <p style={S.body}>Enter your dashboard key to see conversations, bookings and prices.</p>

      <input
        type="password"
        autoFocus
        value={password}
        onChange={e => { setPassword(e.target.value); setError(""); }}
        onKeyDown={e => { if (e.key === "Enter") submit(); }}
        placeholder="Your dashboard key"
        aria-label="Dashboard key"
        style={{ ...S.input, borderBottomColor: error ? "#B3452F" : "#DAD9D3" }}
      />

      <button onClick={submit} disabled={busy || !password}
        style={{ ...S.button, opacity: busy || !password ? 0.45 : 1,
                 cursor: busy || !password ? "default" : "pointer" }}>
        {busy ? "Checking" : "Open dashboard"}
      </button>

      {error && <p style={S.error}>{error}</p>}

      <div style={S.divider}><span style={S.dividerText}>or</span></div>

      <button onClick={signInWithGoogle} type="button" style={S.google}>
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Continue with Google
      </button>

      <p style={S.foot}>
        Don&apos;t have one? <a href="/start" style={{ color: "#1D6A8C" }}>Set up your
        receptionist</a> — it takes about two minutes.
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <main style={S.page}>
      <div style={S.card}>
        <div style={S.accent} />
        <div style={S.inner}>
          <div style={{ marginBottom: 20 }}><Logo size={19} /></div>
          <Suspense fallback={<div style={S.body}>Loading</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
      <style>{`
        input:focus-visible, button:focus-visible {
          outline: 2px solid #1D6A8C; outline-offset: 3px;
        }
      `}</style>
    </main>
  );
}

const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";
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
  code: { fontFamily: MONO, fontSize: 12.5, background: "#EFEFEC", padding: "2px 5px", borderRadius: 2 },
  input: {
    width: "100%", border: 0, borderBottom: "2px solid", background: "transparent",
    padding: "9px 0", fontSize: 16, fontFamily: "inherit", marginTop: 24,
  },
  button: {
    width: "100%", marginTop: 20, background: "#1D6A8C", color: "#fff",
    border: 0, borderRadius: 3, padding: "11px 0", fontSize: 14,
    fontWeight: 500, fontFamily: "inherit",
  },
  error: { fontSize: 12.5, color: "#B3452F", marginTop: 12 },
  foot: { fontSize: 11.5, color: "#A3A6A2", marginTop: 22, lineHeight: 1.5 },
  divider: {
    display: "flex", alignItems: "center", justifyContent: "center",
    margin: "20px 0 16px", color: "#B7B7B2", fontSize: 11.5,
  },
  dividerText: { whiteSpace: "nowrap", letterSpacing: "0.04em" },
  google: {
    width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
    gap: 10, background: "#fff", color: "#3c4043", border: "1px solid #DADCE0",
    borderRadius: 3, padding: "10px 0", fontSize: 14, fontWeight: 500,
    fontFamily: "inherit", cursor: "pointer",
  },
};
