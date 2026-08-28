/**
 * One function, two providers. Picks whichever key is present.
 *
 *   GEMINI_API_KEY    → Google Gemini Flash (free tier, no card)
 *   ANTHROPIC_API_KEY → Claude Haiku (paid, better instruction-following)
 *
 * If both are set, LLM_PROVIDER decides ("gemini" | "anthropic").
 * Returns cost either way, so step 8 logs honest numbers from day one.
 */

export interface ModelResult {
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cachedTokens: number;
  costUsd: number;
}

// USD per 1M tokens. Gemini's free tier is genuinely $0 up to its daily
// limit — we still log the paid-tier rate so the margin model stays honest
// if you outgrow free and switch.
const PRICING: Record<string, { in: number; out: number; cached: number }> = {
  "claude-haiku-4-5":   { in: 1.00,  out: 5.00,  cached: 0.10 },
  // Gemini retires model names periodically. If a call 404s, the error names
  // the replacement — set LLM_MODEL to it, no code change needed.
  "gemini-3.6-flash":   { in: 0.30,  out: 2.50,  cached: 0.075 },
  "gemini-2.5-flash":   { in: 0.30,  out: 2.50,  cached: 0.075 },
};

function pickProvider(): "gemini" | "anthropic" {
  const forced = process.env.LLM_PROVIDER?.toLowerCase();
  if (forced === "gemini" || forced === "anthropic") return forced;
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  throw new Error("No LLM key set. Add GEMINI_API_KEY or ANTHROPIC_API_KEY.");
}

function price(model: string, tIn: number, tOut: number, cached: number) {
  const p = PRICING[model] ?? { in: 0.1, out: 0.4, cached: 0.025 };
  return (tIn / 1e6) * p.in + (tOut / 1e6) * p.out + (cached / 1e6) * p.cached;
}

export async function askModel(opts: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<ModelResult> {
  return pickProvider() === "gemini" ? askGemini(opts) : askAnthropic(opts);
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Gemini
// ─────────────────────────────────────────────────────────────────────────────
async function askGemini(opts: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<ModelResult> {
  const model = process.env.LLM_MODEL ?? "gemini-3.6-flash";
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  // Gemini calls the assistant "model" and takes the system prompt separately.
  const contents = opts.messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: opts.system }] },
        generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
        // Don't let the safety filter silently eat ordinary salon chat.
        safetySettings: [
          "HARM_CATEGORY_HARASSMENT",
          "HARM_CATEGORY_HATE_SPEECH",
          "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          "HARM_CATEGORY_DANGEROUS_CONTENT",
        ].map(category => ({ category, threshold: "BLOCK_ONLY_HIGH" })),
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );

  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const cand = data.candidates?.[0];

  // A blocked or empty response must not become an empty message.
  if (!cand || cand.finishReason === "SAFETY" || cand.finishReason === "RECITATION") {
    throw new Error(`gemini returned no usable text (${cand?.finishReason ?? "empty"})`);
  }

  const text = (cand.content?.parts ?? [])
    .map((p: any) => p.text ?? "")
    .join("")
    .trim();

  if (!text) throw new Error("gemini returned empty text");

  const u = data.usageMetadata ?? {};
  const tokensIn = u.promptTokenCount ?? 0;
  const tokensOut = u.candidatesTokenCount ?? 0;
  const cachedTokens = u.cachedContentTokenCount ?? 0;

  return {
    text,
    model,
    tokensIn,
    tokensOut,
    cachedTokens,
    costUsd: price(model, tokensIn, tokensOut, cachedTokens),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Anthropic
// ─────────────────────────────────────────────────────────────────────────────
async function askAnthropic(opts: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<ModelResult> {
  const model = process.env.LLM_MODEL ?? "claude-haiku-4-5";
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      // Prompt caching: the system prompt is identical for every message from
      // this tenant. Highest-ROI cost saving available to us.
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      messages: opts.messages,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const u = data.usage ?? {};
  const tokensIn = u.input_tokens ?? 0;
  const tokensOut = u.output_tokens ?? 0;
  const cachedTokens = u.cache_read_input_tokens ?? 0;

  const text = (data.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();

  if (!text) throw new Error("anthropic returned empty text");

  return {
    text,
    model,
    tokensIn,
    tokensOut,
    cachedTokens,
    costUsd: price(model, tokensIn, tokensOut, cachedTokens),
  };
}
