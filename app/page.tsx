export const metadata = { title: "Automology" };

export default function Home() {
  const done = [
    ["Database", "11 tables, tenant isolation tested"],
    ["Compiler", "three layers into one prompt"],
    ["Chat", "answers, refuses, escalates, books"],
    ["Dashboard", "conversations, diary, live prices"],
  ];
  const next = [["Golden tests", "30 questions, scored"]];

  return (
    <main style={{
      minHeight: "100vh", background: "#EFEFEC", margin: 0,
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      color: "#14171A", display: "flex", justifyContent: "center",
    }}>
      <div style={{ maxWidth: 560, width: "100%", background: "#FCFCFA",
                    minHeight: "100vh", boxShadow: "0 0 0 1px #E4E4DF", padding: "0 0 60px" }}>
        <div style={{ height: 3, background: "#1D6A8C" }} />
        <div style={{ padding: "48px 30px 0" }}>
          <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.025em", margin: 0 }}>
            Automology
          </h1>
          <p style={{ fontSize: 14.5, color: "#6E7573", lineHeight: 1.6, marginTop: 10, maxWidth: "46ch" }}>
            Small businesses hire an AI receptionist. It answers messages, quotes
            real prices, and books appointments.
          </p>

          <div style={{ marginTop: 36 }}>
            {done.map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 14, alignItems: "baseline",
                                    padding: "12px 0", borderBottom: "1px solid #EDEDE8" }}>
                <span style={{ color: "#2C6B5E", fontSize: 13 }}>&#10003;</span>
                <span style={{ fontSize: 14.5, fontWeight: 500, minWidth: 96 }}>{k}</span>
                <span style={{ fontSize: 12.5, color: "#8B8F8C" }}>{v}</span>
              </div>
            ))}
            {next.map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 14, alignItems: "baseline",
                                    padding: "12px 0", borderBottom: "1px solid #EDEDE8", opacity: .55 }}>
                <span style={{ fontSize: 13 }}>&middot;</span>
                <span style={{ fontSize: 14.5, fontWeight: 500, minWidth: 96 }}>{k}</span>
                <span style={{ fontSize: 12.5, color: "#8B8F8C" }}>{v}</span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12.5, color: "#A3A6A2", marginTop: 30,
                      fontFamily: "ui-monospace, Menlo, monospace" }}>
            <a href="/api/health" style={{ color: "#1D6A8C" }}>/api/health</a>
          </p>
        </div>
      </div>
    </main>
  );
}
