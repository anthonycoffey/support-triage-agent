// Compare two run directories: metric deltas plus the cases that flipped.
//   npm run eval:diff -- evals/runs/<before> evals/runs/<after>
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { METRICS } from "./graders.js";
import { gate } from "./gate.js";
import type { Summary } from "./report.js";
import type { ResultRow } from "./runner.js";
import { pct } from "./stats.js";

const [beforeDir, afterDir] = process.argv.slice(2);
if (!beforeDir || !afterDir) {
  console.error("Usage: npm run eval:diff -- <before-run-dir> <after-run-dir>");
  process.exit(1);
}

const load = (dir: string) => ({
  summary: JSON.parse(readFileSync(join(dir, "summary.json"), "utf8")) as Summary,
  rows: readFileSync(join(dir, "results.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as ResultRow),
});
const before = load(beforeDir);
const after = load(afterDir);

console.log(`before: ${before.summary.meta.label} (prompt v${before.summary.meta.prompt_version}, ${before.summary.meta.model})`);
console.log(`after:  ${after.summary.meta.label} (prompt v${after.summary.meta.prompt_version}, ${after.summary.meta.model})\n`);
console.log(`answer rate: ${pct(before.summary.answer_rate.rate)} → ${pct(after.summary.answer_rate.rate)}`);
for (const m of METRICS) {
  const b = before.summary.metrics[m];
  const a = after.summary.metrics[m];
  const delta = a.rate - b.rate;
  console.log(`${m.padEnd(20)} ${pct(b.rate).padStart(7)} → ${pct(a.rate).padStart(7)}  (${delta >= 0 ? "+" : ""}${pct(delta)})`);
}

// Per-case flips, majority vote across reps so a single noisy rep doesn't count as a flip.
const passRate = (rows: ResultRow[], id: string, m: (typeof METRICS)[number]) => {
  const rs = rows.filter((r) => r.case_id === id && r.grades && r.grades[m] !== null);
  return rs.length ? rs.filter((r) => r.grades![m]).length / rs.length : null;
};
const ids = [...new Set(after.rows.map((r) => r.case_id))].sort();
console.log("\nFlipped cases (majority across reps):");
let flips = 0;
for (const id of ids) {
  for (const m of METRICS) {
    const b = passRate(before.rows, id, m);
    const a = passRate(after.rows, id, m);
    if (b === null || a === null) continue;
    if (b >= 0.5 !== a >= 0.5) {
      flips++;
      console.log(`  ${a >= 0.5 ? "FIXED " : "BROKE "} ${id} :: ${m}  (${pct(b)} → ${pct(a)})  transcripts: ${join(afterDir, "transcripts", `${id}__r0.json`)}`);
    }
  }
}
if (!flips) console.log("  none");

const g = gate(after.summary, before.summary);
for (const n of g.notes) console.log(`note: ${n}`);
for (const f of g.failures) console.log(`GATE FAIL: ${f}`);
console.log(g.pass ? "\nGate vs before: PASS" : "\nGate vs before: FAIL");
