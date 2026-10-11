// npm run eval -- --client live --reps 3 --yes
// npm run eval -- --client oracle            (no network)
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { AnthropicModelClient, createAnthropic, type ModelClient } from "../src/agent/client.js";
import { type AgentConfig, DEFAULT_CONFIG } from "../src/agent/triage.js";
import { DEFAULT_DATASET, loadCases } from "./case.js";
import { scriptedClient } from "./clients.js";
import { execute } from "./execute.js";
import { gate } from "./gate.js";
import type { Summary } from "./report.js";
import { costUsd } from "./stats.js";

const { values: a } = parseArgs({
  options: {
    client: { type: "string", default: "live" },
    dataset: { type: "string", default: DEFAULT_DATASET },
    tag: { type: "string" },
    reps: { type: "string", default: "1" },
    concurrency: { type: "string", default: "4" },
    model: { type: "string", default: DEFAULT_CONFIG.model },
    effort: { type: "string", default: DEFAULT_CONFIG.effort },
    "timeout-ms": { type: "string", default: "180000" },
    label: { type: "string" },
    judge: { type: "boolean", default: false },
    baseline: { type: "string" },
    yes: { type: "boolean", default: false },
  },
});

let cases = loadCases(a.dataset);
if (a.tag) cases = cases.filter((c) => c.tags.includes(a.tag!));
const reps = Number(a.reps);
const config: AgentConfig = { ...DEFAULT_CONFIG, model: a.model, effort: a.effort as AgentConfig["effort"] };
const live = a.client === "live";

if (live) {
  // Rough upper bound: ~3 model calls per attempt, ~4k input + 600 output tokens each.
  const perAttempt = costUsd(config.model, { input: 3 * 4000, output: 3 * 600 });
  const estimate = perAttempt === null ? "unknown" : `~$${(perAttempt * cases.length * reps).toFixed(2)}`;
  console.log(`Live run: ${cases.length} cases × ${reps} reps on ${config.model} (${config.effort}). Estimated agent cost ${estimate}${a.judge ? " + judge" : ""}.`);
  if (!a.yes) {
    console.log("Re-run with --yes to spend it.");
    process.exit(1);
  }
}

const client: ModelClient = live ? new AnthropicModelClient() : scriptedClient(a.client, cases);
const { summary, outDir } = await execute({
  label: a.label ?? `${a.client}-${config.model}`,
  dataset: a.dataset,
  cases,
  client,
  config,
  reps,
  concurrency: Number(a.concurrency),
  timeoutMs: Number(a["timeout-ms"]),
  judge: a.judge ? createAnthropic() : undefined,
});

console.log(readFileSync(`${outDir}/report.md`, "utf8"));
console.log(`Run written to ${outDir}`);

const baselinePath = a.baseline;
const baseline = baselinePath && existsSync(baselinePath) ? (JSON.parse(readFileSync(baselinePath, "utf8")) as Summary) : undefined;
const result = gate(summary, baseline);
for (const n of result.notes) console.log(`note: ${n}`);
for (const f of result.failures) console.log(`GATE FAIL: ${f}`);
console.log(result.pass ? "Gate: PASS" : "Gate: FAIL");
process.exitCode = result.pass ? 0 : 1;
