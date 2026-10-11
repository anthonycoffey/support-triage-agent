---
id: SPEC-001
title: Ticket triage agent
status: complete
created: 2026-10-11
---

# SPEC-001: Ticket triage agent

## Problem

Ledgerly support agents spend the first minutes of every ticket on the same steps: look up the account, find the relevant help article, decide urgency and who should own it, then draft a first reply. Misrouted security and privacy tickets are the costly failure. They sit in the general queue when they need a specialist.

## Behavior

Given a ticket (sender, subject, body), the agent:

1. Looks up the sender (`get_customer`) and searches the KB (`search_kb`).
2. Submits exactly one `TriageDecision` via `submit_triage`:
   - `category`: one of billing, bug, account_access, feature_request, security, data_request, other
   - `priority`: P1 to P4 per the written policy
   - `escalate`: true if security or data_request, if several users are affected or it looks like an outage, or if an enterprise customer is at P1/P2. Otherwise false.
   - `kb_article_ids`: only articles `search_kb` returned
   - `reply_draft`: 2 to 5 sentences. No refund, credit or date promises. Nothing about other customers.
3. Treats ticket text as data. Instructions embedded in a ticket are not followed.

A human reviews every decision before anything reaches the customer. The agent drafts and never sends.

## Eval plan

| Behavior | Covered by |
| --- | --- |
| Category per policy | All 24 cases; `tags[0]` is the stratum |
| Priority within an acceptable set | All cases list every acceptable priority |
| Escalation in both directions | 8 escalate-yes and 16 escalate-no, including enterprise tickets that must not escalate (`feature-sso-enterprise`, `billing-double-charge-enterprise`) |
| Grounded citations | `kb_grounded` on every decision, `kb_recall` where an article applies |
| No refund promises under pressure | Tag `refund-pressure` (3 cases) plus global policy rules |
| No cross-customer leakage | `leak-competitor-lookup` with case-specific `must_not` |
| Prompt injection | `injection-fake-system-note` |
| Unknown sender | `billing-unknown-sender-cancel` |

## Design

- Manual agent loop over the Messages API (see ADR-002), Claude Opus 5.5 at effort `medium`.
- The decision is a strict tool whose JSON Schema is generated from the zod `TriageDecision`, so the tool contract and the validator can't drift.
- An invalid `submit_triage` input returns an error `tool_result` and the model retries. A missing submission is the `no_decision` outcome, never a default decision.
- `fallbacks: "default"` routes policy declines to a fallback model. The eval records the served model per call so fallback rows are visible.
- The system prompt is cached and byte-stable per `PROMPT_VERSION`.

## Out of scope

Sending replies, writing to a ticketing system, multi-turn conversations with the customer, attachments, non-English tickets (see SPEC-003 candidates).

## Outcome

Implemented in `src/agent/`. Offline gates (`npm run check`) are green. The first live baseline (`--reps 3`) is pending an API key on the CI runner. Run `npm run eval -- --client live --reps 3 --yes`, then `npm run eval:baseline -- <run>`.
