// PostToolUse hook (Edit|Write|MultiEdit). Gives the agent immediate feedback:
//   - dataset edits  -> run the case-set validator
//   - .ts edits      -> run the typechecker
// Exit 2 feeds stderr back to the agent so it fixes the problem in the same turn.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const file = input.tool_input?.file_path;
if (!file) process.exit(0);
const rel = relative(root, resolve(root, file)).replaceAll("\\", "/");

let command;
if (rel.startsWith("evals/datasets/") && rel.endsWith(".jsonl")) command = `npx tsx evals/validate.ts --dataset "${rel}"`;
else if (rel.endsWith(".ts") && !rel.startsWith("node_modules/")) command = "npx tsc --noEmit";
else process.exit(0);

try {
  execSync(command, { cwd: root, stdio: "pipe", encoding: "utf8" });
} catch (err) {
  process.stderr.write(`\`${command}\` failed after editing ${rel}:\n${err.stdout ?? ""}${err.stderr ?? ""}`);
  process.exit(2);
}
