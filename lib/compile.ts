/**
 * The three-layer compiler.
 *
 *   base role spec  +  sector patch  +  tenant config  →  system prompt
 *
 * Run this when a tenant's configuration changes, NOT on every message.
 * Store the result in ai_employees.compiled_prompt and bump config_version.
 *
 * Reference implementation: scripts/compile.py (Python, already working).
 * Keep the two in step — the precedence rules must not diverge.
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import yaml from "js-yaml";

// ─────────────────────────────────────────────────────────────────────────────
// Precedence — decided in ADR-005, before any code was written
// ─────────────────────────────────────────────────────────────────────────────

/** Never overridable by a tenant. On conflict, the most restrictive wins. */
const SAFETY_FIELDS = new Set([
  "no_clinical_commentary",
  "compliance_rules",
  "escalation_triggers",
  "human_escalation_enabled",
  "llm_tier_minimum",
]);

/** The tenant is the authority on these. */
const TENANT_WINS = new Set([
  "business_name", "hours", "services", "tone", "location",
  "timezone", "languages", "booking_link", "phone",
]);

/** The sector patch is the authority on these. */
const SECTOR_WINS = new Set([
  "terminology", "booking_config", "allowed_actions", "patch_notes",
  "communication_rules", "context_requirements", "success_criteria",
  "upsell_allowed", "recall_reminder_enabled",
]);

/** Same field, two names across the schemas. Reconcile these eventually. */
const ALIASES: Record<string, string> = {
  upsell_allowed: "upsell_allowed_default",
};

const REQUIRED = [
  "agent_id", "role_name", "mission", "default_language",
  "escalation_chain_default", "required_tools",
];

export interface Conflict {
  field: string;
  winner: "sector" | "tenant" | "merged" | "REJECTED";
  rule: string;
}

export interface CompileResult {
  prompt: string;
  tokens: number;
  conflicts: Conflict[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Load
// ─────────────────────────────────────────────────────────────────────────────

export function loadRoleSpec(agentId: string, root = "agents") {
  const dir = path.join(process.cwd(), root);
  const file = fs.readdirSync(dir).find(f => f.startsWith(agentId) && f.endsWith(".md"));
  if (!file) throw new Error(`No spec file for ${agentId} in ${dir}`);
  const { data } = matter(fs.readFileSync(path.join(dir, file), "utf8"));
  if (!data || typeof data !== "object") throw new Error(`${file}: no YAML front matter`);
  return data as Record<string, any>;
}

export function loadSectorPatch(sectorId: string, root = "agents/sectors") {
  const p = path.join(process.cwd(), root, `${sectorId}.yaml`);
  if (!fs.existsSync(p)) throw new Error(`No sector patch at ${p}`);
  return yaml.load(fs.readFileSync(p, "utf8")) as Record<string, any>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Merge
// ─────────────────────────────────────────────────────────────────────────────

function moreRestrictive(a: any, b: any): any {
  if (typeof a === "boolean" && typeof b === "boolean") return a || b;
  if (typeof a === "number" && typeof b === "number") return Math.max(a, b);
  if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b.filter(x => !a.includes(x))];
  return b ?? a;
}

export function merge(
  role: Record<string, any>,
  sector: Record<string, any>,
  tenant: Record<string, any>,
): { merged: Record<string, any>; conflicts: Conflict[] } {
  const out: Record<string, any> = {};
  const conflicts: Conflict[] = [];

  for (const [k, v] of Object.entries(role)) {
    if (!k.startsWith("_")) out[k] = v;
  }

  // sector over base
  const skip = new Set(["agent_id", "sector_id", "schema_version", "patch_version"]);
  for (const [k, v] of Object.entries(sector)) {
    if (k.startsWith("_") || skip.has(k)) continue;
    const baseKey = ALIASES[k] ?? k;
    const baseVal = role[baseKey];

    let win: any, rule: string, winner: Conflict["winner"];
    if (SAFETY_FIELDS.has(k) || SAFETY_FIELDS.has(baseKey)) {
      win = moreRestrictive(baseVal, v);
      rule = "safety: most restrictive";
      winner = "merged";
    } else {
      win = v;
      rule = SECTOR_WINS.has(k) ? "sector wins" : "sector wins (default)";
      winner = "sector";
    }

    if (baseVal !== undefined && JSON.stringify(baseVal) !== JSON.stringify(win)) {
      conflicts.push({ field: k, winner, rule });
    }
    out[baseKey] = win;
  }

  // tenant over everything except safety
  for (const [k, v] of Object.entries(tenant)) {
    if (k.startsWith("_")) continue;
    if (SAFETY_FIELDS.has(k)) {
      conflicts.push({ field: k, winner: "REJECTED", rule: "safety: tenant may not override" });
      continue;   // silently dropping this would be the dangerous bug
    }
    if (k in out && !TENANT_WINS.has(k) && JSON.stringify(out[k]) !== JSON.stringify(v)) {
      conflicts.push({ field: k, winner: "tenant", rule: "tenant wins (unclassified)" });
    }
    out[k] = v;
  }

  const missing = REQUIRED.filter(f => !out[f]);
  if (missing.length) {
    // Fail loudly. A silent default here becomes a wrong answer to a customer.
    throw new Error(`Required field(s) absent from all three layers: ${missing.join(", ")}`);
  }

  return { merged: out, conflicts };
}

// ─────────────────────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────────────────────

function bullets(items: any, key?: string): string {
  if (!items) return "";
  const arr = Array.isArray(items) ? items : [items];
  return arr.map((it: any) => {
    if (it && typeof it === "object") {
      if (key && key in it) return `- ${it[key]}`;
      if ("rule" in it) return `- ${it.rule}`;
      if ("trigger" in it) return `- If ${String(it.trigger).replace(/_/g, " ")}: ${it.action ?? "escalate"}.`;
      return "- " + Object.entries(it).map(([k, v]) => `${k}: ${v}`).join("; ");
    }
    return `- ${it}`;
  }).join("\n");
}

export function render(a: Record<string, any>): string {
  const t = a.terminology ?? {};
  const customer = t.customer ?? "customer";
  const P: string[] = [];

  P.push(`You are ${a.persona_name ?? a.role_name}, the ${a.role_name} for ${a.business_name ?? "the business"}.`);
  P.push(String(a.mission).trim());

  if (a.business_name) {
    const d = [`Business: ${a.business_name}`];
    const fields: [string, string][] = [
      ["Type", "sector_id"], ["Location", "location"], ["Hours", "hours"],
      ["Timezone", "timezone"], ["Phone", "phone"], ["Booking link", "booking_link"],
    ];
    for (const [label, key] of fields) if (a[key]) d.push(`${label}: ${a[key]}`);
    P.push("BUSINESS\n" + d.join("\n"));
  }

  if (a.services) P.push("SERVICES\n" + bullets(a.services));

  // Safety rules sit high so they survive context truncation.
  const hard: string[] = [];
  if (a.no_clinical_commentary) {
    hard.push("- Never discuss, interpret or speculate on symptoms, diagnoses, lab results or treatment. Transfer to a human.");
  }
  if (a.compliance_rules) hard.push(bullets(a.compliance_rules));
  if (hard.length) P.push("RULES YOU MUST NEVER BREAK\n" + hard.join("\n"));

  if (a.escalation_triggers) P.push("HAND OVER TO A HUMAN WHEN\n" + bullets(a.escalation_triggers));

  const cr = a.communication_rules;
  if (cr) {
    const body = (cr && !Array.isArray(cr) && typeof cr === "object")
      ? Object.entries(cr).filter(([, v]) => v !== null && v !== "")
          .map(([k, v]) => `- ${k.replace(/_/g, " ").replace(/^./, c => c.toUpperCase())}: ${v}`).join("\n")
      : bullets(cr, "rule");
    P.push("HOW TO SPEAK\n" + body);
  }

  if (a.tone) P.push(`TONE\n${a.tone}`);
  if (Object.keys(t).length) {
    P.push("WORDS TO USE\n" + Object.entries(t).map(([k, v]) => `- Say '${v}', not '${k}'`).join("\n"));
  }

  const bc = a.booking_config;
  if (bc && Object.keys(bc).length) {
    const b: string[] = [];
    if (bc.booking_types) b.push("Types: " + bc.booking_types.join(", "));
    const bf: [string, string][] = [
      ["Confirmation required", "requires_confirmation"],
      ["Book up to (days ahead)", "max_advance_days"],
      ["Walk-ins allowed", "allow_walk_in"],
      ["Cancellation notice (hours)", "cancellation_policy_hours"],
    ];
    for (const [label, key] of bf) if (key in bc) b.push(`${label}: ${bc[key]}`);
    P.push("BOOKING\n" + b.join("\n"));
  }

  const ctx = a.context_requirements;
  if (ctx) {
    const body = Array.isArray(ctx) && typeof ctx[0] === "string"
      ? ctx.map((c: string) => `- ${c.replace(/_/g, " ")}`).join("\n")
      : bullets(ctx, "field");
    P.push("BEFORE YOU CONFIRM ANYTHING, COLLECT\n" + body);
  }

  if (a.allowed_actions) P.push("YOU MAY\n" + bullets(a.allowed_actions));

  if (!a.upsell_allowed_default) {
    P.push(`Do not upsell or recommend additional services unless the ${customer} asks.`);
  }

  if (a.knowledge_base_summary) P.push("WHAT YOU KNOW\n" + String(a.knowledge_base_summary).trim());

  P.push(
    `Reply in the ${customer}'s own language. Default to ${a.default_language}. ` +
    "If you do not know something, say so and offer to check with a colleague. " +
    "Never invent details."
  );

  return P.join("\n\n");
}

/**
 * Rough token count. Replace with the provider's tokenizer before trusting it
 * for billing — this errs high, which is the safe direction for a budget check.
 */
export function estimateTokens(text: string): number {
  const words = (text.match(/\S+/g) ?? []).length;
  const punct = (text.match(/[^\w\s]/g) ?? []).length;
  return Math.round(Math.max(text.length / 4, words * 1.33 + punct * 0.2));
}

// ─────────────────────────────────────────────────────────────────────────────

export function compileAgent(
  agentId: string,
  sectorId: string,
  tenantConfig: Record<string, any>,
): CompileResult {
  const role = loadRoleSpec(agentId);
  const sector = loadSectorPatch(sectorId);
  const { merged, conflicts } = merge(role, sector, { sector_id: sectorId, ...tenantConfig });
  const prompt = render(merged);
  return { prompt, tokens: estimateTokens(prompt), conflicts };
}
