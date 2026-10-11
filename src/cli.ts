// Triage one ticket from the command line:
//   npm run triage -- --from maria@brightpaws.example --subject "Locked out" --body "..."
import Anthropic from "@anthropic-ai/sdk";
import { parseArgs } from "node:util";
import { AnthropicModelClient } from "./agent/client.js";
import { DEFAULT_CONFIG, triage } from "./agent/triage.js";

const { values } = parseArgs({
  options: {
    from: { type: "string" },
    subject: { type: "string" },
    body: { type: "string" },
  },
});

if (!values.from || !values.subject || !values.body) {
  console.error('Usage: npm run triage -- --from <email> --subject "<subject>" --body "<body>"');
  process.exit(1);
}

try {
  const result = await triage({ from: values.from, subject: values.subject, body: values.body }, new AnthropicModelClient(), DEFAULT_CONFIG);
  console.log(JSON.stringify({ outcome: result.outcome, decision: result.decision, toolCalls: result.toolCalls.map((t) => t.name) }, null, 2));
} catch (err) {
  if (!(err instanceof Anthropic.APIError)) throw err;
  console.error(`Anthropic API error ${err.status ?? ""}: ${err.message}`);
  if (/workspace/i.test(err.message)) console.error("Hint: set ANTHROPIC_WORKSPACE_ID, or use an API key created inside a workspace.");
  // exitCode rather than exit(): exiting while the HTTP agent closes trips a libuv assertion on Windows.
  process.exitCode = 1;
}
