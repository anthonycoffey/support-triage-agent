import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CUSTOMERS } from "../data/customers.js";
import { KB } from "../data/kb.js";
import { TriageDecision, toolInputSchema } from "./schema.js";

const SearchKbInput = z.strictObject({
  query: z.string().describe("Plain-language description of the customer's problem."),
});

const GetCustomerInput = z.strictObject({
  email: z.string().describe("The ticket sender's email address."),
});

export const SUBMIT_TOOL = "submit_triage";

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_kb",
    description:
      "Search the Ledgerly knowledge base. Returns up to 3 articles with id, title and body. " +
      "Call this before citing any article; only cite IDs this tool returned.",
    input_schema: toolInputSchema(SearchKbInput),
    strict: true,
  },
  {
    name: "get_customer",
    description:
      "Look up the account for an email address: plan (free/pro/enterprise), account status and seat count. " +
      "Returns found=false for unknown senders.",
    input_schema: toolInputSchema(GetCustomerInput),
    strict: true,
  },
  {
    name: SUBMIT_TOOL,
    description:
      "Submit the final triage decision. Call exactly once, as your last action. " +
      "The ticket is not triaged until this tool is called.",
    input_schema: toolInputSchema(TriageDecision),
    strict: true,
  },
];

export function searchKb(query: string) {
  const q = query.toLowerCase();
  return KB.map((a) => ({ a, score: a.keywords.filter((k) => q.includes(k)).length }))
    .filter((r) => r.score > 0)
    .sort((x, y) => y.score - x.score || x.a.id.localeCompare(y.a.id))
    .slice(0, 3)
    .map(({ a }) => ({ id: a.id, title: a.title, body: a.body }));
}

export function getCustomer(email: string) {
  const c = CUSTOMERS.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
  return c ? { found: true, ...c } : { found: false };
}

export interface ToolOutcome {
  content: string;
  isError: boolean;
}

/** Executes a read-only tool. Pure over fixtures, so every trial starts from identical state. */
export function executeTool(name: string, input: unknown): ToolOutcome {
  try {
    switch (name) {
      case "search_kb":
        return ok(searchKb(SearchKbInput.parse(input).query));
      case "get_customer":
        return ok(getCustomer(GetCustomerInput.parse(input).email));
      default:
        return { content: `Unknown tool: ${name}`, isError: true };
    }
  } catch (err) {
    return { content: `Invalid input for ${name}: ${(err as Error).message}`, isError: true };
  }
}

function ok(value: unknown): ToolOutcome {
  return { content: JSON.stringify(value), isError: false };
}
