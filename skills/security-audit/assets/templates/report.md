# Security Audit Report: <repo-name>

<!-- Derived from findings.json and coverage-ledger.json after Phase 5. Prose never changes a verdict, severity, blocker, or impact. Remove these comments. -->

## Run

| Field | Value |
|-------|-------|
| Source ref | `<commit>` (worktree clean / dirty) |
| Profile | quick / standard / deep |
| Scope | full / scoped: `<paths or refs>` |
| Budget | `<agents spent>` of `<budget>` (or "not set") |
| Run status | complete / incomplete: `<incomplete_reason>` |
| Execution policy | Sandboxed source-and-local-only. No deployed endpoint, external service, or shared environment was contacted. |
| Prior runs used | `<paths>` or "none found" |
| Scanners run | `<tool version flags>` or "none" |

<!-- A quick, scoped, budget-limited, or incomplete run says here, plainly, that it is a partial pass. List unvalidated fingerprints and units, and any mandatory critic that did not run. -->

Carried same-source confirmations: `<fingerprints or none>`. Changed-source revalidations: `<fingerprints or none>`. Deferred and out-of-scope coverage: see Coverage.

## Security posture

<!-- One short paragraph. A clean run says so and stops; do not invent LOW findings. -->

## Confirmed findings

| Severity | Title | Affected boundary | Observed result |
|----------|-------|-------------------|-----------------|
| high | <title> | <boundary> | <one line> |

### <severity>: <title> (`<fingerprint>`)

- **Source location:** `<file>:<line>` (`<scope>`)
- **Lower-trust principal:** <who>
- **Reproduction (bounded, local):** <native input, invocation, or fixture>
- **Conditions:** <conditions>
- **Actual result:** <observed_result>
- **Impact:** <impact reason>
- **Priority rationale:** likelihood <score> (<reason>), impact <score> (<reason>)
- **Smallest source fix:** <strategy and file>

## Needs validation

<!-- No severity. These are leads with an exact missing fact, not vulnerabilities. -->

| Title | Trace | Blocker | Local next step | Owner-observed check |
|-------|-------|---------|-----------------|----------------------|
| <title> | `<file>:<line>` | <exact fact> | <bounded step or n/a> | <safe check or n/a> |

## Hardening notes

<!-- Defense-in-depth suggestions with no reachable boundary violation. Keep separate from findings. -->

- <note>

## Positive patterns

- <control done well, with file reference>

## Coverage

| State | Units |
|-------|-------|
| covered | <n> |
| candidate | <n> |
| blocked | <n> |
| deferred | <n> |
| out_of_scope | <n> |
| not_applicable | <n> |

Important exclusions: <list>. Final coverage critic: <result>. One run never exhausts a target; repeated runs find more.
