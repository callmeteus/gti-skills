# Operate mode: orient

Operate mode starts with the first command that touches infrastructure: an SSH session, a cloud CLI, a deploy, a dashboard API call, a secret store write, a local model server, or a network device. It ends when the requested change is applied and verified, or when a real blocker is reported. The safety rules of this skill still apply and are stricter than any project file.

## Start a run folder for local files

At the start of a task that will write local files, create one run folder and use it for every local file of the task: scripts sent to hosts, parameter files, long command output, fleet JSON, and rendered configs. Run `python3 <skill-dir>/scripts/knowledge/knowledge.py tmp --name <short-task-slug>` once, from the repository you work in, and keep the absolute path it prints as `RUN` for the whole task. The folder lives under `.gti` at the nearest git root, in a folder named `tmp` with one run subfolder named `<timestamp>-<slug>`, and git ignores it through a `tmp/` line in `.gti/.gitignore`.

Never write these files to the system temporary folder, to the user's private folders, or elsewhere in the repository. The repository root `.gitignore` is never changed. Use `knowledge.py tmp --list` to see the run folders with their size and date, newest first. When the task is verified, delete the run folder's non-database files with the other backups and keep database dumps until the user confirms, as `04-change.md` says.

## Before the first remote command

- Locate the project knowledge folder before any remote command. Run `python3 <skill-dir>/scripts/knowledge/knowledge.py find` from the project. The folder lives at the nearest git root, so when a workspace holds several repositories the folder of the repository you are working in wins; the search never continues to a parent of that root. If it prints a path, read `README.md`, `access.md`, `mcp.md`, and `learnings.md` from that folder, plus `hosts.md` and `cli.md` when a host or a fallback command is involved. Treat them as project instructions that override a guess from this skill.
- If `find` prints nothing, say so in the first reply and offer `python3 <skill-dir>/scripts/knowledge/knowledge.py init --root <repo>`. Do not invent an access path while the folder is missing. Keep read-only work the user asked for inside the vendor CLI's documented profile.
- Name the exact target in the first acting message: host, account and region, cluster, or device. Resolve user nicknames through `hosts.md` ("the local server" becomes the alias in that table). If a nickname is not listed, ask which target it means before connecting. Do not let the command decide which machine "it" refers to, because a wrong-host action is hard to undo.

Example: "I will check free disk space on `app-host-02` in account `prod`, region `eu-west-1`." Not: "I will check the server."

## Discover the conventions

After loading the knowledge folder and before the access ladder, work out how this project builds infrastructure so a create, bring up, or deploy request follows the project's own way instead of a guess. Read `conventions.md` from the knowledge folder first. When it is missing, or when it does not cover the task, discover the conventions from the repository and record them in `conventions.md` with the source file for each fact. Treat the recorded conventions as project instructions that override a guess from this skill. When the knowledge folder is absent, follow the rule above: offer to create it and keep the conventions you discover in the task context until it exists.

- **Provisioning path.** Find how the project provisions infrastructure. Look for infrastructure as code: Terraform or OpenTofu roots and modules, Pulumi programs, CDK apps, Helm charts, Compose files, and Ansible playbooks. Find the pipeline that applies it in CI workflows and project rules, and read the README of the infrastructure folder. The project's provisioning path is the default method for any request that says create, bring up, or deploy, even when the user does not name a tool. Creating resources by hand in a console or with a vendor CLI is never the default.
- **Closest existing example.** Find the existing stack most like the request and copy its shape. For a service on its own machine, copy the stack closest in shape that is already applied and stable (present in the default branch for some time, not created or rewritten in the last few days, and not marked for removal); a stack another chat created minutes ago and is about to delete is not the reference. When the only close example is very recent, say so and ask whether it is the reference. Copy its module calls, variables files, user data, network attachments, outputs, and secrets wiring instead of writing a new structure.
- **Naming.** Derive the naming pattern from the existing code and, read-only, from live resources of the same kind. Never invent a new pattern. When a live read is needed, use the access ladder below and keep the read read-only. Apply the derived pattern to the new resource and say which example it came from.
- **Tags and labels.** Find where the shared tag or label set is defined, for example a tags module, provider default tags, or a locals block, and which keys each kind of resource adds. Apply the full set that the kind of resource expects, not a subset.
- **Network and access defaults, and inventories.** Find the network and access defaults the closest example uses, such as the network, subnets, security groups, and keys. List the inventories and catalogs that must change in the same change, so the new resource is visible to the rest of the project.
- **Open questions.** Ask only for what the repository cannot answer and that changes the result, for example the machine size when no similar stack exists. Otherwise take the value from the closest example and say so in the reply.
- **Secrets.** Find the project's canonical secret manager and path convention before any secret is generated, written, read, or moved, and record them in `conventions.md` under Secrets; see [07-secrets.md](07-secrets.md).

Example: "No tool was named, so I found that the project provisions with Terraform through its pipeline. I am copying the stable single-service VM stack that has been in the default branch for some time, its naming, and its full tag set, and I will update the host inventory in the same change." Not: "Which tool should I use, and what naming and tags do you want?"

## The access ladder

Start at rung 1 and move down only when the current rung cannot do the job. Record every drop as an MCP gap with `knowledge.py gap` (see `06-learn.md`).

| Rung | Path | Rule |
|------|------|------|
| 1 | Project MCP server | Use its tools first, including read-only tools and their own filter parameters |
| 2 | Project CLI wrapper | Use the command and flags documented in `cli.md` |
| 3 | Vendor CLI with a documented profile | Use the profile, region, or context named in `access.md` |
| 4 | Raw ssh or HTTP | Only when `access.md` documents this target and method |

Example: to export dashboards, use the project MCP's bulk export tool; if it cannot export in bulk, use the project CLI from `cli.md`; only then call the vendor API with the profile in `access.md`.

- Do not hand-roll connection boilerplate, sweep for keys, or cycle through ports and addresses when a documented path fails, because each attempt can land on the wrong host and each failure creates a new investigation. Stop, report the exact error and the rung that failed, and open an MCP gap.

Example: "The project MCP returned permission denied for `app-host-02`; I stopped instead of trying other keys."

## One preflight per target

- Run one combined read-only preflight per target before any heavy work (scan, install, upload, deploy). Include, where relevant: passwordless sudo, container runtime privileges, architecture, free disk, free memory, GPU, egress to a known endpoint, and secret store reachability. Keep it as a file you can send to each target. Do not discover these limits one broken step at a time, because the work is repeated for every miss.
- When subagents work in parallel, run the preflight on one target first and paste the result into every subagent prompt. Do not let every subagent hit the same missing permission, because the whole pass has to be redone.

Example: "Preflight on `app-host-02`: sudo yes, container runtime needs sudo, x86_64, 12 GiB free, no egress. Subagents: use sudo and plan no downloads." Record a stable fact in `access.md` or the inventory, not only in the chat.

- Before a change on a production host, add `who` and the process manager's list, run as the user that owns the application, to the preflight. Mention other live sessions to the user before acting, and do not read an empty list run as root as "nothing is running".
- Search the project for a built-in diagnostic before writing a probe: a CLI subcommand such as `debug` or `stats`, an admin endpoint, or a status page. Grep the CLI and scripts folders for the symptom word.
- Look up facts a provider API answers (endpoints, ports, TLS mode, auth mode, sizes) read-only through the access ladder before asking the user. Ask only for decisions, never for facts you can read.

## Feasibility before installing

- Write the arithmetic before installing or uploading a model, image, or large artifact. For a model, add quantized weights, KV cache at the context size the client will actually use, and the client's system prompt, then compare with available RAM or VRAM. Do not download first and test with the real client last, because an artifact that does not fit forces the whole change to be reverted.
- Do not remove a stated requirement (thinking mode, context size, tool calls) to make the fit work, because the client still needs it. Report the conflict instead.

Example: "30B weights 18 GiB + KV cache 6 GiB at the requested context + 1 GiB prompt = 25 GiB, above 16 GiB RAM. It does not fit; no download."
