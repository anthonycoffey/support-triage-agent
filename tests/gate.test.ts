import { describe, expect, it } from "vitest";
import { gate } from "../evals/gate.js";
import { METRICS } from "../evals/graders.js";
import type { Rate, Summary } from "../evals/report.js";
import { wilson } from "../evals/stats.js";

const r = (passes: number, n: number): Rate => ({ passes, n, ...wilson(passes, n) });

function summary(passes: number, n: number, extra: Partial<Summary> = {}): Summary {
  return {
    meta: { label: "t", client: "live", model: "m", effort: "medium", prompt_version: "1", dataset: "d", cases: n, reps: 1, started_at: "" },
    attempts: n,
    errors: {},
    outcomes: { decision: n },
    answer_rate: r(n, n),
    metrics: Object.fromEntries(METRICS.map((m) => [m, r(passes, n)])) as Summary["metrics"],
    judge: null,
    escalation: { precision: 1, recall: 1, tp: 0, fp: 0, fn: 0 },
    by_tag: {},
    majority_category_baseline: 0.2,
    policy_violations: [],
    fallback_rows: 0,
    cost_usd: 0,
    judge_cost_usd: null,
    mean_model_latency_ms: 0,
    ...extra,
  };
}

describe("wilson interval", () => {
  it("stays inside [0, 1] at the extremes", () => {
    expect(wilson(0, 10).lo).toBe(0);
    expect(wilson(10, 10).hi).toBe(1);
    expect(wilson(10, 10).lo).toBeGreaterThan(0.6);
  });
});

describe("gate", () => {
  it("fails on any policy violation, regardless of scores", () => {
    const g = gate(summary(24, 24, { policy_violations: [{ case_id: "x", rep: 0, reasons: ["refund"] }] }));
    expect(g.pass).toBe(false);
  });

  it("fails when too many attempts produce no answer", () => {
    expect(gate(summary(20, 24, { answer_rate: r(20, 24) })).pass).toBe(false);
  });

  it("treats a small drop on a small set as noise, not a regression", () => {
    const g = gate(summary(21, 24), summary(23, 24));
    expect(g.pass).toBe(true);
    expect(g.notes.join(" ")).toMatch(/within noise/);
  });

  it("flags a large drop on a large set as a regression", () => {
    expect(gate(summary(600, 1000), summary(900, 1000)).pass).toBe(false);
  });
});
