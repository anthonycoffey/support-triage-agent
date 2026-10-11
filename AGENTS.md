# AGENTS.md

Steering for any coding agent working in this repo. Claude Code reads this through `CLAUDE.md`. Other agents (Codex, Cursor, Copilot) read it directly.

## What this is

A support-ticket triage agent for a fictional invoicing product, "Ledgerly". It reads a ticket, looks up the customer, searches the knowledge base, and submits a structured decision: category, priority, escalation, cited KB articles, and a reply draft that a human reviews. The agent is small on purpose. Most of the engineering is in the eval harness that decides whether a change to it ships.

## Commands

```bash
npm run check                         # typecheck + unit tests + dataset validation + harness self-test (offline)
npm test                              # vitest
npm run eval:validate                 # static checks over the case set
npm run eval:selftest                 # oracle / null / constant clients through the real pipeline
npm run eval -- --client oracle       # one scripted run, writes evals/runs/<ts>_<label>/
npm run eval -- --client live --reps 3 --yes   # real model run; costs money, ask first
npm run eval:diff -- <runA> <runB>    # metric deltas + per-case flips
npm run eval:baseline -- <live-run>   # promote a live run (>= 3 reps) to the committed baseline
```

`npm run check` must pass before every commit. It needs no API key.

## Map

| Path | What it holds |
| --- | --- |
| `src/agent/triage.ts` | The agent loop and `buildRequest()`, the single source of the production request shape |
| `src/agent/prompt.ts` | System prompt and `PROMPT_VERSION` |
| `src/agent/tools.ts` | Tool definitions and pure implementations over fixtures |
| `src/agent/schema.ts` | `TriageDecision` schema; the tool's JSON Schema is generated from it |
| `src/data/` | Synthetic KB and customer fixtures |
| `evals/datasets/*.jsonl` | Gold cases. Schema in `evals/case.ts` |
| `evals/graders.ts` | Deterministic atomic graders and policy rules |
| `evals/judge.ts` | Optional LLM judge for reply quality (advisory, not gating) |
| `evals/runner.ts`, `report.ts`, `gate.ts` | Execution, aggregation with CIs, release gate |
| `docs/specs/` | Specs. Read the relevant one before changing behavior |
| `docs/adrs/` | Why the harness is shaped the way it is |

## How work happens here

1. **Spec first.** Behavior changes start as a spec in `docs/specs/` (template: `docs/specs/TEMPLATE.md`). The spec names the eval cases that will prove the change.
2. **Cases before code.** Add the new eval cases first and confirm the current agent fails them, or that they're new coverage. This is TDD for agent behavior.
3. **Change the agent.** Prompt, tools or schema.
4. **Prove it offline.** `npm run check`.
5. **Prove it live.** Ask the user before spending money, then run with `--reps 3` and diff against the baseline. Report the diff, including regressions, in the PR.

## Rules

- **Never edit an eval case's `expected` block to make a run pass.** If you think a gold label is wrong, stop and tell the user which case, what you think the right label is, and which policy line in `src/agent/prompt.ts` supports that. A hook blocks this edit anyway.
- **Bump `PROMPT_VERSION`** in the same change as any edit to `SYSTEM_PROMPT`.
- **Evals call production code.** Never re-implement the request in eval code. Change `buildRequest()` instead.
- **Non-answers are not wrong answers.** Refusals, truncations and missing decisions are separate outcomes. Don't fold them into metric denominators.
- **Live runs cost money.** Never pass `--yes` without the user's go-ahead in this session.
- **Fixtures are synthetic.** Use `.example` domains. No real customer data anywhere in the repo.
- Commit format: `<type>: <description> [SPEC-XXX]` with types `feat`, `fix`, `eval`, `docs`, `refactor`, `test`.
