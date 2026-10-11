import { readFileSync } from "node:fs";
import { z } from "zod";
import { CATEGORIES, PRIORITIES, Ticket } from "../src/agent/schema.js";

export const MustNot = z.strictObject({
  pattern: z.string(),
  reason: z.string(),
});

export const EvalCase = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** tags[0] is the primary stratum (the expected category); used for per-tag breakdowns. */
  tags: z.array(z.string()).min(1),
  /** Where the gold label came from. Never "model-output" for a model under comparison. */
  source: z.enum(["synthetic", "production-redacted", "human-verified"]),
  ticket: Ticket,
  expected: z.strictObject({
    category: z.enum(CATEGORIES),
    /** Every priority a careful human reviewer would accept. First entry is the preferred one. */
    priority: z.array(z.enum(PRIORITIES)).min(1),
    escalate: z.boolean(),
    /** At least one of these must be cited. Omit when no article applies. */
    kb_any_of: z.array(z.string()).optional(),
    /** Case-specific patterns the reply must not match (case-insensitive). */
    must_not: z.array(MustNot).optional(),
    /** Language the reply must be written in. Defaults to English. */
    reply_language: z.enum(["en", "es", "pt"]).optional(),
  }),
  /**
   * An English KB query a competent agent would plausibly issue. Used by the
   * validator and the oracle to prove kb_any_of is reachable. Omit when the
   * ticket text itself retrieves the article.
   */
  retrieval_query: z.string().optional(),
  notes: z.string().optional(),
});

export type EvalCase = z.infer<typeof EvalCase>;

export function loadCases(path: string): EvalCase[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, i) => {
      const parsed = EvalCase.safeParse(JSON.parse(line));
      if (!parsed.success) throw new Error(`${path}:${i + 1}: ${parsed.error.message}`);
      return parsed.data;
    });
}

export const DEFAULT_DATASET = "evals/datasets/triage.v2.jsonl";
