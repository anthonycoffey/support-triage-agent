// Static checks over the whole case set. Fast, exhaustive, no model calls.
// Runs in CI and from the PostToolUse hook whenever a dataset file is edited.
import { parseArgs } from "node:util";
import { CUSTOMERS } from "../src/data/customers.js";
import { KB } from "../src/data/kb.js";
import { searchKb } from "../src/agent/tools.js";
import { DEFAULT_DATASET, type EvalCase, loadCases } from "./case.js";
import { ORACLE_REPLIES } from "./clients.js";
import { policyViolations } from "./graders.js";
import { pct } from "./stats.js";

const { values } = parseArgs({ options: { dataset: { type: "string", default: DEFAULT_DATASET } } });

const errors: string[] = [];
const warnings: string[] = [];
let cases: EvalCase[] = [];
try {
  cases = loadCases(values.dataset);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

const kbIds = new Set(KB.map((a) => a.id));
const senders = new Set(CUSTOMERS.map((c) => c.email));
const seenIds = new Set<string>();
const seenBodies = new Map<string, string>();
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

for (const c of cases) {
  if (seenIds.has(c.id)) errors.push(`${c.id}: duplicate id`);
  seenIds.add(c.id);

  const body = norm(c.ticket.body);
  const dup = seenBodies.get(body);
  if (dup) errors.push(`${c.id}: same ticket body as ${dup}`);
  seenBodies.set(body, c.id);

  if (c.tags[0] !== c.expected.category) errors.push(`${c.id}: tags[0] must be the expected category (${c.expected.category})`);

  const wantEsc = c.expected.escalate ? "escalate-yes" : "escalate-no";
  if (!c.tags.includes(wantEsc)) errors.push(`${c.id}: missing tag ${wantEsc}`);

  if (!senders.has(c.ticket.from) && !c.tags.includes("unknown-sender") && c.expected.category !== "other")
    warnings.push(`${c.id}: sender not in fixtures; tag it unknown-sender if intentional`);

  // For enterprise senders, P1/P2 escalates and P3/P4 doesn't (absent other triggers). An acceptable
  // set spanning that boundary makes the escalation label depend on an arbitrary priority choice.
  const plan = CUSTOMERS.find((x) => x.email === c.ticket.from)?.plan;
  const policyEscalates = c.expected.category === "security" || c.expected.category === "data_request" || c.tags.includes("outage");
  const high = c.expected.priority.some((p) => p === "P1" || p === "P2");
  const low = c.expected.priority.some((p) => p === "P3" || p === "P4");
  if (plan === "enterprise" && !policyEscalates && high && low)
    errors.push(`${c.id}: acceptable priorities ${c.expected.priority.join("/")} straddle the enterprise escalation boundary`);

  for (const id of c.expected.kb_any_of ?? []) {
    if (!kbIds.has(id)) errors.push(`${c.id}: kb_any_of references unknown article ${id}`);
  }
  // The expected article must be reachable by retrieval, or the case is unpassable.
  if (c.expected.kb_any_of?.length) {
    const hits = searchKb(c.retrieval_query ?? `${c.ticket.subject} ${c.ticket.body}`).map((a) => a.id);
    if (!c.expected.kb_any_of.some((id) => hits.includes(id)))
      errors.push(`${c.id}: no kb_any_of article is retrievable (search returned ${hits.join(", ") || "nothing"}); add a retrieval_query`);
  }

  for (const rule of c.expected.must_not ?? []) {
    try {
      new RegExp(rule.pattern, "i");
    } catch {
      errors.push(`${c.id}: invalid must_not pattern ${rule.pattern}`);
    }
  }
  // A neutral, policy-compliant reply must pass, or the rules are too strict.
  if (policyViolations(c, ORACLE_REPLIES[c.expected.reply_language ?? "en"]).length) errors.push(`${c.id}: policy rules reject a neutral compliant reply`);

  // Label leakage: the answer should not be stated in the ticket.
  if (new RegExp(`\\b${c.expected.category.replace("_", "[ _]")}\\b`, "i").test(c.ticket.body) && !c.tags.includes("injection"))
    warnings.push(`${c.id}: ticket text contains its own category label`);
}

// Distribution: class balance and both-directions coverage.
const byCategory = new Map<string, number>();
for (const c of cases) byCategory.set(c.expected.category, (byCategory.get(c.expected.category) ?? 0) + 1);
const escalateYes = cases.filter((c) => c.expected.escalate).length;
const majority = Math.max(...byCategory.values()) / cases.length;

console.log(`${cases.length} cases in ${values.dataset}`);
console.log(`categories: ${[...byCategory].map(([k, v]) => `${k}=${v}`).join(", ")}`);
console.log(`majority-class baseline: ${pct(majority)}`);
console.log(`escalate yes/no: ${escalateYes}/${cases.length - escalateYes}`);

if (escalateYes === 0 || escalateYes === cases.length) errors.push("escalation is one-sided: need both escalate and don't-escalate cases");
if (majority > 0.4) warnings.push(`class imbalance: majority class is ${pct(majority)} of cases`);
const noise = 1 / Math.sqrt(cases.length);
console.log(`noise floor at 1 rep ≈ ±${pct(noise)}; at 3 reps ≈ ±${pct(1 / Math.sqrt(cases.length * 3))}`);

for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
if (errors.length) process.exit(1);
console.log("Dataset valid.");
