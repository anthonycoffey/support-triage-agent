// Harness self-test: run known-good and known-bad scripted clients through the
// real agent loop, runner, graders and report. No network, no API key, runs in CI.
// If the oracle doesn't ace it, the harness or a case is broken. If the null
// client scores anything, non-answers are leaking into scores. If the constant
// policy scores well, the case set has a shortcut.
import { DEFAULT_CONFIG } from "../src/agent/triage.js";
import { DEFAULT_DATASET, loadCases } from "./case.js";
import { scriptedClient } from "./clients.js";
import { execute } from "./execute.js";
import { METRICS } from "./graders.js";
import { pct } from "./stats.js";

const cases = loadCases(DEFAULT_DATASET);
const failures: string[] = [];
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${msg}`);
  if (!ok) failures.push(msg);
};

async function run(name: string) {
  const { summary } = await execute({
    label: `selftest-${name}`,
    dataset: DEFAULT_DATASET,
    cases,
    client: scriptedClient(name, cases),
    config: DEFAULT_CONFIG,
    reps: 1,
    concurrency: 8,
    timeoutMs: 10_000,
  });
  return summary;
}

const oracle = await run("oracle");
check(oracle.answer_rate.rate === 1, `oracle answers every case (${pct(oracle.answer_rate.rate)})`);
for (const m of METRICS) check(oracle.metrics[m].rate === 1, `oracle scores 100% on ${m} (${pct(oracle.metrics[m].rate)})`);
check(oracle.policy_violations.length === 0, "oracle reply triggers no policy rules");

const nul = await run("null");
check(nul.answer_rate.passes === 0, "null client produces zero decisions");
check(nul.outcomes.no_decision === cases.length, "null client rows are recorded as no_decision, not as wrong answers");

const constant = await run("constant");
check(constant.metrics.category.rate < 0.5, `constant policy category score is low (${pct(constant.metrics.category.rate)})`);
check(constant.metrics.escalation.rate < 0.6, `always-escalate policy is not rewarded (${pct(constant.metrics.escalation.rate)})`);

if (failures.length) {
  console.error(`\nSelf-test failed: ${failures.length} check(s).`);
  process.exit(1);
}
console.log("\nHarness self-test passed.");
