---
name: run-evals
description: Run the triage eval suite and interpret the results. Use when the user asks to "run evals", "check if this helped", "is this ready to merge", or after any change to the prompt, tools, schema or model config.
---

# Run evals

## 1. Always start offline

```bash
npm run check
```

This covers types, unit tests, dataset validation and the harness self-test. If it fails, stop and fix it. A live run on a broken harness spends money to produce wrong numbers.

## 2. Decide whether a live run is needed

A live run is needed when the change could alter model behavior: prompt, tools, schema, model, effort. Pure refactors of eval code are covered by the self-test.

## 3. Ask before spending

Run without `--yes` first. It prints the case count, reps, model and a cost estimate, then exits:

```bash
npm run eval -- --client live --reps 3
```

Show the user the estimate and get an explicit yes. Then re-run with `--yes`. Add `--tag <tag>` to iterate on a subset, and run the full set before reporting.

Pass `--baseline evals/baselines/triage.v1.<model>.json` when a baseline exists so the gate compares against it.

## 4. Read the report in this order

From `evals/runs/<run>/report.md`:

1. **Errors and outcomes.** Infra errors are excluded from scores. Check that they're few. Any `refusal`, `truncated` or `no_decision` rows are behavior worth reading.
2. **Fallback rows.** If any ran on a fallback model, the headline partly measures a different model.
3. **Policy violations.** Any violation fails the run. Read each one.
4. **Metrics with CIs.** Compare against the baseline and use `npm run eval:diff` for per-case flips. A drop inside the CI is noise. Say so rather than calling it a regression or a win.
5. **Judge scores**, if `--judge` was used. Advisory only until the judge is calibrated (SPEC-002 open question).

## 5. Open transcripts for anything surprising

`evals/runs/<run>/transcripts/<case>__r<rep>.json` holds the full message history, tool calls and decision. A surprising result is more often a case or grader bug than a model fact. Check that before concluding anything.

## 6. Report back

Give the user: the run directory, the gate result, the headline metrics with CIs, cost, and the flipped cases with a one-line diagnosis each. Don't round a within-noise change up to an improvement.
