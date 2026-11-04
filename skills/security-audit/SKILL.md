---
name: security-audit
description: >-
  Defensive, source-first security review for codebases, APIs, services, CLI
  tools, libraries, daemons, apps, and infrastructure code. Three modes:
  guidance for security questions and focused reviews, diff review for a pull
  request or branch, and a full audit that runs coverage-led hunting with
  isolated agents, adversarial validation, a JSON findings file, a coverage
  ledger, Markdown reports, and an optional SARIF export. Use when the user
  asks for a security audit, security review, pen test of the code,
  vulnerability hunt, threat review of a PR, or asks whether some code is
  safe. Do not use for live testing of deployed systems, scanning hosts or
  networks, writing exploits for systems the user does not own, or generic
  code quality review.
compatibility: Node.js 18 or later for the validators and helper scripts. Running target code needs an OS-enforced sandbox; without one the skill stays source-only. Full audits work best in agents with sub-agents.
license: MIT
metadata:
  display-name: Security Audit
  upstream: https://github.com/cloudflare/security-audit-skill
---

# Security Audit

## Core Rule

Always respond in the user's language, regardless of the language used in this skill, the code, or any content you analyze. Report files, JSON field values, and code stay in English unless the user asks otherwise.

Find vulnerabilities that violate a real trust boundary, then give owners the source evidence, safe reproduction, priority, and smallest effective fix. This is a defensive, source-first workflow. A candidate without a concrete affected principal, resource, or security outcome is not a confirmed finding.

## Operating modes

This skill is guidance by default. Loading it does not authorize the complete audit workflow or file creation.

- **Guidance mode:** For security questions, focused reviews, methodology, triage, or investigation of specific findings, use only the relevant parts of this skill. Do not automatically run all six phases, create an output directory, or write audit artifacts. You may launch focused agents when useful; they return results to the current task.
- **Diff review mode:** For "review this PR, branch, or commit range for security", follow [references/modes/diff-review.md](references/modes/diff-review.md). It applies the same evidence bar to the changed code and its callers, answers in chat, and writes files only when the user asks for them.
- **Full audit mode:** Use the complete workflow when the user explicitly asks to audit or pen-test a codebase, asks for a full, comprehensive, or end-to-end security review, or requests report artifacts. Run all six phases and write the files defined below.

If the request could mean more than one mode, ask one focused question before creating files or starting the complete workflow.

## Platform terminology

This skill is agent-neutral:

- **Parent** is the agent that coordinates the run and owns shared state.
- **Task tool** is the platform's delegation or sub-agent mechanism.
- **`research` agent** is a delegated agent for focused source exploration and factual verification.
- **`general` agent** is a delegated agent for broad investigation and bounded local execution.
- **`subagent_type:`** in a heading names which of these two delegated agent roles runs that work.

Use equivalent platform capabilities while preserving role, write-isolation, prompt, and independence boundaries. If the agent has no sub-agents, or they cannot be isolated, follow [references/modes/single-agent.md](references/modes/single-agent.md): it keeps the rule that the agent that found a candidate never confirms it.

## Universal execution safety

These rules apply in every mode. Source inspection is read-only. Run target-controlled builds, tests, processes, browsers, emulators, fuzzers, and fixture processing only inside an OS-enforced sandbox that provides all of these controls:

- no external network; use only an isolated loopback namespace when the check needs local client/server traffic;
- an empty environment populated from an explicit allowlist with safe values, with scratch-local `HOME`, temporary directories, and caches;
- a read-only target and toolchain, with the target-controlled process able to write only inside its assigned `scratch/` directory; and
- explicit low CPU, memory, process, file-size, disk, and wall-clock limits.

The agent, outside the target-controlled process, may make a disposable source copy in an assigned `scratch/` directory when a build must write beside source. In guidance mode, do not retain target-controlled files. In full audit mode, only trusted parent-side code may promote the minimum non-secret result to retained `artifacts/` using the procedure under Write isolation. Never expose a retained output directory (other than the agent's own assigned `scratch/`), another agent's directory, the host home directory, credentials, sockets, or shared services to target code. Do not install dependencies or let builds fetch them. Use only tools and dependencies already available locally. If every control cannot be enforced, do not execute target code: report the missing sandbox capability as a needs-validation blocker and give a safe validation plan.

Use dummy principals, fixtures, and secrets. Do not probe deployed endpoints, external services, shared infrastructure, production identities, other users' data, or live control planes. Do not test availability against a live or shared process, publish artifacts, alter releases, spend paid API quota, or continue beyond the minimum local effect needed to establish a defect. If the decisive fact is outside source or the sandboxed fixture, report it as needing validation.

## Evidence hygiene

- **Never copy a real secret.** When source, history, or fixtures expose a credential, record its file and line, its type, and a fingerprint such as the first four characters plus the length. Never put the full value in chat, `findings.json`, reports, SARIF, or agent prompts. Tell the user to rotate it; deleting it from the current tree does not remove it from history.
- **Scanner output is a lead, not a finding.** Local tools (Semgrep, Gitleaks, OSV-Scanner, and others) can seed candidates. Every candidate still passes the candidate gate and independent validation. See [references/quality/scanner-leads.md](references/quality/scanner-leads.md).
- **Personal data stays out.** Use dummy principals in reproductions. If a fixture or log in the repository holds real personal data, report its location, not its content.

## Full audit setup

In full audit mode, resolve these values before reconnaissance:

- **Skill directory:** the absolute directory containing this `SKILL.md`, written `<skill-dir>` below.
- **Target:** the absolute repository root under review.
- **Repo name:** a stable repository identifier from the directory or local Git remote.
- **Output directory:** a new writable directory outside the target, defaulting to `~/security-audit-skill/<repo-name>/run-<N>`, where `<N>` is the next unused integer. Use a directory inside the target only when the user explicitly selects it and the parent verifies that version control ignores the whole directory. Otherwise stop and request an external path.
- **Source ref:** the reviewed commit and whether the worktree is dirty. Do not treat unreviewed generated or modified files as another revision.

Every bundled script is zero-dependency Node.js and runs the same way on macOS, Linux, and Windows: `node <skill-dir>/scripts/...`.

### Write isolation

The parent creates and is the only writer of shared run files:

- `run-metadata.json`
- `architecture.md`
- `coverage-ledger.json`
- `findings.json`
- `REPORT.md`
- `FINDINGS-DETAIL.md`
- `NEEDS-VALIDATION.md`
- `findings.sarif` (optional, see Phase 6)

Each hunter or verifier receives a unique root under `<output-dir>/agents/<agent-id>/`, with separate `scratch/` and `artifacts/` directories. Canonical agent IDs match `^[a-z0-9][a-z0-9_-]{0,63}$` and must not equal a Windows device name such as `con`, `prn`, `aux`, `nul`, `com1` through `com9`, or `lpt1` through `lpt9`. Lowercase IDs prevent case-fold collisions. The agent and every target-controlled process may write only to `scratch/`; retained `artifacts/` is parent-owned, is never exposed to the sandbox, and is writable only by trusted parent-side promotion code. Agents may not change shared files, target source, retained artifacts, or another agent's directory. Do not use `/tmp` or the host home directory as a writable fallback.

Before execution, the parent opens and retains trusted, non-inheritable directory descriptors for the agent's `scratch/` and `artifacts/` roots, and records an allowlist of expected scratch-relative artifact files plus explicit per-file and cumulative byte limits. Never pass those descriptors to the agent or sandbox. After the sandbox and all its processes terminate, trusted parent-side code promotes each allowlisted file separately:

1. Validate the declared relative path: reject absolute, empty, `.`, `..`, or symlinked components.
2. Walk each parent component from the retained scratch-root descriptor with no-follow directory-relative operations; never reopen by path.
3. Open the leaf no-follow and nonblocking.
4. Verify with `fstat` that it is a regular file with link count exactly one and within the recorded per-file and cumulative byte limits.
5. Enforce those limits again while reading from that descriptor.
6. Copy exactly the verified size, repeat `fstat`, and reject a changed identity, type, link count, or size.
7. For the destination, walk every parent component from the retained artifacts-root descriptor with no-follow directory-relative operations; require each existing component to be a real directory, and create any missing directory exclusively before reopening and verifying it no-follow.
8. Create the leaf exclusively without following links, verify that the opened destination is a regular file with link count exactly one, and copy from the verified source descriptor without reopening either path.
9. Use equivalent race-safe APIs on non-POSIX systems.
10. Never recursively copy or glob scratch, extract an archive into artifacts, or open or promote a symlink, FIFO, socket, device, directory, hard-linked file, changing file, or file that exceeds its bound.
11. If any check is unavailable, cannot be enforced, or fails, discard the scratch entry; if it is decisive evidence, retain `needs_validation` with the exact promotion blocker.

The hunting and validation workflow files carry this procedure as one identical fenced block for hunter and verifier prompts; it states the same rules in the same order as this list.

For a reproduced check, record the command, exact test input, sandbox limits, and only the allowlisted environment variable names plus safe non-secret values needed to reproduce it. Never capture or copy the ambient environment, inherited variables, credential values, authentication state, or unrelated host paths. Launch from an empty environment rather than trying to redact one after execution.

Before delegation, the parent writes `run-metadata.json` with at least `run_id`, `repo`, `target`, `source_ref`, `profile`, `scope_paths`, `budget` (null if unset), `execution_policy: "sandboxed-source-and-local-only"`, selected companion files, prior-run paths, shared-file owners, and `run_status: "in_progress"`. Update metadata only when those facts change; candidate state belongs in the coverage ledger and `findings.json`.

## Full audit planning

The coverage, prior-run, profile, and budget requirements in this section apply only in full audit mode.

### Coverage and prior runs

No one pass is complete. Build a deterministic coverage plan before hunting and update it after every agent result. The reconnaissance workflow defines the stable coverage units and the hunting workflow defines coverage-critic waves. The parent alone updates the ledger.

If prior runs exist, read every compatible `coverage-ledger.json` and `findings.json` before planning the current run:

1. Compare the relevant current source with each prior record and unit. A prior source ref alone is not evidence that a path is unchanged.
2. Carry a prior `confirmed` record into the current candidate set only when its relevant source and conditions are unchanged and its evidence still meets the current contract. Link it to a current ledger unit seeded `planned`, preserve its fingerprint, exclude only that carried root cause from hunters, and send the carried record through the current final verification path; the Phase 3 verifier that re-checks it becomes that unit's assignment owner and moves it to `candidate`.
3. When relevant source for a prior `confirmed` record changed, create a current planned revalidation unit. Do not put that record on the hunter exclusion list. It remains confirmed only if current independent validation establishes the current path and result.
4. Make prior `needs_validation`, `deferred`, `blocked`, `out_of_scope`, and any changed-source unit current work. A still-external `needs_validation` record may be carried only after the current source trace is checked and linked by fingerprint to a current `planned` unit whose verifier re-check supplies its owner and evidence; the record keeps the unresolved blocker. These prior states never suppress a current unit.
5. A prior same-source covered unit may inform priority, but it remains visible in the current ledger. A prior `rejected` record suppresses only the unchanged failed claim, not coverage of its unit; changed evidence creates current work.
6. Read the prior profile and scope. A prior `quick` or scoped ledger contributes only its recorded evidence and gaps, never an implied "rest is fine."

If no prior ledger exists, say so in the final coverage statement. Never imply that one run exhausts the target.

### Run profiles and scope

During full audit setup, pick a profile from the user's request or propose one from the target's size and stakes. Record it in `run-metadata.json` (`profile`, `scope_paths`) and state it in the report. The default is `standard`.

- **`quick`:** a bounded pass for small targets, re-runs, or a fast first look. Coarsen ledger units to surface x boundary x attack class (subsystem uses the fixed canonical `profile/quick/all-in-scope-subsystems` identifier), run exactly one hunter wave followed by exactly one final coverage-critic pass, and use one fresh verifier per candidate for both candidate validation and final record verification. Do not launch a follow-up hunter wave: record the critic's accepted discoveries and reassignments as `deferred`.
- **`standard`:** the workflow as written.
- **`deep`:** for high-stakes or large targets. Split ledger units per subsystem and lifecycle mode, run critic waves to a clean pass, keep candidate validation and final record verification as separate fresh agents, and give `prior_covered_same_source` units an independent second pass.

A **scoped run** audits a subset: named paths, one subsystem, one companion domain, or the diff between two source refs. Seed ledger units only for in-scope surfaces and record everything else as `out_of_scope`, never as `covered`. A scoped or `quick` run must present itself as partial coverage.

Profiles change breadth and redundancy, never the evidence bar. Do not scale away the candidate gate, the source/local execution boundary, `needs_validation` discipline, schema validation, or independent verification of `confirmed` records.

#### Cost budget

The ledger makes spend countable: one unit is roughly one hunter assignment, and one surviving candidate is one or two verifier assignments depending on profile. When the user sets a budget, or the parent proposes one for a large target, record `budget` in `run-metadata.json` as a maximum number of agent invocations across all phases.

Apply the strict budget gate before launching any reconnaissance agent. Reserve the four baseline reconnaissance calls, one final post-wave critic for `quick` or one post-wave plus one distinct final-clean critic for `standard`/`deep`, and at least one verifier call. Add focused reconnaissance only after repeating this gate for each extra call. If the requested budget cannot fund that minimum, launch no agent: ask for a larger budget, narrower scope, or different profile. If the request remains unchanged, set `run_status: "incomplete"` with `incomplete_reason: "budget_cannot_fund_reconnaissance_and_reserves"` and report that no audit pass ran.

Spend it in this order:

1. Count reconnaissance, every post-wave critic, and the separate final-clean critic as agent invocations.
2. **Reserve critics and validation before hunting.** For `quick`, reserve its one post-wave final critic. Before every `standard` or `deep` hunter wave, reserve one immediate post-wave critic plus one distinct final-clean critic. Also reserve verifier cost from the profile (about 1 or 2 agents per expected candidate; when in doubt reserve 30% of the balance after critic reservation). Never assign hunters into either reserve.
3. Assign hunters to units in priority order until the hunting allowance is spent. Spend the reserved post-wave critic immediately after that wave; keep the final-clean and validation reserves intact.
4. Before a later wave, reserve its new post-wave critic again. If the remaining budget cannot cover the required critic calls and validation reserve, launch no hunters from that wave, mark its planned units `deferred` with reason `budget_cannot_reserve_critics_and_validation`, and use the retained final-clean critic to record the resulting gap.

Before wave 1, update the pre-recon estimate with seeded units, implied hunter count, mandatory critic calls, validation reserve, and whether the remaining budget covers the plan. If it clearly cannot, say so and propose either a tighter scope or a coarser profile instead of silently thinning evidence. If later facts consume the required final-critic reserve, launch no hunters, mark all planned work deferred, set the run incomplete with reason `critic_budget_exhausted`, and make no complete-coverage claim.

A strict total-agent budget can still be exceeded by an unexpectedly large candidate set or by a material Phase 5 replacement that needs another independent verifier. If the remaining budget cannot validate every candidate, stop hunting, validate candidates in fingerprint order while the budget permits, and set `run_status: "incomplete"` plus `incomplete_reason: "validation_budget_exhausted"`. Keep each unvalidated fingerprint linked to a `candidate` ledger unit with that unresolved reason. Do not put an unvalidated candidate in `findings.json`, relabel it `needs_validation`, or report the run as complete. Phase 6 may produce a partial report only if its first section states that candidate validation is incomplete and lists the affected fingerprints and units. Never exceed a user-set strict budget silently.

## Core principles

### Require a boundary and result

For every candidate, name the lower-trust principal, accepted input or action, intended control, crossed boundary, affected principal or resource, and concrete observed or owner-observable result. Do not elevate a missing best practice, guessed deployment behavior, generic parser crash, or self-impact into a security finding.

### Use bounded local evidence

Static analysis establishes the source path. Sandboxed local tests resolve behavior when all execution controls are available: a minimal function harness, existing unit test, small parser fixture, dummy-tenant integration test, locally rendered configuration, or bounded isolated-loopback client. Stop at a wrong return value, unauthorized dummy record, sanitizer finding, policy difference, or other minimum effect. Do not extend the local check beyond the minimum boundary result or produce persistence, post-fault, or concealment material.

### Respect source visibility

Deployment controls, proxy behavior, provider settings, browser headers, identity policy, broker ACLs, packaging, and topology are real controls. If they are required and absent from the repository, do not assume either presence or absence. Use `needs_validation` with the exact missing fact and a safe owner-observed or local plan.

### Separate priority from certainty

Only `confirmed` records receive severity. Likelihood and impact must reflect the demonstrated conditions and result; overall severity cannot exceed demonstrated impact. `needs_validation` means a specific source-grounded boundary hypothesis is blocked, not a low-confidence confirmed vulnerability, and it has no severity.

Calibrate overall severity with these anchors:

- **critical:** an unauthenticated actor gains code execution, full data-store access, or takeover of arbitrary accounts.
- **high:** an actor fully defeats an explicit security control with real consequences: authentication bypass, cross-tenant read or write, stored script execution affecting other users, authenticated code execution, or an unauthenticated remote stop of a shared service.
- **medium:** a real boundary violation with limited blast radius, uncommon preconditions, or consequences confined to a narrow resource set.
- **low:** disclosure of non-secret internals, or an effect requiring sustained effort for minimal gain.
- **informational:** a confirmed but minimal-impact observation, useful mainly as a prerequisite inside a larger finding.

The high/medium discriminator: does the demonstrated result fully defeat an explicit control for an action with real consequences, or only weaken it? If you cannot state the concrete damage, the severity is lower than it feels.

### Recommend the smallest effective source fix

For each confirmed finding, identify the invariant the code must enforce and the narrowest source change that enforces it at the last trusted decision point. Prefer specific repository-relative changes and regression tests over generic hardening advice. The audit describes fixes; it does not modify target source.

## Full audit workflow

In full audit mode, follow all six phases in order:

1. **Reconnaissance:** start with the read-only inventory `node <skill-dir>/scripts/recon/detect-stack.cjs <target> --format text`, then map the source, trust boundaries, local build paths, companion selections, prior evidence, and initial deterministic coverage ledger with [references/workflow/01-reconnaissance.md](references/workflow/01-reconnaissance.md).
2. **Coverage-led hunting waves:** assign isolated hunters from the ledger and collect structured candidate results with [references/workflow/02-hunting.md](references/workflow/02-hunting.md), the ordinary classes in [references/attack-classes/core.md](references/attack-classes/core.md), and the selected domain companions below.
3. **Candidate validation:** consolidate fingerprints and give every candidate to a fresh source verifier as defined in [references/workflow/03-validation-and-reporting.md](references/workflow/03-validation-and-reporting.md).
4. **Structured output:** write all final `confirmed`, `needs_validation`, and `rejected` records to `findings.json`; validate it with `assets/schema/report-schema.json` and `node <skill-dir>/scripts/validate/validate-findings.cjs`, and validate the coverage claim with `node <skill-dir>/scripts/validate/validate-coverage-ledger.cjs`.
5. **Independent record verification:** use fresh agents to verify final source claims and reconcile corrections or state changes.
6. **Target-neutral report:** derive `REPORT.md`, `FINDINGS-DETAIL.md`, and `NEEDS-VALIDATION.md` from the final records with the templates in [assets/templates/](assets/templates/), with no live-probe instructions. When the user wants code-scanning alerts, also run `node <skill-dir>/scripts/export/findings-to-sarif.cjs <output-dir>/findings.json --out <output-dir>/findings.sarif`.

Do not end the run before one of exactly two terminal states: (a) all Phase 6 artifacts are written and both validators pass, or (b) `run_status: "incomplete"` is recorded with its exact reason and the gap is disclosed in the report. Never stop mid-phase.

### Domain companions

`detect-stack.cjs` lists companions worth checking. Select one only when reconnaissance finds the trust boundary its "When to use this file" section describes, never because a dependency name appears. Each companion is used alongside the core classes, not instead of them.

| Companion | Select when the target has |
|-----------|----------------------------|
| [web-protocol-and-auth.md](references/domains/application/web-protocol-and-auth.md) | HTTP parsing, caching, sessions, CSRF, JWT, OAuth/OIDC, SAML, MFA, passkeys, recovery, API keys, mTLS |
| [client-side.md](references/domains/application/client-side.md) | SPAs, browser extensions, webviews, service workers, browser storage, `postMessage`, CORS, WebSockets, DOM rendering |
| [ai-and-llm.md](references/domains/application/ai-and-llm.md) | Chatbots, RAG, agent memory, tool calling, MCP servers or clients, prompt assembly, model-driven actions |
| [protocols-rpc-and-messaging.md](references/domains/application/protocols-rpc-and-messaging.md) | gRPC, GraphQL transports, Protobuf, custom protocols, queues, brokers, pub/sub, webhooks, streaming RPC |
| [data-isolation-and-lifecycle.md](references/domains/application/data-isolation-and-lifecycle.md) | Multi-tenant stores, caches and search, object links, export, backup, migration, deletion, retention |
| [memory-safety-and-binary.md](references/domains/platform/memory-safety-and-binary.md) | C, C++, Objective-C, Rust `unsafe`, FFI, kernel code, parsers, loaders, JITs, firmware |
| [supply-chain-and-release.md](references/domains/platform/supply-chain-and-release.md) | Dependency resolution, CI, release, signing, promotion, updates, plugins, extensions |
| [cloud-and-deployment.md](references/domains/platform/cloud-and-deployment.md) | IAM, infrastructure as code, containers, Kubernetes, service mesh, serverless, edge, ingress |
| [resource-exhaustion-and-availability.md](references/domains/platform/resource-exhaustion-and-availability.md) | Untrusted work that consumes shared CPU, memory, disk, connections, workers, queues, quotas, or spend |
| [desktop-mobile-and-local-ipc.md](references/domains/platform/desktop-mobile-and-local-ipc.md) | Native apps, deep links, webview bridges, exported components, privileged helpers, local daemons, IPC |

Ledger block references use these paths, for example `references/attack-classes/core.md#Access control` or `references/domains/application/client-side.md#Core discipline`.

## After the audit

The audit never edits target source. When the user then asks you to fix a confirmed finding:

1. Fix one fingerprint at a time, starting from the highest severity.
2. Write the regression case from `FINDINGS-DETAIL.md` as a failing test first, then apply the smallest source fix that enforces the invariant. If the `better-tests` skill is installed, follow its bug-reproduction workflow.
3. Re-run the regression test and the existing suite. Re-check the fix against the original trace; a fix that moves the trust decision instead of enforcing it is not a fix.
4. Offer a `scoped` re-run on the changed paths so the prior-run logic revalidates the record.

## Anti-patterns

1. Checklist deviations presented as vulnerabilities.
2. Defense-in-depth advice with no reachable boundary violation.
3. Live or shared-environment testing where bounded local evidence is insufficient.
4. Guessing provider, proxy, browser, identity, or deployment behavior not present in source.
5. Treating intended same-principal authority or self-impact as a cross-boundary result.
6. Reporting a parser or runtime effect stronger than the observed effect.
7. Emitting prose-only hunter results that cannot be deduplicated or verified.
8. Re-reporting carried same-source prior confirmed records or using them as exemplars that anchor the hunt.
9. Assigning severity to `needs_validation` records.
10. Writing the report before independent verification or letting prose and JSON disagree.
11. Pasting scanner output, CVE lists, or dependency advisories as findings without a reachable path in this code.
12. Echoing a discovered secret, token, or personal record in chat, prompts, or reports.
13. Letting the agent that found a candidate also confirm it, including in a single-agent run.

## Resources

| Path | Purpose |
|------|---------|
| `references/workflow/` | Phase 1 reconnaissance, Phase 2 hunting, Phases 3 to 6 validation and reporting |
| `references/attack-classes/core.md` | Core, wildcard, and obvious-things attack classes |
| `references/domains/` | Ten domain companions, split into `application/` and `platform/` |
| `references/modes/` | Diff review and single-agent operation |
| `references/quality/` | Using local scanners as lead generators |
| `assets/schema/report-schema.json` | JSON schema for the three `findings.json` verdicts |
| `assets/templates/` | `REPORT.md`, `FINDINGS-DETAIL.md`, and `NEEDS-VALIDATION.md` skeletons |
| `scripts/validate/` | Zero-dependency validators for `findings.json` and `coverage-ledger.json` |
| `scripts/recon/detect-stack.cjs` | Read-only stack, companion, and tool inventory |
| `scripts/export/findings-to-sarif.cjs` | SARIF 2.1.0 export of validated findings |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.
