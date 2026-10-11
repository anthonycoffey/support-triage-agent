import Anthropic from "@anthropic-ai/sdk";

export type CreateParams = Anthropic.Beta.MessageCreateParamsNonStreaming;
export type Message = Anthropic.Beta.BetaMessage;

/**
 * The one seam between the agent and the model. Production and live evals use
 * AnthropicModelClient; the eval harness self-test swaps in scripted clients
 * (evals/clients.ts) that drive the exact same loop with no network.
 */
export interface ModelClient {
  readonly name: string;
  create(params: CreateParams, signal?: AbortSignal): Promise<Message>;
}

export class AnthropicModelClient implements ModelClient {
  readonly name = "live";
  private readonly client: Anthropic;

  constructor(client = new Anthropic({ maxRetries: 4 })) {
    this.client = client;
  }

  create(params: CreateParams, signal?: AbortSignal): Promise<Message> {
    return this.client.beta.messages.create(params, { signal });
  }
}
