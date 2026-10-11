import { describe, expect, it } from "vitest";
import type { CreateParams, Message, ModelClient } from "../src/agent/client.js";
import { DEFAULT_CONFIG, buildRequest, triage } from "../src/agent/triage.js";
import { message, toolUse } from "../evals/clients.js";

const ticket = { from: "maria@brightpaws.example", subject: "Locked out", body: "My account is locked after too many password attempts." };
const goodDecision = { category: "account_access", priority: "P2", escalate: false, kb_article_ids: ["KB-101"], reply_draft: "Hi Maria, ..." };

/** Replays a fixed queue of responses and records every request it receives. */
class QueueClient implements ModelClient {
  readonly name = "queue";
  readonly requests: CreateParams[] = [];
  constructor(private readonly queue: Message[]) {}
  async create(params: CreateParams) {
    this.requests.push(structuredClone(params));
    const next = this.queue.shift();
    if (!next) throw new Error("queue exhausted");
    return next;
  }
}

const M = DEFAULT_CONFIG.model;

describe("triage loop", () => {
  it("executes tools, returns all results in one user message, then accepts a valid decision", async () => {
    const client = new QueueClient([
      message(M, "tool_use", [toolUse("get_customer", { email: ticket.from }), toolUse("search_kb", { query: "locked password" })]),
      message(M, "tool_use", [toolUse("submit_triage", goodDecision)]),
    ]);
    const r = await triage(ticket, client);
    expect(r.outcome).toBe("decision");
    expect(r.decision?.category).toBe("account_access");
    expect(r.toolCalls.map((t) => t.name)).toEqual(["get_customer", "search_kb"]);

    const second = client.requests[1]!.messages;
    const toolResults = second[second.length - 1]!;
    expect(toolResults.role).toBe("user");
    expect(Array.isArray(toolResults.content) && toolResults.content.length).toBe(2);
  });

  it("returns a schema error to the model and lets it correct an invalid decision", async () => {
    const client = new QueueClient([
      message(M, "tool_use", [toolUse("submit_triage", { ...goodDecision, priority: "urgent" })]),
      message(M, "tool_use", [toolUse("submit_triage", goodDecision)]),
    ]);
    const r = await triage(ticket, client);
    expect(r.outcome).toBe("decision");
    expect(r.toolCalls[0]).toMatchObject({ name: "submit_triage", isError: true });
  });

  it("distinguishes non-answers from answers", async () => {
    const cases: [Message, string][] = [
      [message(M, "end_turn", [{ type: "text", text: "Done.", citations: null }]), "no_decision"],
      [message(M, "refusal", []), "refusal"],
      [message(M, "max_tokens", []), "truncated"],
    ];
    for (const [response, outcome] of cases) {
      const r = await triage(ticket, new QueueClient([response]));
      expect(r.outcome).toBe(outcome);
      expect(r.decision).toBeUndefined();
    }
  });

  it("stops at the step limit instead of looping forever", async () => {
    const searches = Array.from({ length: 3 }, () => message(M, "tool_use", [toolUse("search_kb", { query: "x" })]));
    const r = await triage(ticket, new QueueClient(searches), { ...DEFAULT_CONFIG, maxSteps: 3 });
    expect(r.outcome).toBe("step_limit");
  });

  it("surfaces bad tool input to the model as an error result, not a crash", async () => {
    const client = new QueueClient([
      message(M, "tool_use", [toolUse("get_customer", { mail: "typo" })]),
      message(M, "tool_use", [toolUse("submit_triage", goodDecision)]),
    ]);
    const r = await triage(ticket, client);
    expect(r.toolCalls[0]?.isError).toBe(true);
    expect(r.outcome).toBe("decision");
  });
});

describe("request shape", () => {
  it("never forces tool_choice and keeps the system prompt cacheable", () => {
    const req = buildRequest(DEFAULT_CONFIG, [{ role: "user", content: "hi" }]);
    expect(req.tool_choice).toEqual({ type: "auto" });
    expect(Array.isArray(req.system) && req.system[0]?.cache_control).toEqual({ type: "ephemeral" });
    expect(req.tools?.every((t) => "strict" in t && t.strict)).toBe(true);
  });
});
