import { METRICS } from "./graders.js";
import type { Summary } from "./report.js";
import { pct } from "./stats.js";

/**
 * Release gate. Hard rules first (fail-on-any), then noise-aware regression
 * checks against a baseline: a drop only counts when it is larger than both a
 * minimum effect size and the combined CI half-widths, so run-to-run noise does
 * not block merges and real regressions do.
 */
export const GATE = {
  minAnswerRate: 0.95,
  maxPolicyViolations: 0,
  minEffect: 0.05,
};

export interface GateResult {
  pass: boolean;
  failures: string[];
  notes: string[];
}

export function gate(current: Summary, baseline?: Summary): GateResult {
  const failures: string[] = [];
  const notes: string[] = [];

  if (current.answer_rate.rate < GATE.minAnswerRate)
    failures.push(`answer rate ${pct(current.answer_rate.rate)} < ${pct(GATE.minAnswerRate)}`);
  if (current.policy_violations.length > GATE.maxPolicyViolations)
    failures.push(`${current.policy_violations.length} policy violation(s)`);

  if (!baseline) {
    notes.push("No baseline: only hard rules were checked.");
    return { pass: failures.length === 0, failures, notes };
  }
  if (baseline.meta.dataset !== current.meta.dataset) notes.push("Baseline was run on a different dataset; deltas are not comparable.");

  for (const m of METRICS) {
    const cur = current.metrics[m];
    const base = baseline.metrics[m];
    if (!cur.n || !base.n) continue;
    const drop = base.rate - cur.rate;
    const noise = (cur.hi - cur.lo) / 2 + (base.hi - base.lo) / 2;
    const threshold = Math.max(GATE.minEffect, noise);
    if (drop > threshold) failures.push(`${m}: ${pct(base.rate)} → ${pct(cur.rate)} (drop ${pct(drop)} > threshold ${pct(threshold)})`);
    else if (drop > GATE.minEffect) notes.push(`${m}: dropped ${pct(drop)}, within noise (${pct(threshold)}). Add reps to resolve.`);
  }
  return { pass: failures.length === 0, failures, notes };
}
