import type Anthropic from "@anthropic-ai/sdk";
import type { CreateParams, ModelClient } from "./client.js";
import { PROMPT_VERSION, SYSTEM_PROMPT } from "./prompt.js";
import { TriageDecision, type Ticket } from "./schema.js";
import { SUBMIT_TOOL, TOOLS, executeTool } from "./tools.js";

export interface AgentConfig {
  model: string;
  effort: "low" | "medium" | "high" | "xhigh";
  maxSteps: number;
}

export const DEFAULT_CONFIG: AgentConfig = {
  model: "claude-opus-5-5",
  effort: "medium",
  maxSteps: 8,
};

/**
 * How a triage attempt ended. Only "decision" carries a decision; every other
 * outcome is a distinct non-answer so evals never score "no answer" as a
 * wrong answer (or as a negative one).
 */
export type Outcome = "decision" | "no_decision" | "refusal" | "truncated" | "step_limit";

export interface ModelCall {
  requestedModel: string;
  servedModel: string;
  stopReason: string | null;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  latencyMs: number;
}

export interface ToolCall {
  name: string;
  input: unknown;
  output: string;
  isError: boolean;
}

export interface TriageResult {
  outcome: Outcome;
  decision?: TriageDecision;
  promptVersion: string;
  config: AgentConfig;
  modelCalls: ModelCall[];
  toolCalls: ToolCall[];
  messages: Anthropic.Beta.BetaMessageParam[];
}

export function formatTicket(t: Ticket): string {
  return `<ticket>\nFrom: ${t.from}\nSubject: ${t.subject}\n\n${t.body}\n</ticket>`;
}

/** Build the request exactly as production sends it. Evals call this same function. */
export function buildRequest(config: AgentConfig, messages: Anthropic.Beta.BetaMessageParam[]): CreateParams {
  return {
    model: config.model,
    max_tokens: 16000,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    tools: TOOLS,
    // Forced tool_choice is rejected on current models; the prompt + strict schema steer instead.
    tool_choice: { type: "auto" },
    output_config: { effort: config.effort },
    // Route policy declines to a fallback model instead of failing the ticket.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages,
  };
}

export async function triage(
  ticket: Ticket,
  client: ModelClient,
  config: AgentConfig = DEFAULT_CONFIG,
  signal?: AbortSignal,
): Promise<TriageResult> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: formatTicket(ticket) }];
  const modelCalls: ModelCall[] = [];
  const toolCalls: ToolCall[] = [];
  const done = (outcome: Outcome, decision?: TriageDecision): TriageResult => ({
    outcome,
    decision,
    promptVersion: PROMPT_VERSION,
    config,
    modelCalls,
    toolCalls,
    messages,
  });

  for (let step = 0; step < config.maxSteps; step++) {
    const started = performance.now();
    const response = await client.create(buildRequest(config, messages), signal);
    modelCalls.push({
      requestedModel: config.model,
      servedModel: response.model,
      stopReason: response.stop_reason,
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cacheRead: response.usage.cache_read_input_tokens ?? 0,
        cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
      },
      latencyMs: Math.round(performance.now() - started),
    });
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "refusal") return done("refusal");
    if (response.stop_reason === "max_tokens") return done("truncated");
    if (response.stop_reason === "pause_turn") continue;

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) return done("no_decision");

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const use of toolUses) {
      if (use.name === SUBMIT_TOOL) {
        const parsed = TriageDecision.safeParse(use.input);
        if (parsed.success) return done("decision", parsed.data);
        const output = `Invalid decision: ${parsed.error.message}. Fix the fields and call ${SUBMIT_TOOL} again.`;
        toolCalls.push({ name: use.name, input: use.input, output, isError: true });
        results.push({ type: "tool_result", tool_use_id: use.id, content: output, is_error: true });
        continue;
      }
      const { content, isError } = executeTool(use.name, use.input);
      toolCalls.push({ name: use.name, input: use.input, output: content, isError });
      results.push({ type: "tool_result", tool_use_id: use.id, content, is_error: isError });
    }
    // All results go back in a single user message, preserving parallel tool use.
    messages.push({ role: "user", content: results });
  }
  return done("step_limit");
}
