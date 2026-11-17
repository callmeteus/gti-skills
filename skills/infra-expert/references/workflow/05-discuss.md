# Step 5: work through the chosen candidate

Settle every decision the change needs, one round of questions at a time, before touching code.

## Typical decisions

Every decision opens the ones that depend on it.

- **Name and place:** the base or helper's name and folder, following the repository's naming.
- **Interface:** the variables a caller sets, their types, defaults, and validation; the outputs; what stays fixed inside the base.
- **Differences between the copies:** for each value the copies disagree on, whether it becomes a variable, a fixed default, or a bug to fix. Never pick one silently.
- **Ownership:** which stack owns each shared resource and attachment after the change, and which ones stop managing it.
- **State operations:** which addresses move (`moved` blocks), which resources are imported (`import` blocks), which leave a stack without being destroyed (`removed` blocks with `lifecycle { destroy = false }`).
- **Order and rollout:** which stack changes first, whether environments go one at a time, and who applies.
- **Live changes:** for `live-change` work, the maintenance window, the rollback, and who runs each command.
- **Companion updates:** inventories, catalogs, READMEs, and CI project lists the project rules require.

## Rounds

The open questions are the decisions whose prerequisites are settled. Ask them in one round, numbered, each with your recommended answer, worded so "yes" accepts it. Wait, then compute the next round. A question that depends on another in the same round waits.

```text
**Q1 - Base name:** The six hosts share instance, Elastic IP, security group, and setup key. Name the base `vm-host` in `infra/terraform/modules/vm-host`, next to the existing modules?

Recommended: yes; the repository keeps bases in `modules/`.

---

**Q2 - CPU credits:** Five hosts set `cpu_credits = "unlimited"`, one leaves the default. Make `unlimited` the base default with a variable to override it?

Recommended: yes; the one host without it is a t3 created before the others and has no comment explaining the difference.
```

## Facts are your job, decisions are the user's

- Look up anything the code, state, git history, or a read-only cloud call can answer, instead of asking.
- Put every real choice to the user: a behavior difference, a risk, an ownership change, a window.

## Record lasting decisions

Offer an ADR when a decision is hard to reverse, surprising, and a real trade-off; see [../concepts/project-docs.md](../concepts/project-docs.md). Update `GLOSSARY.md` when a name is settled.

## When to stop

Stop when no question is open and nothing is assumed. Summarize the plan: files to add and change, state operations, what each affected plan should show, companion updates, and what the user will run. Ask the user to confirm before changing anything.
