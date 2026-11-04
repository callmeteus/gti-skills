# Local Scanners as Lead Generators

Pattern scanners are fast at finding places worth reading and poor at deciding whether a boundary is crossed. Use them to seed and prioritize work, never to fill the findings table.

## Rules

- **Only tools already installed.** `detect-stack.cjs` lists the ones on PATH. Never install a scanner, download rules, or update a vulnerability database during an audit unless the user asks and approves the network access.
- **Ask before running.** Scanners are third-party programs reading the target. Running them is not target-controlled execution, but they can be slow, write caches, or phone home. Say which tool, which flags, and where output goes, and wait for approval.
- **Offline flags.** Prefer each tool's offline mode, for example `semgrep --metrics=off` with local rule files only, or `trivy fs --offline-scan --skip-db-update`. Check the installed version's `--help` for the exact flag before running. If a tool cannot run offline, do not run it; mention it in the report as an optional owner step.
- **Output outside the target.** Write scanner output to the parent's scratch area in the output directory, never into the repository.
- **Redact.** Secret scanners print matched values. Prefer `gitleaks` with `--redact`. If only TruffleHog is available, pass `--no-verification` so it does not send found credentials to provider APIs, and never quote its raw match fields. Record only file, line, rule, and a short fingerprint of the value.

## Turning output into work

| Scanner result | What to do |
|----------------|------------|
| Code pattern match (Semgrep, Bandit, gosec, Brakeman) | Add the location to the relevant ledger unit's starting paths, or create a unit if the surface is new. The hunter must still trace a lower-trust principal to the sink. |
| Dependency advisory (OSV-Scanner, npm audit, pip-audit, cargo-audit, govulncheck) | A finding only when the vulnerable function or parser is reachable from a lower-trust input in this code. `govulncheck` reports reachability; most others do not. Otherwise list it as a hardening note with the advisory ID. |
| Secret match (Gitleaks, TruffleHog) | Confirm the value is a live credential type (not a placeholder, test key, or public key ID) and who can read the file or history. A committed production credential readable by a lower-trust principal is a confirmed finding; rotation is the fix. |
| IaC or container misconfiguration (Checkov, tfsec, Trivy, Hadolint) | Usually `needs_validation`: the repository expresses intent, the deployment holds the fact. Apply `references/domains/platform/cloud-and-deployment.md` from `SKILL.md`. |
| CI workflow issue (zizmor, actionlint) | Trace who can trigger the workflow and what secrets or write tokens it holds. Apply the supply-chain companion. |

## Reporting

In `REPORT.md`, name the scanners that ran, their versions, and the flags. Count how many scanner hits became confirmed records, `needs_validation` records, or were dismissed. Do not list dismissed hits one by one unless the user asks.
