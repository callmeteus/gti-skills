# Needs Validation: <repo-name>

<!-- One section per needs_validation record, highest-value lead first. No severity. Do not turn these into live test guidance or assume the missing deployment fact. -->

## <title> (`<fingerprint>`)

**Claimed root cause:** <claimed_root_cause>

**Affected boundary:** <principal, resource, and control>

### Source trace

| # | Kind | Location | Scope | What happens |
|---|------|----------|-------|--------------|
| 1 | entrypoint | `<file>:<line>` | `<scope>` | <description> |

### Verified evidence

- `<file>:<line>`: <description>

### Exact blocker

- <the fact that source and the local sandbox cannot establish>

### How to resolve it

- **Local (bounded fixture):** <validation_plan.local, or "not applicable">
- **Owner-observed (no audit traffic):** <validation_plan.deployment, or "not applicable">

If the owner confirms the condition, re-run the audit with the answer so an independent verifier can promote or reject this lead.
