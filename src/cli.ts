// Triage one ticket from the command line:
//   npm run triage -- --from maria@brightpaws.example --subject "Locked out" --body "..."
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

const result = await triage(
  { from: values.from, subject: values.subject, body: values.body },
  new AnthropicModelClient(),
  DEFAULT_CONFIG,
);

console.log(JSON.stringify({ outcome: result.outcome, decision: result.decision, toolCalls: result.toolCalls.map((t) => t.name) }, null, 2));
