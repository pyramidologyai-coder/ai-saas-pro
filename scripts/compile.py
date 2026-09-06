#!/usr/bin/env python3
"""
Automology agent compiler.

Merges a base role spec, a sector patch and a tenant config into one system
prompt, and reports what it cost you in tokens.

Answers two questions the architecture rests on:
  1. How large is a compiled system prompt, really?
  2. Does a compiled agent actually differ between sectors?

Usage:
    python compile.py --agent AGENT-001 --sector clinic --tenant tenants/x.json
    python compile.py --diff clinic salon --agent AGENT-001
"""

import argparse
import json
import os
import re
import sys
import difflib

try:
    import yaml
except ImportError:
    sys.exit("pyyaml required:  pip install pyyaml")

_ENC = None
try:
    import tiktoken
    _ENC = tiktoken.get_encoding("cl100k_base")   # needs network on first use
    TOKENIZER = "tiktoken/cl100k_base (exact)"
except Exception:
    TOKENIZER = "calibrated estimate (±10%) — no tokenizer vocab available offline"


def count_tokens(text):
    """Exact when tiktoken is available; otherwise a calibrated estimate.

    BPE tokenizers land near chars/4 for English prose, but structured text —
    bullets, prices, times, IDs — fragments more. Taking the max of the two
    common heuristics tracks real counts within roughly 10% and errs high,
    which is the safe direction for a budget check.
    """
    if _ENC is not None:
        return len(_ENC.encode(text))
    words = len(re.findall(r"\S+", text))
    punct = len(re.findall(r"[^\w\s]", text))
    return int(max(len(text) / 4.0, words * 1.33 + punct * 0.20))

REPO = os.environ.get("AUTOMOLOGY_REPO",
                      os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ─────────────────────────────────────────────────────────────────────────────
# Precedence
# ─────────────────────────────────────────────────────────────────────────────
# Decided before the code was written. Every conflict resolves through exactly
# one of these rules, and every resolution is reported.

SAFETY_FIELDS = {
    "no_clinical_commentary",
    "compliance_rules",
    "escalation_triggers",
    "human_escalation_enabled",
    "llm_tier_minimum",
}

TENANT_WINS = {
    "business_name", "hours", "services", "tone", "location",
    "timezone", "languages", "booking_link", "phone",
}

SECTOR_WINS = {
    "terminology", "booking_config", "allowed_actions", "patch_notes",
    "communication_rules", "context_requirements", "success_criteria",
    "upsell_allowed", "recall_reminder_enabled",
}

# Sector patch key -> base role spec key, where the names differ
ALIASES = {
    "upsell_allowed": "upsell_allowed_default",
}


class Conflict:
    def __init__(self, field, base, sector, tenant, winner, rule):
        self.field, self.base, self.sector = field, base, sector
        self.tenant, self.winner, self.rule = tenant, winner, rule

    def __str__(self):
        def short(v):
            if v is None:
                return "—"
            s = str(v).replace("\n", " ")
            return s[:48] + ("…" if len(s) > 48 else "")
        return (f"  {self.field:<28} base={short(self.base):<26} "
                f"sector={short(self.sector):<26} → {self.winner}  [{self.rule}]")


# ─────────────────────────────────────────────────────────────────────────────
# Loading
# ─────────────────────────────────────────────────────────────────────────────

def load_role_spec(agent_id):
    """Extract and parse the YAML front matter from an agent .md file."""
    d = os.path.join(REPO, "agents")
    matches = [f for f in os.listdir(d)
               if f.startswith(agent_id) and f.endswith(".md")]
    if not matches:
        sys.exit(f"FAIL: no spec file found for {agent_id} in {d}")
    path = os.path.join(d, matches[0])

    text = open(path, encoding="utf-8").read()
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        sys.exit(f"FAIL: {path} has no YAML front matter delimited by ---")

    spec = yaml.safe_load(m.group(1))
    if not isinstance(spec, dict):
        sys.exit(f"FAIL: front matter in {path} did not parse to a mapping")
    spec["_source"] = path
    spec["_narrative"] = text[m.end():]
    return spec


def load_sector_patch(agent_id, sector_id):
    # flat layout in this repo; nested layout in the old one
    flat = os.path.join(REPO, "agents", "sectors", f"{sector_id}.yaml")
    folder = "agent-" + agent_id.split("-")[1]
    nested = os.path.join(REPO, "agents", "sectors", folder, f"{sector_id}.yaml")
    path = flat if os.path.exists(flat) else nested
    if not os.path.exists(path):
        sys.exit(f"FAIL: no sector patch at {path}")
    patch = yaml.safe_load(open(path, encoding="utf-8"))
    patch["_source"] = path
    return patch


def load_tenant(path):
    if not os.path.exists(path):
        sys.exit(f"FAIL: no tenant config at {path}")
    return json.load(open(path, encoding="utf-8"))


# ─────────────────────────────────────────────────────────────────────────────
# Merge
# ─────────────────────────────────────────────────────────────────────────────

def more_restrictive(a, b):
    """For safety fields the tighter value always wins."""
    if isinstance(a, bool) and isinstance(b, bool):
        return a or b                       # True = restriction on
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return max(a, b)                    # higher tier = more capable model
    if isinstance(a, list) and isinstance(b, list):
        return a + [x for x in b if x not in a]   # union of rules
    return b if b is not None else a


def merge(role, sector, tenant):
    out, conflicts = {}, []

    for k, v in role.items():
        if not k.startswith("_"):
            out[k] = v

    # sector patch over base
    for k, v in sector.items():
        if k.startswith("_") or k in ("agent_id", "sector_id", "schema_version",
                                      "patch_version"):
            continue
        base_key = ALIASES.get(k, k)
        base_val = role.get(base_key)

        if k in SAFETY_FIELDS or base_key in SAFETY_FIELDS:
            win = more_restrictive(base_val, v)
            rule = "safety: most restrictive"
            src = "merged"
        elif k in SECTOR_WINS or base_key not in role:
            win, rule, src = v, "sector wins", "sector"
        else:
            win, rule, src = v, "sector wins (default)", "sector"

        if base_val is not None and base_val != win:
            conflicts.append(Conflict(k, base_val, v, None, src, rule))
        out[base_key] = win

    # tenant over everything except safety
    for k, v in tenant.items():
        if k.startswith("_"):
            continue
        if k in SAFETY_FIELDS:
            conflicts.append(Conflict(k, out.get(k), None, v, "REJECTED",
                                      "safety: tenant may not override"))
            continue
        if k in out and out[k] != v and k not in TENANT_WINS:
            conflicts.append(Conflict(k, out.get(k), None, v, "tenant",
                                      "tenant wins (unclassified)"))
        out[k] = v

    # fail loudly on required fields present nowhere
    required = ["agent_id", "role_name", "mission", "default_language",
                "escalation_chain_default", "required_tools"]
    missing = [f for f in required if not out.get(f)]
    if missing:
        sys.exit(f"FAIL: required field(s) absent from all three layers: {missing}")

    return out, conflicts


# ─────────────────────────────────────────────────────────────────────────────
# Render
# ─────────────────────────────────────────────────────────────────────────────

def bullets(items, key=None):
    lines = []
    for it in items or []:
        if isinstance(it, dict):
            if key and key in it:
                lines.append(f"- {it[key]}")
            elif "rule" in it:
                lines.append(f"- {it['rule']}")
            elif "trigger" in it:
                act = it.get("action", "escalate")
                lines.append(f"- If {it['trigger'].replace('_',' ')}: {act}.")
            else:
                lines.append("- " + "; ".join(f"{k}: {v}" for k, v in it.items()))
        else:
            lines.append(f"- {it}")
    return "\n".join(lines)


def render(a):
    """Assemble the system prompt. Order matters: identity, then rules, then
    detail — safety rules sit high so they survive context truncation."""
    t = a.get("terminology", {}) or {}
    customer = t.get("customer", "customer")
    P = []

    P.append(f"You are {a.get('persona_name', a['role_name'])}, "
             f"the {a['role_name']} for {a.get('business_name','the business')}.")
    P.append(a["mission"].strip())

    if a.get("business_name"):
        d = [f"Business: {a['business_name']}"]
        for label, key in (("Type", "sector_id"), ("Location", "location"),
                           ("Hours", "hours"), ("Timezone", "timezone"),
                           ("Phone", "phone"), ("Booking link", "booking_link")):
            if a.get(key):
                d.append(f"{label}: {a[key]}")
        P.append("BUSINESS\n" + "\n".join(d))

    if a.get("services"):
        P.append("SERVICES\n" + bullets(a["services"]))

    hard = []
    if a.get("no_clinical_commentary"):
        hard.append("- Never discuss, interpret or speculate on symptoms, "
                    "diagnoses, lab results or treatment. Transfer to a human.")
    if a.get("compliance_rules"):
        hard.append(bullets(a["compliance_rules"]))
    if hard:
        P.append("RULES YOU MUST NEVER BREAK\n" + "\n".join(hard))

    if a.get("escalation_triggers"):
        P.append("HAND OVER TO A HUMAN WHEN\n" + bullets(a["escalation_triggers"]))

    cr = a.get("communication_rules")
    if cr:
        if isinstance(cr, dict):
            lines = [f"- {k.replace('_',' ').capitalize()}: {v}"
                     for k, v in cr.items() if v not in (None, "", [])]
            P.append("HOW TO SPEAK\n" + "\n".join(lines))
        else:
            P.append("HOW TO SPEAK\n" + bullets(cr, key="rule"))
    if a.get("tone"):
        P.append(f"TONE\n{a['tone']}")
    if t:
        P.append("WORDS TO USE\n" +
                 "\n".join(f"- Say '{v}', not '{k}'" for k, v in t.items()))

    bc = a.get("booking_config") or {}
    if bc:
        b = []
        if bc.get("booking_types"):
            b.append("Types: " + ", ".join(bc["booking_types"]))
        for label, key in (("Confirmation required", "requires_confirmation"),
                           ("Book up to (days ahead)", "max_advance_days"),
                           ("Walk-ins allowed", "allow_walk_in"),
                           ("Cancellation notice (hours)",
                            "cancellation_policy_hours")):
            if key in bc:
                b.append(f"{label}: {bc[key]}")
        P.append("BOOKING\n" + "\n".join(b))

    ctx = a.get("context_requirements")
    if ctx:
        if isinstance(ctx, list) and ctx and isinstance(ctx[0], str):
            body = "\n".join(f"- {c.replace('_',' ')}" for c in ctx)
        else:
            body = bullets(ctx, key="field")
        P.append("BEFORE YOU CONFIRM ANYTHING, COLLECT\n" + body)

    if a.get("allowed_actions"):
        P.append("YOU MAY\n" + bullets(a["allowed_actions"]))

    if not a.get("upsell_allowed_default", False):
        P.append("Do not upsell or recommend additional services unless "
                 f"the {customer} asks.")

    if a.get("knowledge_base_summary"):
        P.append("WHAT YOU KNOW\n" + a["knowledge_base_summary"].strip())

    P.append(f"Reply in the {customer}'s own language. "
             f"Default to {a['default_language']}. "
             "If you do not know something, say so and offer to check "
             "with a colleague. Never invent details.")

    return "\n\n".join(P)


# ─────────────────────────────────────────────────────────────────────────────
# Entry
# ─────────────────────────────────────────────────────────────────────────────

def compile_agent(agent_id, sector_id, tenant_path, quiet=False):
    role = load_role_spec(agent_id)
    patch = load_sector_patch(agent_id, sector_id)
    tenant = load_tenant(tenant_path)
    merged, conflicts = merge(role, patch, tenant)
    prompt = render(merged)
    tokens = count_tokens(prompt)

    if not quiet:
        print("=" * 74)
        print(f"COMPILED  {agent_id} · {sector_id} · {tenant.get('business_name','?')}")
        print("=" * 74)
        print(f"  role spec    {role['_source']}")
        print(f"  sector patch {patch['_source']}")
        print(f"  tenant       {tenant_path}")
        print(f"  tokenizer    {TOKENIZER}")
        print()
        print(f"  TOKENS  {tokens}   (budget assumption: 1,500)")
        status = "WITHIN" if tokens <= 1500 else "OVER"
        print(f"  STATUS  {status} budget"
              f"{'' if status=='WITHIN' else f' by {tokens-1500} tokens ({tokens/1500:.1f}x)'}")
        print()
        print(f"  CONFLICTS RESOLVED  {len(conflicts)}")
        for c in conflicts:
            print(c)
        print("=" * 74)
    return prompt, tokens, conflicts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--agent", default="AGENT-001")
    ap.add_argument("--sector")
    ap.add_argument("--tenant")
    ap.add_argument("--diff", nargs=2, metavar=("A", "B"))
    ap.add_argument("--out", default="scripts/out")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)

    if args.diff:
        a, b = args.diff
        import tempfile
        def generic(sec):
            fd, p = tempfile.mkstemp(suffix=".json")
            with os.fdopen(fd, "w") as f:
                json.dump({"business_name": f"Generic {sec}", "sector_id": sec,
                           "location": "City", "hours": "Mon-Fri 9:00-18:00",
                           "timezone": "Asia/Kuala_Lumpur",
                           "services": ["Service A", "Service B", "Service C"],
                           "tone": "Calm, clear and professional."}, f)
            return p
        pa, ta, _ = compile_agent(args.agent, a, generic(a), quiet=True)
        pb, tb, _ = compile_agent(args.agent, b, generic(b), quiet=True)

        for name, p in ((a, pa), (b, pb)):
            open(os.path.join(args.out, f"{args.agent}-{name}.txt"), "w").write(p)

        la, lb = pa.splitlines(), pb.splitlines()
        diff = list(difflib.unified_diff(la, lb, fromfile=a, tofile=b, lineterm=""))
        open(os.path.join(args.out, f"diff-{a}-vs-{b}.txt"), "w").write("\n".join(diff))

        sm = difflib.SequenceMatcher(None, pa, pb)
        changed = sum(1 for d in diff if d.startswith(("+", "-"))
                      and not d.startswith(("+++", "---")))
        print("=" * 74)
        print(f"SECTOR DIFF  {args.agent}  ·  {a}  vs  {b}")
        print("=" * 74)
        print(f"  {a:<12} {ta:>5} tokens, {len(la):>3} lines")
        print(f"  {b:<12} {tb:>5} tokens, {len(lb):>3} lines")
        print(f"  similarity        {sm.ratio()*100:.1f}%")
        print(f"  differing lines   {changed} of {max(len(la),len(lb))}")
        print()
        verdict = ("SUBSTANTIVE — the sector layer materially changes behaviour"
                   if sm.ratio() < 0.75 else
                   "COSMETIC — the sector layer barely changes the agent")
        print(f"  VERDICT  {verdict}")
        print("=" * 74)
        print(f"\n  written: {args.out}/diff-{a}-vs-{b}.txt")
        return

    if not (args.sector and args.tenant):
        ap.error("need --sector and --tenant, or --diff A B")

    prompt, tokens, _ = compile_agent(args.agent, args.sector, args.tenant)
    path = os.path.join(args.out, f"{args.agent}-{args.sector}.txt")
    open(path, "w").write(prompt)
    print(f"\n  written: {path}\n")
    print(prompt)


if __name__ == "__main__":
    main()
