import type { TriageResult } from "../src/agent/triage.js";
import type { EvalCase } from "./case.js";
import { detectLanguage } from "./language.js";

/**
 * Atomic, deterministic graders. Each returns true/false, or null when the
 * metric does not apply to the case. Graders only run on rows whose outcome is
 * "decision"; non-answers are reported as their own outcome, never as a wrong
 * (or negative) answer.
 */
export type Grades = Record<MetricName, boolean | null>;

export const METRICS = [
  "category",
  "priority_acceptable",
  "priority_preferred",
  "escalation",
  "kb_recall",
  "kb_grounded",
  "policy_clean",
  "reply_language",
] as const;

export type MetricName = (typeof METRICS)[number];

/** Reply patterns that are never allowed, regardless of case. */
export const GLOBAL_MUST_NOT = [
  { pattern: String.raw`\b(we|i)('ll| will| have| 've)\s+(refund|credit)`, reason: "Promises a refund or credit" },
  { pattern: String.raw`\brefund\s+(has been|is being|was|will be)\s+(issued|processed|approved|sent)`, reason: "Confirms a refund" },
  { pattern: String.raw`\byou('ll| will)\s+(receive|get|see)\s+(a|your)\s+(full\s+)?(refund|credit)`, reason: "Promises a refund or credit" },
];

export function grade(c: EvalCase, r: TriageResult): Grades {
  const d = r.decision;
  if (r.outcome !== "decision" || !d) throw new Error("grade() called on a non-decision row");

  const retrieved = retrievedKbIds(r);
  const cited = new Set(d.kb_article_ids);
  const kbAnyOf = c.expected.kb_any_of;

  return {
    category: d.category === c.expected.category,
    priority_acceptable: c.expected.priority.includes(d.priority),
    priority_preferred: d.priority === c.expected.priority[0],
    escalation: d.escalate === c.expected.escalate,
    kb_recall: kbAnyOf ? kbAnyOf.some((id) => cited.has(id)) : null,
    // Cheat-resistant: a cited ID only counts if this trajectory actually retrieved it.
    kb_grounded: [...cited].every((id) => retrieved.has(id)),
    policy_clean: policyViolations(c, d.reply_draft).length === 0,
    reply_language: detectLanguage(d.reply_draft) === (c.expected.reply_language ?? "en"),
  };
}

export function policyViolations(c: EvalCase, reply: string): string[] {
  return [...GLOBAL_MUST_NOT, ...(c.expected.must_not ?? [])]
    .filter((rule) => new RegExp(rule.pattern, "i").test(reply))
    .map((rule) => rule.reason);
}

export function retrievedKbIds(r: TriageResult): Set<string> {
  const ids = new Set<string>();
  for (const call of r.toolCalls) {
    if (call.name !== "search_kb" || call.isError) continue;
    for (const article of JSON.parse(call.output) as { id: string }[]) ids.add(article.id);
  }
  return ids;
}
