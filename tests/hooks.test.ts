import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DATASET = "evals/datasets/triage.v1.jsonl";
const firstLine = readFileSync(DATASET, "utf8").split(/\r?\n/)[0]!;

function guard(payload: object) {
  return spawnSync("node", ["scripts/hooks/guard-paths.mjs"], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: process.cwd() },
  });
}

describe("guard-paths hook", () => {
  it("blocks hand edits to baselines", () => {
    const r = guard({ tool_name: "Write", tool_input: { file_path: "evals/baselines/x.json", content: "{}" } });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/eval:baseline/);
  });

  it("blocks changing an existing case's gold label", () => {
    const relabeled = firstLine.replace('"escalate":false', '"escalate":true');
    const r = guard({ tool_name: "Edit", tool_input: { file_path: DATASET, old_string: firstLine, new_string: relabeled } });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/access-lockout-pro/);
  });

  it("blocks deleting a case", () => {
    const r = guard({ tool_name: "Edit", tool_input: { file_path: DATASET, old_string: firstLine + "\n", new_string: "" } });
    expect(r.status).toBe(2);
  });

  it("allows appending a new case and rewording a ticket", () => {
    const reworded = firstLine.replace("I need to send invoices today.", "I have invoices due today.");
    const r1 = guard({ tool_name: "Edit", tool_input: { file_path: DATASET, old_string: firstLine, new_string: reworded } });
    expect(r1.status).toBe(0);
    const added = firstLine.replace("access-lockout-pro", "access-lockout-new");
    const r2 = guard({ tool_name: "Edit", tool_input: { file_path: DATASET, old_string: firstLine, new_string: `${firstLine}\n${added}` } });
    expect(r2.status).toBe(0);
  });

  it("ignores unrelated files", () => {
    expect(guard({ tool_name: "Write", tool_input: { file_path: "src/agent/prompt.ts", content: "" } }).status).toBe(0);
  });
});
