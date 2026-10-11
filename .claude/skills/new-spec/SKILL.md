---
name: new-spec
description: Create a feature spec from the repo template before changing agent behavior. Use when the user describes a new capability, a policy change, or a bug in the agent's decisions, or says "spec this out" or "/new-spec".
---

# New spec

1. Find the next number: list `docs/specs/` and take the highest `SPEC-NNN` + 1.
2. Copy `docs/specs/TEMPLATE.md` to `docs/specs/SPEC-NNN-<kebab-title>.md`. Set `status: draft` and today's date.
3. Fill in **Problem** and **Behavior** from the conversation. Ask the user about anything you would otherwise guess, such as policy thresholds or who owns an escalation path.
4. **Eval plan is mandatory.** List the new case IDs with one-line intents, which existing metrics should move and in which direction, and which must not regress. If the change needs a new metric, describe the grader and its wrong-but-plausible negative test. A spec without an eval plan is not ready.
5. Fill in **Out of scope** so the implementation doesn't sprawl.
6. Show the user the draft. Only after they approve, set `status: ready` and start work with the `add-eval-case` skill.

When the work merges, set `status: complete` and fill in **Outcome** with the before/after numbers and the run directories.
