---
id: SPEC-002
title: Eval harness and release gate
status: complete
created: 2026-10-11
---

# SPEC-002: Eval harness and release gate

## Problem

Prompt and model changes to the triage agent are judged by trying a few tickets by hand. That misses regressions in rare, high-cost cases (security routing, refund promises) and can't tell a real improvement from run-to-run noise.

## Behavior

A harness that answers "is this change safe to ship?" with numbers that mean what they say:

1. **Runs production code.** The runner calls `triage()` and `buildRequest()` unchanged.
2. **Separates outcomes.** Each attempt is `decision`, `no_decision`, `refusal`, `truncated` or `step_limit`, or an infra error (`timeout`, `api_error`, `harness`) written to `errors.jsonl`. Quality metrics are computed over decisions only. Answer rate is reported and gated separately.
3. **Atomic deterministic graders:** `category`, `priority_acceptable`, `priority_preferred`, `escalation`, `kb_recall`, `kb_grounded`, `policy_clean`.
4. **Fail-on-any policy rules** for refund promises and case-specific leaks.
5. **Uncertainty everywhere.** Wilson 95% CIs on every rate, `--reps` support, and per-case majority vote in diffs.
6. **Noise-aware gate.** Answer rate ≥ 95%, zero policy violations, and no metric drop larger than max(5 points, combined CI half-widths) vs the baseline.
7. **Self-test without a model.** Oracle, null and constant scripted clients run through the full pipeline in CI (see ADR-001).
8. **Debuggable.** A full transcript per (case, rep). Cost comes from API usage and the served model, and judge cost is tracked separately.
9. **Guarded labels.** A PreToolUse hook blocks agents from editing existing gold labels, baselines, or run artifacts.

## Eval plan

The harness is validated by its own tests:

| Check | Where |
| --- | --- |
| Oracle = 100% on every metric | `npm run eval:selftest` |
| Null client → 0 decisions, recorded as `no_decision` | `npm run eval:selftest` |
| Always-escalate / always-"other" policy scores low | `npm run eval:selftest` |
| Each grader rejects a wrong-but-plausible input and accepts a compliant one | `tests/graders.test.ts` |
| Gate treats small-n drops as noise, large-n drops as regressions | `tests/gate.test.ts` |
| Loop separates non-answers and survives bad tool input | `tests/triage.test.ts` |
| Label-guard hook blocks relabels and deletes, allows additions | `tests/hooks.test.ts` |
| Expected KB articles are retrievable from ticket text | `npm run eval:validate` |

## Design

See ADR-001 (scripted clients) and ADR-002 (manual loop). The LLM judge (`evals/judge.ts`) uses a different model from the agent, atomic boolean criteria, and treats the candidate reply as untrusted data. It is advisory and not part of the gate.

## Out of scope

Pairwise A/B judging, hillclimbing automation, and dashboards.

## Open questions

- **Judge calibration.** The judge is not yet validated against human labels. Before it can gate, label about 40 replies by hand and require ≥ 90% agreement on clear-cut cases.
- **Set size.** At 24 cases the 1-rep noise floor is about ±20 points. Growing to ~100 cases from redacted production tickets would bring 3-rep resolution to about ±6 points.

## Outcome

Shipped in `evals/`. `npm run check` runs typecheck, 29 unit tests, dataset validation and the self-test, offline in about 10 seconds.
