# Diff Review Mode

Use this mode when the user asks for a security review of a pull request, a branch, a commit range, or "my changes". It applies the full evidence bar to a small surface and answers in chat. It is lighter than a scoped full audit: no output directory, no ledger, and no agents are required.

Switch to a scoped full audit (profile `quick`, scope = the diff between two source refs) when the user asks for report files, a findings file, SARIF, or a coverage claim.

## Steps

```text
Diff review progress:
- [ ] 1. Resolve the change
- [ ] 2. Map changed trust boundaries
- [ ] 3. Hunt the changed paths
- [ ] 4. Disprove each candidate
- [ ] 5. Answer
```

### 1. Resolve the change

- Get the base and head refs: `git merge-base <base> HEAD`, then `git diff --stat <merge-base>...HEAD` and `git diff <merge-base>...HEAD`. For a PR number, use the platform CLI only if it is already installed and authenticated, and only to read the diff.
- Record the merge base and head commit so the user can tell what you reviewed.
- Ignore pure formatting, lockfile churn, and generated files unless they change behavior. A lockfile change that adds or replaces a dependency is in scope for the supply-chain companion.

### 2. Map changed trust boundaries

For each changed hunk, ask what it touches:

- **New or changed entry surface:** a route, handler, RPC method, CLI flag, message consumer, file parser, webhook, tool exposed to a model, deep link, IPC endpoint.
- **Changed control:** authentication, authorization, tenant scoping, validation, encoding, rate limiting, CSRF, CORS, cookie flags, signature or token checks, sandbox or permission settings.
- **Changed sink:** queries, shell or process calls, file paths, templates and HTML, redirects, deserialization, outbound requests, crypto calls, logging of sensitive values.
- **Changed configuration:** CI workflows, Dockerfiles, IaC, Kubernetes manifests, dependency manifests, feature flags, default values.

A change can be safe in its own lines and still break an invariant elsewhere. For every changed control or sink, read its callers and the other paths that reach the same effect. Removed code matters as much as added code: a deleted check is a common regression.

Pick the ordinary classes from `references/attack-classes/core.md` and the companions listed in `SKILL.md` whose boundaries the change touches. Read only the sections you need.

### 3. Hunt the changed paths

Follow the core hunting method in `references/workflow/02-hunting.md` (the "Defensive vulnerability-finding method" and the "Candidate gate"), limited to paths that go through changed code. Also check:

- **Parallel paths:** the change fixes or adds a check on one route; does a sibling route, bulk endpoint, export, job, or older API version reach the same effect without it?
- **Default and error paths:** new config keys with insecure defaults, new `catch` branches that fail open, feature flags that skip a check.
- **Tests that pin the wrong behavior:** a changed test that now asserts a permissive result.

Respect the execution rules in `SKILL.md`. Run an existing test only inside the required sandbox; otherwise stay source-only and say so.

### 4. Disprove each candidate

Before reporting, try to refute each candidate as an independent verifier would: re-read every cited line in the head revision, look for the strongest control on the path, and check that the lower-trust principal can actually reach the entry point. If sub-agents are available, give each candidate to a fresh agent with only the diff, the trace, and the candidate-verifier prompt from `references/workflow/03-validation-and-reporting.md`. Without sub-agents, follow `references/modes/single-agent.md` and label any candidate you could not have independently checked as "needs independent check".

### 5. Answer

Answer in the user's language with this structure:

1. **Reviewed:** base and head commits, files reviewed, and anything skipped.
2. **Verdict:** one sentence. "No security issues found in the changed paths" is a valid answer; do not pad it with low findings.
3. **Findings:** for each confirmed issue, severity, `file:line`, the lower-trust principal, the path, the observed or source-proven result, and the smallest fix as a suggested patch.
4. **Needs validation:** each lead with the exact missing fact and how the owner can check it. No severity.
5. **Hardening notes:** optional, clearly separated, and short.

When the user wants review comments, format each finding as one comment anchored to the sink or the missing control line, with the fix as a suggestion block. Posting comments to a PR is an outward action: ask before you post.
