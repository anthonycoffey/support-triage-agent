// PreToolUse hook (Edit|Write|MultiEdit). Exit 2 blocks the tool call and shows stderr to the agent.
//
// Guards the eval's integrity against an agent "fixing" a score by editing the answer key:
//   1. evals/baselines/** and evals/runs/** are written by scripts only.
//   2. An existing case's `expected` block cannot change without a human.
//      New cases and edits to tickets/notes/tags are allowed.
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const ti = input.tool_input ?? {};
if (!ti.file_path) process.exit(0);

const abs = resolve(root, ti.file_path);
const rel = relative(root, abs).replaceAll("\\", "/");

const block = (msg) => {
  process.stderr.write(msg + "\n");
  process.exit(2);
};

if (rel.startsWith("evals/baselines/"))
  block("Baselines are only written by `npm run eval:baseline -- <live-run-dir>`. Do not hand-edit them.");
if (rel.startsWith("evals/runs/"))
  block("evals/runs/ holds run artifacts. Do not edit them; re-run the eval instead.");

if (rel.startsWith("evals/datasets/") && rel.endsWith(".jsonl") && existsSync(abs)) {
  const before = readFileSync(abs, "utf8");
  let after;
  if (input.tool_name === "Write") after = ti.content ?? "";
  else if (input.tool_name === "Edit") after = applyEdit(before, ti);
  else if (input.tool_name === "MultiEdit") after = (ti.edits ?? []).reduce(applyEdit, before);
  else process.exit(0);

  const oldCases = parse(before);
  const newCases = parse(after);
  const changed = [...oldCases].filter(([id, exp]) => newCases.has(id) && newCases.get(id) !== exp).map(([id]) => id);
  const removed = [...oldCases.keys()].filter((id) => !newCases.has(id));
  if (changed.length || removed.length) {
    block(
      [
        "Blocked: this edit changes the gold labels of existing eval cases.",
        changed.length ? `  expected changed: ${changed.join(", ")}` : "",
        removed.length ? `  cases removed: ${removed.join(", ")}` : "",
        "Gold labels change only when a human agrees the label was wrong, never to make a failing run pass.",
        "Stop and tell the user which label you believe is wrong and why (cite the policy in src/agent/prompt.ts).",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
}
process.exit(0);

function applyEdit(text, e) {
  return e.replace_all ? text.split(e.old_string).join(e.new_string) : text.replace(e.old_string, () => e.new_string);
}

/** Map of case id -> canonical JSON of its expected block. Unparseable lines are left to the validator. */
function parse(text) {
  const out = new Map();
  for (const line of text.split(/\r?\n/)) {
    try {
      const c = JSON.parse(line);
      if (c && c.id) out.set(c.id, JSON.stringify(c.expected));
    } catch {}
  }
  return out;
}
