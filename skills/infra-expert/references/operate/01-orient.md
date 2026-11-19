# Operate mode: orient

Operate mode starts with the first command that touches infrastructure: an SSH session, a cloud CLI, a deploy, a dashboard API call, a secret store write, a local model server, or a network device. It ends when the requested change is applied and verified, or when a real blocker is reported. The safety rules of this skill still apply and are stricter than any project file.

## Before the first remote command

- Locate the project knowledge folder before any remote command. Run `python3 <skill-dir>/scripts/knowledge/knowledge.py find` from the project. The folder lives at the nearest git root, so when a workspace holds several repositories the folder of the repository you are working in wins; the search never continues to a parent of that root. If it prints a path, read `README.md`, `access.md`, `mcp.md`, and `learnings.md` from that folder, plus `hosts.md` and `cli.md` when a host or a fallback command is involved. Treat them as project instructions that override a guess from this skill.
- If `find` prints nothing, say so in the first reply and offer `python3 <skill-dir>/scripts/knowledge/knowledge.py init --root <repo>`. Do not invent an access path while the folder is missing. Keep read-only work the user asked for inside the vendor CLI's documented profile.
- Name the exact target in the first acting message: host, account and region, cluster, or device. Resolve user nicknames through `hosts.md` ("the local server" becomes the alias in that table). If a nickname is not listed, ask which target it means before connecting. Do not let the command decide which machine "it" refers to, because a wrong-host action is hard to undo.

Example: "I will check free disk space on `app-host-02` in account `prod`, region `eu-west-1`." Not: "I will check the server."

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

## Feasibility before installing

- Write the arithmetic before installing or uploading a model, image, or large artifact. For a model, add quantized weights, KV cache at the context size the client will actually use, and the client's system prompt, then compare with available RAM or VRAM. Do not download first and test with the real client last, because an artifact that does not fit forces the whole change to be reverted.
- Do not remove a stated requirement (thinking mode, context size, tool calls) to make the fit work, because the client still needs it. Report the conflict instead.

Example: "30B weights 18 GiB + KV cache 6 GiB at the requested context + 1 GiB prompt = 25 GiB, above 16 GiB RAM. It does not fit; no download."
