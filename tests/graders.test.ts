import { describe, expect, it } from "vitest";
import type { TriageResult } from "../src/agent/triage.js";
import { DEFAULT_CONFIG } from "../src/agent/triage.js";
import type { TriageDecision } from "../src/agent/schema.js";
import type { EvalCase } from "../evals/case.js";
import { grade, policyViolations } from "../evals/graders.js";

const c: EvalCase = {
  id: "billing-double-charge-pro",
  tags: ["billing", "escalate-no"],
  source: "synthetic",
  ticket: { from: "jo@quillcafe.example", subject: "Charged twice", body: "Please refund the duplicate charge." },
  expected: { category: "billing", priority: ["P3"], escalate: false, kb_any_of: ["KB-202"] },
};

function result(decision: TriageDecision, retrieved: string[] = ["KB-202"]): TriageResult {
  return {
    outcome: "decision",
    decision,
    promptVersion: "test",
    config: DEFAULT_CONFIG,
    modelCalls: [],
    toolCalls: [{ name: "search_kb", input: {}, output: JSON.stringify(retrieved.map((id) => ({ id }))), isError: false }],
    messages: [],
  };
}

const good: TriageDecision = {
  category: "billing",
  priority: "P3",
  escalate: false,
  kb_article_ids: ["KB-202"],
  reply_draft: "Thanks Jo. Our billing team will review the duplicate charge within 3 business days and follow up.",
};

describe("graders", () => {
  it("passes a correct decision on every metric", () => {
    expect(Object.values(grade(c, result(good))).every((v) => v === true)).toBe(true);
  });

  it("fails a wrong-but-plausible decision on the right metrics only", () => {
    const g = grade(c, result({ ...good, category: "bug", escalate: true }));
    expect(g).toMatchObject({ category: false, escalation: false, priority_acceptable: true, kb_recall: true });
  });

  it("rejects citations the trajectory never retrieved", () => {
    const g = grade(c, result({ ...good, kb_article_ids: ["KB-202", "KB-999"] }));
    expect(g.kb_grounded).toBe(false);
  });

  it("marks kb_recall not-applicable when the case expects no article", () => {
    const { kb_any_of: _omit, ...expected } = c.expected;
    expect(grade({ ...c, expected }, result(good)).kb_recall).toBeNull();
  });

  it("refuses to grade a non-answer", () => {
    expect(() => grade(c, { ...result(good), outcome: "no_decision", decision: undefined })).toThrow();
  });
});

describe("policy rules", () => {
  it.each([
    "We'll refund the duplicate charge today.",
    "I have refunded the second payment.",
    "Your refund has been processed.",
    "You will receive a full refund within 3 days.",
  ])("catches a refund promise: %s", (reply) => {
    expect(policyViolations(c, reply)).not.toHaveLength(0);
  });

  it.each([
    "Our billing team will review the duplicate charge and follow up.",
    "I can't confirm a refund, but billing reviews duplicate charges within 3 business days.",
    "Refund requests are reviewed by the billing team.",
  ])("allows a compliant reply: %s", (reply) => {
    expect(policyViolations(c, reply)).toHaveLength(0);
  });

  it("applies case-specific must_not rules", () => {
    const leaky = { ...c, expected: { ...c.expected, must_not: [{ pattern: "ops@northwind", reason: "leak" }] } };
    expect(policyViolations(leaky, "Contact ops@northwind-freight.example")).toEqual(["leak"]);
  });
});
