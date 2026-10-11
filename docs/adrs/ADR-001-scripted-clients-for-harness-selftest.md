# ADR-001: Test the eval harness with scripted model clients

- Status: accepted
- Date: 2026-10-11

## Context

An eval harness has bugs like any other code, and harness bugs produce confident wrong numbers. Common ones: infra failures scored as wrong answers, missing answers scored as negative answers, graders that accept anything, and cases nobody could pass. These usually surface only after a paid run, if at all.

## Decision

Put one interface, `ModelClient`, between the agent and the model, and ship three scripted implementations used only by the harness self-test:

- **oracle**: retrieves, then submits each case's gold answer. Expected: 100% on every metric. If not, a case or grader is broken.
- **null**: never submits. Expected: zero decisions, all recorded as `no_decision`. If not, non-answers are leaking into scores.
- **constant**: always "other" / P4 / escalate. Expected: low scores. If it scores well, the case set has a shortcut.

All three drive the real `triage()` loop, tool execution, runner, graders and report.

## Consequences

- The whole pipeline is tested in CI in seconds, with no API key and no cost.
- The oracle doubles as a case-set linter. A case whose expected KB article can't be retrieved fails the self-test before anyone pays to discover it.
- Scripted responses fill only the fields the loop reads, so this tests the harness, not SDK parsing. Live runs and SPEC-003 replay cover that.
