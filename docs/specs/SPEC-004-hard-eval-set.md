---
id: SPEC-004
title: Harder eval set (v2) with multilingual and adversarial tickets
status: complete
created: 2026-10-11
---

# SPEC-004: Harder eval set (v2) with multilingual and adversarial tickets

## Problem

The first live baseline (Haiku 5.5, 24 cases × 3 reps, `evals/baselines/triage.v1.claude-haiku-5-5.json`) scored 97–100% on every metric. The set is saturated. It can't tell a cheap model from an expensive one, so it can't support model routing (SPEC-005) or prompt optimization (SPEC-006). Both need headroom.

The one real miss is informative. "We get an error when we click Send on an invoice" was classed as `billing`. The model keyed on the word "invoice" rather than the problem. Real tickets are full of traps like this, and v1 has few of them.

One v1 label was too strict. `feature-sso-enterprise` required citing KB-501, but the policy only asks for citations that support the reply. The user approved dropping that requirement in v2. v1 stays frozen with its baseline.

## Behavior

### Policy additions (prompt v1.1.0)

Gold labels must follow written policy, and v1's policy left two things unwritten:

- **Multi-issue tickets:** categorize and prioritize by the most urgent issue. When two are equally urgent, prefer the one the escalation policy covers.
- **Reply language:** write the reply in the language the customer wrote in.

The prompt deliberately does **not** tell the agent to search the English-only knowledge base in English. That's a strategy, not a policy, and it's left for SPEC-006 to discover.

### New case families (20 cases, tag `hard`)

| Family | Trap it tests | Cases |
| --- | --- | --- |
| Keyword traps | "password" in a phishing ticket; "hacked" in a forgotten-password ticket; "PDF" in a vulnerability report | `hard-phishing-fake-reset`, `hard-not-hacked-forgot-password`, `hard-security-vuln-disclosure` |
| Disguised intent | a bug phrased as a feature request and vice versa; sarcasm | `hard-bug-phrased-as-feature`, `hard-feature-phrased-as-bug`, `hard-sarcastic-double-charge` |
| Buried signal | a security incident at the end of a friendly ramble | `hard-buried-security-alert` |
| Multi-issue | tie-break by urgency, then by escalation | `hard-multi-feature-and-lockout`, `hard-multi-data-and-billing` |
| Escalation boundary | escalation without enterprise (team outage on Pro); enterprise P2 written calmly; loud but low-priority | `hard-pro-team-outage`, `hard-enterprise-calm-blocked`, `hard-loud-but-workaround` |
| Indirect requests | a deletion request that never says GDPR; a chargeback threat | `hard-indirect-erasure`, `hard-chargeback-threat` |
| Subtle injection | a fake "staff note" in a forwarded email; a request to include another customer's contact | `hard-injection-fake-staff-note`, `hard-injection-cross-customer` |
| Multilingual | Spanish and Portuguese tickets. Retrieval needs an English query, and the reply must match the customer's language | `hard-es-lockout-enterprise`, `hard-es-feature`, `hard-pt-double-charge`, `hard-pt-unrecognized-login` |

## Eval plan

- **New metric `reply_language`**: the reply is in the expected language (default `en`). A deterministic detector scores distinctive function words. Unit tests check that it identifies English, Spanish and Portuguese and doesn't mistake Spanish for Portuguese.
- **New optional case field `retrieval_query`**: an English query a competent agent would plausibly issue. The validator and the oracle use it to prove the expected article is reachable, so a case is never unpassable for retrieval reasons.
- **The v2 set has 44 cases** (24 from v1 plus 20 hard), and it becomes the default dataset.
- Success criterion: on v2, Haiku 5.5 scores visibly below 100% on at least two metrics. That gives SPEC-005 and SPEC-006 headroom.
- Noise: 44 cases × 3 reps gives about ±9 points at 1/√(n·R). Use `--tag hard` (20 cases) for cheap iteration.

## Out of scope

Changing v1 or its baseline. Model routing (SPEC-005). Prompt optimization (SPEC-006).

## Outcome

Shipped: v2 has 44 cases, prompt v1.1.0, the `reply_language` metric, and `retrieval_query`. Offline checks are green (37 tests).

**The success criterion was not met.** On v2, Haiku 5.5 (44 cases × 3 reps, $0.05, run `2026-10-11T17-19-21-159Z_v2-haiku`) still scored 100% on category, escalation, policy, grounding and reply language, including all 20 hard cases. The only remaining headroom:

- `priority_preferred` at 84.8%. Every miss was inside the acceptable set, mostly one level more cautious than preferred (security P2 instead of P1).
- `kb_recall` at 94.9%. The main miss is `hard-es-feature` (3/3): the agent searched the English-only KB in Spanish and found nothing. This is the deliberately unwritten strategy gap.

Conclusion: with a clearly written policy, triage is within the cheapest current model's ability. Model routing (SPEC-005) should test whether Opus adds anything, rather than assume it does, and the remaining differences are more likely in reply quality (judge) and cost than in the deterministic labels.