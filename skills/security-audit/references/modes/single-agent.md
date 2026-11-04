# Single-Agent Operation

Some coding agents have no sub-agents, or their sub-agents share context with the parent so they are not independent. This file keeps the skill's guarantees in that setting. The central rule does not change: **the agent that found a candidate never confirms it.**

## What changes and what does not

| Stays the same | Changes |
|----------------|---------|
| Evidence bar, candidate gate, verdict definitions | Hunting runs as sequential passes by one agent |
| Execution sandbox rules | Each pass is a fresh read of source, not a recall of earlier passes |
| Schema, validators, ledger state table | Independent verification moves to a separate session |
| No severity on `needs_validation` | A run cannot be `complete` until verification happens |

## Guidance and diff review

1. Hunt in passes, one attack class or boundary per pass. Write each candidate down in the structured hunter shape from `references/workflow/02-hunting.md` before moving on.
2. After hunting, run a **disprove pass**: for each candidate, re-open every cited file at the cited lines, search for the strongest control on the path, and argue the case against the candidate before deciding.
3. Report candidates that survive as findings, but say plainly that they were self-checked. Offer the verification packet below if the user wants an independent check.

## Full audit

Run phases 1 and 2 sequentially in this session. Treat yourself as both parent and hunter, but keep the write-isolation layout: use one agent ID per pass (for example `solo-hunt-w1-u003`) and its own `scratch/`, so ledger checks still record who reviewed what.

Phases 3 and 5 need a verifier that did not hunt. Do not perform them in the hunting session. Instead:

1. Write one **verification packet** per candidate to `<output-dir>/verification/<fingerprint>.md`. Include exactly what a Phase 3 verifier receives: the candidate record, linked ledger checks and artifact paths, the architecture facts needed to read the path, the relevant companion validation blocks, the execution boundary, the promotion procedure block, the candidate-verifier prompt, and the three schema branches copied verbatim. Never include your own reasoning about why it is true.
2. Set `run_status: "incomplete"` with `incomplete_reason: "independent_verifier_unavailable"` in `run-metadata.json`. Keep every candidate as a `candidate` ledger unit; none enters `findings.json` yet.
3. Write a partial `REPORT.md` whose first section says candidate validation has not run and lists the fingerprints and packet paths. Do not call any candidate a finding.
4. Tell the user how to finish: open a new session (a new chat or a new agent process with no access to this conversation), load this skill, and ask it to "verify the packets in `<output-dir>/verification/`". That session acts as a verifier with its own agent ID (for example `verifier-01`), returns the JSON decision for each packet, and the parent work (writing `findings.json`, running both validators, Phase 5, and Phase 6) continues in that session or a third one.

A second session started by the user is independent enough for Phase 3 because it has not seen the hunt. Phase 5 needs another fresh session for each record whose verdict or impact changed materially, following the rules in `references/workflow/03-validation-and-reporting.md`.

## When to suggest a different agent

If the target is large (hundreds of coverage units), a single-agent full audit will be slow and its context will fill. Suggest one of these instead:

- a `quick` profile or a scoped run on the riskiest subsystem;
- diff review on recent changes;
- running the full audit in an agent that supports isolated sub-agents.
