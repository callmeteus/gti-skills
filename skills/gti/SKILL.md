---
name: gti
description: >-
  Keeps gti-skills up to date on this machine with one command: updates every
  installed gti-skills skill in every coding agent from the latest commit on
  GitHub, and updates the gti-skills MCP servers (KaBuM, Mercado Livre,
  Shopee, Zoom, Twitter/X): refreshes their code and Python dependencies in a
  managed folder and points each agent's MCP config at it, with backups. Also
  installs MCP servers into agents and shows what is out of date. Works on any
  PC without a clone of the repository. Use when the user types /gti, asks to
  update gti-skills, its skills, or its MCPs, says "atualiza", "update
  everything", or asks what gti-skills version or MCPs are installed. Do not
  use for third-party skills or MCP servers that are not part of gti-skills,
  or for editing the skills themselves.
compatibility: >-
  Node.js 18+ and network access to GitHub. Python 3.10+ for the MCP servers.
  Agent configs updated automatically: OpenCode, Claude Code, Cursor, Kiro,
  Antigravity, Codex.
metadata:
  display-name: GTI
---

# GTI

## Core Rule

Always respond in the user's language, regardless of the language used in this skill or in the command output.

## What it manages

- **Skills:** every gti-skills skill installed in any of the ten supported agents, at user or project level. Updated by the gti-skills CLI from the latest commit on GitHub `master`.
- **MCP servers:** the servers in the gti-skills repository (`mcps/*` and `packages/python/*-mcp`). Each one gets a managed copy in `~/.gti-skills/mcps/<name>/` with its own `.venv`, and agent configs point at that copy.
- **Source:** the latest commit is downloaded to `~/.gti-skills/sources/<commit>/`, the same place the CLI uses. No clone of the repository is needed.

## Commands

Run the script with `node`; `<skill-dir>` is the folder that contains this file.

```bash
node <skill-dir>/scripts/gti.mjs <command>
```

Map the user's request to one command. Arguments after `/gti` are the request; free text in any language counts too.

| The user says | Run |
|---------------|-----|
| `/gti update`, `/gti`, "atualiza pra mim", "update everything" | `update` |
| `/gti skills update`, "update the skills" | `skills update` |
| `/gti mcps update`, "update the MCPs" | `mcps update` |
| `/gti status`, "what version do I have", "is anything out of date" | `status` |
| `/gti mcps`, `/gti mcps list`, "which MCPs do I have" | `mcps list` |
| `/gti mcps install kabum shopee`, "add the KaBuM MCP to Cursor" | `mcps install kabum shopee [--agents cursor]` |

Flags: `--dry-run` shows the plan without changing anything; `--only kabum,zoom` limits `mcps update`; `--agents opencode,claude` (or `all`) chooses where `mcps install` registers; `--skip-deps` skips the Python install. `skills update` passes other flags to the CLI, for example `--check` or `--force`.

## How to run it

1. **Run the command directly** for `update`, `skills update`, `mcps update`, `status`, and `mcps list`. The user asked for it; do not ask again. These commands only refresh what is already installed and back up every config file they change.
2. **Confirm first for `mcps install`** when the user did not name the agents: say which agents will get which servers (by default every supported agent whose config file exists), then run it.
3. **Let long steps finish.** The first MCP update creates virtual environments and may download a Chromium build for Shopee, Mercado Livre, and Twitter. Run it with a timeout of at least ten minutes, in the background if the agent supports that.
4. **Read the output and report** in a few lines:
   - skills: up to date, or how many were updated, and the commit;
   - each MCP: installed or updated, and which agent entries now point at the managed copy (`repointed` means an entry moved from an older copy);
   - backups written, by path;
   - anything the user must do: restart the agents that are open, and run the one-time login the output shows for an MCP that needs it (Shopee, Twitter) if it has never been logged in on this machine.
5. **On an error,** show the error line and the fix from the table below. Never edit agent configs by hand to work around it.

## What the MCP update does

For each gti-skills MCP server that is already managed or already registered in an agent:

1. Copies the latest files into `~/.gti-skills/mcps/<name>/`. Files the server wrote at runtime (cookies, browser profiles, `.env`) are kept; files removed upstream are removed.
2. If an agent entry pointed at an older copy, carries over its login state (for example Shopee's `cookies.json` and `.browser-profile/`) so the user does not log in again.
3. Creates `.venv` with Python 3.10+, installs `requirements.txt` when it changed, and installs the Chromium build the server needs.
4. Points every matching entry (same name, such as `kabum` or `kabum-mcp`, or a path through the server's folder) at the managed copy, keeping the entry's other settings, after backing up the config file as `<file>.gti-backup-<time>`.

Servers that are neither managed nor registered are listed as `not installed`; offer `mcps install` for them. Cline, Kilo Code, GitHub Copilot, and Muse Code keep MCP settings where the script does not write; for those, give the user the command and argument the output shows so they can add it in the agent's MCP settings.

## Errors

| Error | Fix |
|-------|-----|
| `GitHub answered 403` or a rate-limit message | Set `GITHUB_TOKEN` and run again; the script falls back to the last downloaded commit when one exists |
| `Python 3.10 or later was not found` | Install Python 3.10+ (on Windows, from python.org with the `py` launcher), then run `mcps update` again |
| `pip install` failed | Show the pip error; usually a network or proxy problem. Run `mcps update --only <name>` again after fixing it |
| `the file is not plain JSON (comments?)` | That agent's config has comments; tell the user which entry to change by hand, using the command and script path shown |
| `Unknown MCP` | Run `mcps list` to see the names |

## Example

```text
User: /gti atualiza pra mim por favor
Agent: Runs `node <skill-dir>/scripts/gti.mjs update`. Reports: skills updated to
041d7fc (118 installs); KaBuM, Mercado Livre, Shopee, Zoom, and Twitter MCPs
installed in ~/.gti-skills/mcps and the five OpenCode entries repointed there,
Shopee login kept; backup at ~/.config/opencode/opencode.json.gti-backup-...;
restart OpenCode to load them.
```

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.
