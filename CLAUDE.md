@AGENTS.md

## Claude Code specifics

- **Skills** in `.claude/skills/` cover the repeatable workflows: `new-spec`, `add-eval-case`, `run-evals`, `investigate-regression`. Use them rather than improvising those flows.
- **Subagent** `eval-case-auditor` (`.claude/agents/`) audits cases read-only. Use it after adding more than a couple of cases, or before promoting a baseline.
- **Hooks** (`.claude/settings.json`):
  - `scripts/hooks/guard-paths.mjs` blocks edits to baselines, run artifacts, and existing gold labels. If it blocks you, don't route around it. Tell the user.
  - `scripts/hooks/post-edit-check.mjs` runs the dataset validator or the typechecker after each edit. Fix what it reports before moving on.
- Directory-level guidance lives in `evals/CLAUDE.md` and `src/agent/CLAUDE.md`. They load when you work in those directories.
