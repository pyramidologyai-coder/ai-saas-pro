/**
 * One model provider, one function. Nine behind an abstraction is a Gate 3
 * problem — this returns cost so step 8 can log it honestly.
 */

const MODEL = process.env.LLM_MODEL ?? "claude-haiku-4-5";

// USD per 1M tokens. Check current pricing before trusting these for billing.
const PRICING: Record<string, { in: number; out: number; cached: number }> = {
  "claude-haiku-4-5": { in: 1.00, out: 5.00, cached: 0.10 },
};

export interface ModelResult {
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cachedTokens: number;
  costUsd: number;
}

export async function askModel(opts: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<ModelResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      // Prompt caching: the system prompt is identical for every message from
      // this tenant. Highest-ROI cost saving available to us.
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      messages: opts.messages,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) throw new Error(`model ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const u = data.usage ?? {};
  const tokensIn = u.input_tokens ?? 0;
  const tokensOut = u.output_tokens ?? 0;
  const cachedTokens = u.cache_read_input_tokens ?? 0;

  const p = PRICING[MODEL] ?? PRICING["claude-haiku-4-5"];
  const costUsd =
    (tokensIn / 1e6) * p.in +
    (tokensOut / 1e6) * p.out +
    (cachedTokens / 1e6) * p.cached;

  const text = (data.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");

  return { text, model: MODEL, tokensIn, tokensOut, cachedTokens, costUsd };
}
