import type Anthropic from "@anthropic-ai/sdk";
import type { CreateParams, Message, ModelClient } from "../src/agent/client.js";
import { formatTicket } from "../src/agent/triage.js";
import type { TriageDecision } from "../src/agent/schema.js";
import { SUBMIT_TOOL } from "../src/agent/tools.js";
import type { EvalCase } from "./case.js";

/**
 * Scripted clients for testing the harness itself, with no network:
 *  - oracle:   retrieves, then submits the gold answer. Must score ~100%, or the harness/grader is broken.
 *  - null:     never submits. Must produce zero decisions, or non-answers are leaking into scores.
 *  - constant: degenerate policy (always "other"/P4/escalate). Must score well below oracle,
 *              or the case set has a shortcut a trivial policy can exploit.
 */

export const ORACLE_REPLIES = {
  en: "Thanks for getting in touch. A member of our support team is reviewing this and will follow up shortly with next steps.",
  es: "Hola, gracias por escribirnos. Un miembro de nuestro equipo está revisando su caso y le responderá pronto con los próximos pasos.",
  pt: "Olá, obrigado pelo contato. Um membro da nossa equipe está analisando o seu caso e em breve retornará com os próximos passos.",
} as const;

export const ORACLE_REPLY = ORACLE_REPLIES.en;

export class OracleClient implements ModelClient {
  readonly name = "oracle";
  constructor(private readonly cases: EvalCase[]) {}

  async create(params: CreateParams): Promise<Message> {
    const c = findCase(this.cases, params);
    if (params.messages.length === 1) {
      return message(params.model, "tool_use", [
        toolUse("get_customer", { email: c.ticket.from }),
        toolUse("search_kb", { query: c.retrieval_query ?? `${c.ticket.subject} ${c.ticket.body}` }),
      ]);
    }
    const decision: TriageDecision = {
      category: c.expected.category,
      priority: c.expected.priority[0]!,
      escalate: c.expected.escalate,
      kb_article_ids: c.expected.kb_any_of ?? [],
      reply_draft: ORACLE_REPLIES[c.expected.reply_language ?? "en"],
    };
    return message(params.model, "tool_use", [toolUse(SUBMIT_TOOL, decision)]);
  }
}

export class NullClient implements ModelClient {
  readonly name = "null";
  async create(params: CreateParams): Promise<Message> {
    return message(params.model, "end_turn", [{ type: "text", text: "I'm not able to triage this.", citations: null }]);
  }
}

export class ConstantClient implements ModelClient {
  readonly name = "constant";
  async create(params: CreateParams): Promise<Message> {
    const decision: TriageDecision = {
      category: "other",
      priority: "P4",
      escalate: true,
      kb_article_ids: [],
      reply_draft: ORACLE_REPLY,
    };
    return message(params.model, "tool_use", [toolUse(SUBMIT_TOOL, decision)]);
  }
}

function findCase(cases: EvalCase[], params: CreateParams): EvalCase {
  const first = params.messages[0]?.content;
  const c = cases.find((x) => formatTicket(x.ticket) === first);
  if (!c) throw new Error("OracleClient: request does not match any eval case");
  return c;
}

let nextId = 0;
export function toolUse(name: string, input: unknown): Anthropic.Beta.BetaToolUseBlock {
  return { type: "tool_use", id: `toolu_scripted_${++nextId}`, name, input } as Anthropic.Beta.BetaToolUseBlock;
}

export function message(
  model: string,
  stopReason: Anthropic.Beta.BetaStopReason,
  content: Anthropic.Beta.BetaContentBlock[],
): Message {
  // Scripted responses only populate the fields the agent loop reads.
  return {
    id: `msg_scripted_${++nextId}`,
    type: "message",
    role: "assistant",
    model,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  } as unknown as Message;
}

export function scriptedClient(name: string, cases: EvalCase[]): ModelClient {
  switch (name) {
    case "oracle":
      return new OracleClient(cases);
    case "null":
      return new NullClient();
    case "constant":
      return new ConstantClient();
    default:
      throw new Error(`Unknown scripted client: ${name}`);
  }
}
