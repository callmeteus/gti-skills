# Area: CVE triage

Take a vulnerability from a CVE ID, an advisory URL, a vendor plus "recent", or a sweep request, decide which services in the project are affected, and write one report per run with the records the project keeps. Read this file when the request is about a CVE or a vulnerability sweep. The project specifics are not in this skill. They live in the project's `.gti/infra-expert/` folder: read `records.md` (where records go and which cases get one), `hosts.md` (which hosts to read and how), `access.md` (the access ladder), and `mcp.md` (the project's read-only tools) before reading a host.

Nothing in this area changes a system. Upgrades are left to the user as a separate maintenance task.

## Steps

### 1. Intake

- Accept a CVE ID such as `CVE-2026-12345`, an advisory URL, a vendor plus "recent" (for example "the recent NGINX CVE"), or a sweep request such as "sweep our inventory for new CVEs".
- For one CVE, write down the exact ID and the component named in the request.
- For a vendor plus "recent", find the candidate IDs in the vendor advisory first and list them in the scope of the run.
- For a sweep, the component list comes from the project inventory named in `.gti/infra-expert/records.md`. Use only components in that inventory. Do not add a component because a feed mentioned it.
- Put the scope and the component list into the findings JSON before reading any host.

### 2. Facts from primary sources

- For each ID read the vendor advisory, NVD, OSV, the distribution tracker (Ubuntu or Debian), and the CISA KEV catalog.
- [cve_lookup.py](../../scripts/cve/cve_lookup.py) fetches OSV and KEV. Read the other sources yourself.
- Record the affected range, the fixed versions, the condition the attack needs (feature, module, config directive, or exposure), CVSS from each source, and the KEV status with its `dateAdded`.
- A floating image tag such as `latest` or `2` is not a version. Take versions from the binary on the host, not from a tag.

  ```bash
  python3 <skill-dir>/scripts/cve/cve_lookup.py osv --id CVE-2026-12345
  python3 <skill-dir>/scripts/cve/cve_lookup.py query --ecosystem Debian:12 --package nginx --version 1.31.8
  python3 <skill-dir>/scripts/cve/cve_lookup.py kev --id CVE-2026-12345
  ```

- Use `--from-file PATH` on any command to read a saved JSON response instead of the network, for offline work.
- On a scheduled run use `query --state` so only IDs not in `seen` are returned.

### 3. Map to the inventory

- List every service that uses the component, including components embedded in other software: an OpenResty that embeds NGINX, a runtime inside a container image, or a library linked into a binary.
- Use the inventory named in `records.md` as the source of service names. Mark each mapping as read from the inventory or inferred from an image.
- If a service has no host mapping, put it in Not checked with the reason instead of guessing a host.

### 4. Read the live version and the condition

- Read only, through the access ladder: the project's MCP read-only tools named in `mcp.md` first, then the project's CLI named in `access.md`, then vendor CLIs such as `nginx -v`, `docker version`, or `uname -r`. Follow `hosts.md` for which hosts to read and how.
- Make one batched read per host. Ask for every command that host needs in a single call, then read the outputs. Do not open a new session for each check.
- Take the version from the binary or process. If the binary cannot be read, keep the inventory value and mark the service `not-checked` with the reason.
- Take the condition from the live config or runtime: directive present, module loaded, feature built, or port exposed. Write the observed condition as a short phrase, not as a paragraph.
- Never run a command that writes, changes a config, or restarts a service.

### 5. Classify

Give each service exactly one status from this vocabulary:

- `affected`: version in the affected range and the condition is on.
- `possible`: version in range, condition off, but one config change turns it on.
- `not-applicable`: the condition is absent, for example the module is not loaded, the feature is not built, or the platform differs.
- `fixed`: version at or after the fix.
- `no-fix`: version in range and no fixed package is published.
- `not-checked`: the service could not be read; give the reason in `reason`.

A CVE's overall status is the worst of its services, in this order: `affected`, `possible`, `no-fix`, `not-checked`, `not-applicable`, `fixed`. [cve_report.py](../../scripts/cve/cve_report.py) computes the overall status. You still choose each service status.

### 6. Follow the project's filter

- Read the filter in the project's records policy (`records.md`). If it says a case gets no record, for example a module compiled but not loaded or a package only installed, that case gets only a line in the not-applicable index, not a per-CVE file.
- Set that service to `not-applicable`, put the short reason in the report's Not applicable section, and set `record` to `none`.
- When the project policy and this reference disagree, the project wins. Say so in the report.

### 7. Write

- Build the findings JSON from [cve-findings.example.json](../../assets/templates/cve-findings.example.json).
- Write the report for every run, even a run with no findings, to `~/.gti/infra-expert/<project>/cve/` (`GTI_HOME` replaces `~/.gti`).
- Write per-CVE records only where `records.md` says the project keeps them. Use [cve-record.md](../../assets/templates/cve-record.md) as is: do not add fields and do not rename them.

  ```bash
  python3 <skill-dir>/scripts/cve/cve_report.py <findings.json> --check
  python3 <skill-dir>/scripts/cve/cve_report.py <findings.json> --out <path>
  ```

### 8. Never patch

- Do not upgrade packages or images, change configs, restart services, push code, or post a result.
- Put each upgrade step, with the exact version and the host or service, in `left_to_do` in the findings JSON as an object with a `text` and a `rollout` field. The `rollout` value is `rolling`, `blue-green`, `reload`, or `no-restart` when the upgrade keeps the service up, and `needs-downtime` when no such path exists; write "needs downtime: ask the user" into the `text` of those items. The user runs each step as a separate maintenance task.
- The report always ends with "Nothing was upgraded or restarted."

## Automatic mode

Turn this on only when the user asks explicitly ("modo automático", "do it yourself", or "you do not need to call me") or when the request is a scheduled run. In this mode:

- Ask nothing. Do not stop for a decision. Take the recommended option at each step and note the decision in the report.
- For a sweep, query only components in the inventory named by `records.md` and only CVEs published since the last run. Manage `~/.gti/infra-expert/<project>/cve/state.json` with `cve_lookup.py query --state`; it keeps `last_run` and `seen`.
- Read through the access ladder without prompting for a new target. If a host has no read-only path, record it as `not-checked` and continue.
- Classify, write the report, and write the records the policy allows.
- List every upgrade and every `not-checked` service as pending, in `left_to_do` and in Not checked. Give each `left_to_do` item a `rollout` value of `rolling`, `blue-green`, `reload`, or `no-restart` when the upgrade keeps the service up; when no such path exists, set `needs-downtime` and write "needs downtime: ask the user" in its `text`.
- Never upgrade, restart, push, or post. A gated action stays pending and is listed at the end, including every item that needs downtime.

## Writing rules

- [cve-record.md](../../assets/templates/cve-record.md) is the fixed record shape. The field table carries one `Checked on` date and one line per field, and the sections stay in the template order.
- Do not narrate the investigation. Do not write "this pass read" or "the binary was not read". Describe the result: the version, the condition, the status, and the reason.
- More than five hosts become a table grouped by version or by condition, never one table cell with names separated by commas.
- Anything you could not read goes to Not checked, one line per item with the reason. The rest of the record talks about the result.
- A date appears in the field table only. In the prose a date is allowed only when the date is the fact, for example the day a fix was published.
