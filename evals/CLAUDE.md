# Working in evals/

The harness is only useful if its numbers mean what they claim. Before changing anything here, read `docs/specs/SPEC-002-eval-harness.md`.

## Invariants (the self-test and unit tests enforce most of these)

- The oracle client scores 100% on every metric, and the null client produces zero decisions. If a change breaks either, the change is wrong, not the self-test.
- Graders are deterministic and atomic: one property per metric, `null` when not applicable. Don't add blended scores.
- Graders check outcomes, not paths. Don't require a specific tool-call sequence. `kb_grounded` is the exception, and it only checks that cited IDs were actually retrieved, which is cheat-resistance, not path-dictation.
- Infra failures (timeouts, API errors, harness exceptions) go to `errors.jsonl` and are never scored.
- Policy rules are fail-on-any. A mean would let one leaked email hide behind 23 clean replies.
- Every new grader or policy rule needs a test with a deliberately wrong-but-plausible input that it rejects, and a compliant input that it accepts. See `tests/graders.test.ts`.

## Adding cases

Use the `add-eval-case` skill. In short: `tags[0]` is the expected category, tag `escalate-yes` or `escalate-no`, list every acceptable priority, check that `kb_any_of` is retrievable, then run `npm run eval:validate && npm run eval:selftest`.

Keep coverage two-sided. For every behavior there should be cases where the agent should do it and cases where it shouldn't, for example enterprise tickets that should *not* escalate.

## Reading results

Check the answer rate and outcomes before the metrics. A 100% category score on 60% of tickets answered is not a good run. With 24 cases at 1 rep, the noise floor is about ±20 points, so use `--reps 3` or more before drawing conclusions.
