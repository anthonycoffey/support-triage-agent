import { z } from "zod";

export const CATEGORIES = [
  "billing",
  "bug",
  "account_access",
  "feature_request",
  "security",
  "data_request",
  "other",
] as const;

export const PRIORITIES = ["P1", "P2", "P3", "P4"] as const;

export const TriageDecision = z.strictObject({
  category: z.enum(CATEGORIES).describe("The single best-fitting category."),
  priority: z.enum(PRIORITIES).describe("P1 = urgent/widespread, P4 = no time pressure."),
  escalate: z.boolean().describe("True only when the escalation policy requires a human specialist."),
  kb_article_ids: z
    .array(z.string())
    .describe("IDs of knowledge-base articles that support the reply. Only IDs returned by search_kb."),
  reply_draft: z.string().describe("A short reply to the customer, ready for a human agent to review."),
});

export type TriageDecision = z.infer<typeof TriageDecision>;

export const Ticket = z.strictObject({
  from: z.string(),
  subject: z.string(),
  body: z.string(),
});

export type Ticket = z.infer<typeof Ticket>;

/** JSON Schema for a strict tool definition: no $schema key, additionalProperties false. */
export function toolInputSchema(schema: z.ZodType): Record<string, unknown> & { type: "object" } {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return { ...rest, type: "object" };
}
