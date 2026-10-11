---
name: investigate-regression
description: Diagnose why an eval metric dropped or a case flipped between two runs. Use when the gate fails, when the user asks "why did X get worse", or when eval:diff shows BROKE lines.
---

# Investigate a regression

The goal is to attribute each flip to exactly one cause: **agent change**, **case bug**, **grader bug**, **harness/infra**, or **noise**. Then fix the right layer.

## 1. Get the diff

```bash
npm run eval:diff -- evals/runs/<before> evals/runs/<after>
```

Note the prompt version and model of each run in the header. If they differ in more than one way (for example a prompt change and an effort change), say so. Attribution is ambiguous until one variable is isolated.

## 2. Rule out noise first

For each BROKE case, check its pass rate across reps in both runs. A case that went from 2/3 to 1/3 is not evidence. If the run had one rep, re-run just the affected tag with `--reps 5` (ask the user first, since it costs money) before investigating further.

## 3. Read the transcripts

For each real flip, open `transcripts/<case>__r*.json` in both runs and answer:

- Did the agent call the tools? Did `search_kb` return the expected article?
- What did it submit, and what does the policy in `src/agent/prompt.ts` say it should have submitted?
- Was the decision defensible under a reasonable reading of the policy? If yes, suspect the case (ambiguous ticket or too-narrow acceptable set) rather than the agent.
- Did a grader misfire? Check policy regexes against the actual reply text.

## 4. Classify and act

| Cause | Action |
| --- | --- |
| Agent change | Fix the prompt or tools. Re-run the affected tag, then the full set. |
| Case bug (ambiguous or wrong label) | Stop. Describe it to the user with the policy citation. Label changes need a human; the hook enforces this. |
| Grader bug | Fix the grader and add a unit test reproducing the misfire. Re-score with a fresh run. |
| Harness/infra | Check `errors.jsonl`. Fix the harness and keep the self-test green. |
| Noise | Report it as noise with the CI. No change. |

## 5. Write it up

One line per flipped case: `case_id :: metric :: cause :: evidence (transcript path) :: action`. Put that table in the PR description.
