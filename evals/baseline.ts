// Promote a run's summary to the committed baseline the gate compares against.
//   npm run eval:baseline -- evals/runs/<run-dir>
// Baselines change only through this script (a PreToolUse hook blocks hand edits),
// and only from live runs, so a baseline always reflects a real model run.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Summary } from "./report.js";

const runDir = process.argv[2];
if (!runDir) {
  console.error("Usage: npm run eval:baseline -- <run-dir>");
  process.exit(1);
}
const summary = JSON.parse(readFileSync(join(runDir, "summary.json"), "utf8")) as Summary;
if (summary.meta.client !== "live") {
  console.error(`Refusing: ${runDir} is a '${summary.meta.client}' run. Baselines come from live runs only.`);
  process.exit(1);
}
if (summary.meta.reps < 3) {
  console.error(`Refusing: baseline needs at least 3 reps for a usable noise estimate (run had ${summary.meta.reps}).`);
  process.exit(1);
}
mkdirSync("evals/baselines", { recursive: true });
const dest = join("evals/baselines", `${basename(summary.meta.dataset, ".jsonl")}.${summary.meta.model}.json`);
copyFileSync(join(runDir, "summary.json"), dest);
console.log(`Baseline written: ${dest} (prompt v${summary.meta.prompt_version}, ${summary.meta.cases} cases × ${summary.meta.reps} reps)`);
