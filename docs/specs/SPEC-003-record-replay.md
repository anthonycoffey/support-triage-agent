---
id: SPEC-003
title: Record/replay cassettes for offline behavioral regression
status: draft
created: 2026-10-11
---

# SPEC-003: Record/replay cassettes for offline behavioral regression

## Problem

The offline self-test proves the harness works, but not that the agent still behaves. Every behavioral check needs a paid live run, so refactors of the loop, tool plumbing or schema go unverified against real model output until someone spends money.

## Behavior

- `npm run eval -- --client live --record` stores every model response in `evals/cassettes/<prompt_version>/<case>__r<rep>.jsonl`, keyed by a hash of the request body.
- `npm run eval -- --client replay` serves those responses with no network. A request whose hash has no recording fails loudly as a harness error rather than falling through to the network.
- CI runs replay on every PR. A hash miss means the request shape changed, and the PR must either re-record (with approval) or explain the change.

## Eval plan

| New check | Intent |
| --- | --- |
| Replay of a recorded run reproduces its `summary.json` metrics exactly | Replay is faithful |
| A one-byte change to `SYSTEM_PROMPT` produces hash misses on every case | Stale cassettes cannot pass silently |
| Replay never opens a network connection | Enforced by a client that throws on use |

## Design

A `ReplayModelClient` implementing `ModelClient`, so the agent loop is unchanged. Hash over canonical JSON of the request excluding `betas`.

## Out of scope

Fuzzy matching of near-identical requests.

## Open questions

- Do cassettes belong in git (reviewable, but they grow) or in CI artifact storage?
- Should re-recording be limited to the cases whose hash changed?
