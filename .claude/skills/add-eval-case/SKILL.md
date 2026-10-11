---
name: add-eval-case
description: Add one or more eval cases to the triage dataset. Use when a spec calls for new coverage, when a production failure should become a regression case, or when the user says "add a case", "cover this ticket", or "this should be in the evals".
---

# Add an eval case

Cases are the spec for agent behavior. A bad case costs more than a missing one, because it teaches every future change to optimize toward the wrong answer.

## 1. Decide what the case tests

Write one sentence: "The agent should ___ when ___." If you can't, the case is not ready. Prefer one capability per case so a failure says what broke.

Check the existing set (`evals/datasets/triage.v1.jsonl`) for a near-duplicate. If one exists, strengthen it instead of adding a sibling.

## 2. Derive the gold label from policy, not from a model

Open `src/agent/prompt.ts` and derive `category`, `priority` and `escalate` from the written policy. Never copy what the agent produced as the expected answer, because that rewards imitating the model rather than being right.

- `priority` is a list of every priority a careful reviewer would accept, preferred first. If the acceptable set spans a boundary that flips `escalate` (for example P2 vs P3 for an enterprise sender), the case is ambiguous. Rewrite the ticket until it isn't.
- `kb_any_of` lists the articles a good reply could rely on. Omit it when none apply.
- `must_not` holds case-specific reply patterns that would be harmful, such as leaking another customer's data. Global refund-promise rules already apply.

## 3. Write the ticket like a customer would

- State the symptom, not the diagnosis. Don't put the category name or the answer in the text.
- Use fixture senders from `src/data/customers.ts`, or an unknown `.example` address tagged `unknown-sender`.
- Synthetic only. No real names, companies or data.

## 4. Fill in the row

```json
{"id":"<category>-<short-slug>","tags":["<category>","escalate-yes|escalate-no", "...extra"],"source":"synthetic","ticket":{"from":"...","subject":"...","body":"..."},"expected":{"category":"...","priority":["P3"],"escalate":false,"kb_any_of":["KB-..."]},"notes":"Why the label is what it is, when it isn't obvious."}
```

Append it as a new line. Editing existing cases' `expected` blocks is blocked by a hook. See the root rules.

## 5. Check balance

Every behavior needs both directions. If you add an "escalate" case, consider whether a matching "looks like it should escalate but shouldn't" case exists.

## 6. Verify

```bash
npm run eval:validate     # schema, duplicates, retrievability, label leakage, balance
npm run eval:selftest     # oracle still 100%, null still 0
```

If the change is meant to fix a live failure, confirm the case fails on the current agent with a live run, after asking the user, before changing the agent. A regression case that never failed proves nothing.

## 7. Report

Tell the user the case IDs, the one-sentence intent of each, and any label you were unsure about. Ask them to read the ticket and label once. Human review of gold labels is the cheapest quality control there is.
