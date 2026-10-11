# Working in src/agent/

- `buildRequest()` in `triage.ts` is the production request shape, and the eval harness calls it unchanged. Put model, effort, tools, betas and caching changes there, never in eval code.
- Any edit to `SYSTEM_PROMPT` bumps `PROMPT_VERSION` (semver: patch for wording, minor for policy changes, major for output contract changes).
- The escalation and priority policy in the prompt is the source of truth that gold labels are written against. If you change policy, update the affected eval cases in the same PR. That means a human-approved label change (see the root rules).
- Tool implementations must stay pure over fixtures, with no clock, randomness or network, so every eval trial starts from identical state.
- `TriageDecision` in `schema.ts` generates the `submit_triage` JSON Schema. Change the zod schema and the tool follows. Don't hand-write JSON Schema.
- Current models reject forced `tool_choice` (`any`/`tool`). Keep `auto` and steer from the prompt plus `strict: true` tools.
- Keep the system prompt byte-stable within a version (no timestamps or per-request IDs) so prompt caching holds.
