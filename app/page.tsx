/**
 * Status page. Proves the deploy works before there is a product.
 * Replaced by the real demo page in Gate 2.
 */
export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 24px", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Automology</h1>
      <p style={{ color: "#666" }}>MVP under construction. Current state:</p>
      <ul style={{ color: "#333" }}>
        <li>Database — 11 tables, isolation tested ✅</li>
        <li>Compiler — working ✅</li>
        <li>Chat API — skeleton (Gate 1)</li>
        <li>Widget & dashboard — Gate 2</li>
      </ul>
      <p style={{ color: "#666" }}>
        Health check: <a href="/api/health">/api/health</a>
      </p>
    </main>
  );
}
