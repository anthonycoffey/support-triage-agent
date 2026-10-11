# ADR-002: Manual agent loop instead of the SDK tool runner

- Status: accepted
- Date: 2026-10-11

## Context

The Anthropic SDK's tool runner would drive the tool loop for us. The eval harness, though, needs to (a) swap the model transport for scripted and replay clients, (b) record per-call served model, usage and latency, and (c) end the loop on a terminal `submit_triage` call, with distinct outcomes for refusal, truncation and missing decisions.

## Decision

Own the loop in `src/agent/triage.ts` (about 60 lines), behind the `ModelClient` interface. `buildRequest()` is the single definition of the production request, and evals call it unchanged.

## Consequences

- Transport is injectable, so scripted and replay clients need no network mocking.
- Every outcome the gate cares about is explicit in the type system (`Outcome`).
- We maintain the loop ourselves: `pause_turn`, parallel tool results in one message, and the step limit. Unit tests cover each in `tests/triage.test.ts`.
- If the loop ever needs streaming or compaction, revisit this. The tool runner supports both.
