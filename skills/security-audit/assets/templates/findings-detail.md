# Findings Detail: <repo-name>

<!-- One section per confirmed record with overall severity medium, high, or critical, in the order of REPORT.md. Copy from findings.json; do not add claims. Never include a real secret value. -->

## <severity>: <title> (`<fingerprint>`)

### Trace

| # | Kind | Location | Scope | What happens |
|---|------|----------|-------|--------------|
| 1 | entrypoint | `<file>:<line>` | `<scope>` | <description> |
| 2 | propagation | `<file>:<line>` | `<scope>` | <description> |
| 3 | sink | `<file>:<line>` | `<scope>` | <description> |

### Evidence

- `<file>:<line>`: <description>

### Principals

- **Dummy attacker:** <attacker_perspective>
- **Affected dummy resource:** <resource>

### Bounded local reproduction

Input, invocation, or fixture:

```text
<payloads>
```

Steps:

1. <instruction>

Observed output:

```text
<observed_result>
```

Invariant this proves: <intended_behavior is violated because ...>

### Conditions and containment

- <condition kind>: <description>

### Remediation

<strategy>

```text
<file_name>
<fixed_code>
```

Regression case: <the test that fails before the fix and passes after it>
