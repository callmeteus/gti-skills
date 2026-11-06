<div align="center">

# GTI

> One command keeps every gti-skills skill and MCP server current

**Updates installed gti-skills skills in every agent from the latest GitHub commit, and installs or refreshes the gti-skills MCP servers in a managed folder that agent configs point at.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Node.js](https://img.shields.io/badge/node-18%2B-blue.svg)](#requirements)
[![Agents](https://img.shields.io/badge/agents-10%20supported-8A63D2.svg)](#installation)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](#requirements)
[![License](https://img.shields.io/badge/license-not%20declared-lightgrey.svg)](#license)

[Quick Start](#quick-start) • [Usage](#usage) • [Reference](#reference) • [Troubleshooting](#troubleshooting)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Reference](#reference)
- [Output](#output)
- [Security](#security)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [License](#license)

## Overview

Keeping gti-skills current used to mean a clone of the repository on every PC, `git pull`, the CLI's `update`, and hand-edited MCP entries pointing at copies of each server that slowly fell behind. GTI turns that into one request to the agent: `/gti update`.

The skill bundles a small Node.js script. It downloads the latest commit into the same `~/.gti-skills/sources/` folder the CLI uses and runs that CLI's `update` for skills. For MCP servers it keeps one managed copy per server with its own Python environment and points each agent's MCP config at it, backing up the config first.

```text
  /gti update
      │
      v
  latest commit ──> ~/.gti-skills/sources/<commit>/
      │
      ├── skills ──> packages/cli update ──> every installed skill, every agent
      │
      └── mcps ───> ~/.gti-skills/mcps/<name>/  (files, .venv, Chromium, login state)
                         │
                         v
               agent configs repointed (backup first)
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Update installed gti-skills skills in all ten agents | Update skills or MCP servers from other sources |
| Install and update the gti-skills MCP servers and their Python dependencies | Delete logins, cookies, or browser profiles the servers created |
| Repoint agent MCP entries to the managed copy, with a backup | Write MCP settings for Cline, Kilo Code, GitHub Copilot, or Muse Code |
| Work on a PC that has no clone of the repository | Edit or publish skills |

## Features

- **One command:** `/gti update` updates skills and MCP servers; `/gti skills update` and `/gti mcps update` do one side; free text such as "atualiza pra mim" works too.
- **No clone needed:** the latest commit is downloaded from GitHub into the CLI's own sources folder and reused by both.
- **Managed MCP copies:** each server lives in `~/.gti-skills/mcps/<name>/` with its own `.venv`; requirements are reinstalled only when they change, and the needed Chromium build is installed.
- **State kept:** runtime files the servers write are never removed, and when an entry moves from an older copy its login state (for example Shopee cookies and browser profile) is carried over.
- **Start check:** after an update each server is started once and must answer an MCP `initialize` request; if it does not, agent entries stay on the old copy and the error is shown.
- **Safe config edits:** OpenCode, Claude Code, Cursor, Kiro, Antigravity, and Codex configs are edited in place, keeping the entry's other settings, with a timestamped backup and an atomic write.
- **Dry run and status:** `--dry-run` shows every change first; `status` lists skill versions and where each MCP is registered.

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| Node.js | 18+ | Runs the script and the gti-skills CLI | No |
| Network access to GitHub | - | Latest commit and source download; `GITHUB_TOKEN` raises the rate limit | No |
| Python | 3.10+ | MCP servers and their virtual environments | No |
| MCP dependencies and Chromium | Per server | Installed into each server's `.venv` | Yes |

| Platform | Notes |
|----------|-------|
| Windows | Python is found through the `py -3` launcher, then `python`, then `python3` |
| macOS and Linux | Python is found as `python3`, then `python` |

## Installation

From the repository root, install the skill into any supported agent:

```bash
node packages/cli install --harness claude --skill gti
```

The same command works in PowerShell. Use a comma separated list or `all` for several agents, `--scope user` to install for every project, and `--dry-run` to preview. The skill is in the `coding` and `personal` packs.

| Agent | Id | Project folder | User folder |
|-------|----|----------------|-------------|
| Cursor / Cursor CLI | `cursor` | `.cursor/skills` | `~/.cursor/skills` |
| Claude / Claude Code | `claude` | `.claude/skills` | `~/.claude/skills` |
| Antigravity | `antigravity` | `.agents/skills` | `~/.gemini/antigravity/skills` |
| OpenCode | `opencode` | `.opencode/skills` | `~/.config/opencode/skills` |
| Cline | `cline` | `.cline/skills` | `~/.cline/skills` |
| Kilo Code | `kilo` | `.kilocode/skills` | `~/.kilocode/skills` |
| Kiro | `kiro` | `.kiro/skills` | `~/.kiro/skills` |
| Codex | `codex` | `.agents/skills` | `~/.agents/skills` |
| GitHub Copilot | `copilot` | `.github/skills` | `~/.copilot/skills` |
| Muse Code | `muse` | `.agents/skills` | `~/.agents/skills` |

The skill is one self-contained folder, identical for every agent. To copy it by hand, put `skills/gti` in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p ~/.claude/skills && cp -r skills/gti ~/.claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force $HOME\.claude\skills | Out-Null
Copy-Item -Recurse skills\gti $HOME\.claude\skills\
```

Each agent has a short guide in `skills/gti/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

## Quick Start

```text
/gti atualiza pra mim por favor
```

The agent runs `gti.mjs update`: every installed gti-skills skill is updated to the latest commit, every gti-skills MCP server already in use is refreshed in `~/.gti-skills/mcps/`, agent entries are pointed there with a backup, and the agent tells you what changed and whether to restart or log in.

## Usage

### Input

| Input | Required | Default | Description |
|-------|:--------:|---------|-------------|
| Command | No | `update` | `update`, `skills update`, `mcps update`, `mcps install <names>`, `mcps list`, or `status`, or the same request in plain words |
| MCP names | For `mcps install` | - | `kabum`, `mercadolivre`, `shopee`, `zoom`, `twitter`, or `all` |
| Agents | No | Agents whose config file exists | For `mcps install`: `opencode`, `claude`, `cursor`, `kiro`, `antigravity`, `codex`, or `all` |
| Dry run | No | Off | Shows the plan and changes nothing |

### Examples

```text
/gti update
```

Updates skills and the MCP servers already in use.

```text
/gti skills update
```

Only the skills, through the gti-skills CLI.

```text
/gti mcps update
```

Only the MCP servers: files, dependencies, and agent entries.

```text
/gti mcps install kabum zoom no Cursor e no OpenCode
```

Installs the two servers and registers them in Cursor and OpenCode.

```text
/gti status
```

Shows which skills are out of date and where each MCP server is registered.

## How It Works

```text
  1. Source     GitHub API: latest commit on master
                ──> ~/.gti-skills/sources/<commit-12>/ (download once, stamp file)
                    no network: fall back to the newest downloaded commit
  2. Skills     node <source>/packages/cli update   (records, untracked installs, builds)
  3. MCPs       discover mcps/* and packages/python/*-mcp in the source
                for each server already managed or registered:
                  copy files ──> carry login state from the old copy ──> .venv + pip + Chromium
                  start check (MCP initialize) ──> on failure, leave agent entries alone
                  repoint matching entries in agent configs ──> backup + atomic write
  4. Report     skills, servers, entries, backups, logins, restart
```

## Reference

### gti.mjs

```bash
node skills/gti/scripts/gti.mjs update
node skills/gti/scripts/gti.mjs skills update --check
node skills/gti/scripts/gti.mjs mcps update --only kabum,zoom --dry-run
node skills/gti/scripts/gti.mjs mcps install shopee --agents opencode,claude
node skills/gti/scripts/gti.mjs mcps list
node skills/gti/scripts/gti.mjs status
```

| Argument | Default | Description |
|----------|---------|-------------|
| `update` | - | `skills update`, then `mcps update` |
| `skills update` | - | Runs the CLI `update` from the latest commit; other flags such as `--check` and `--force` are passed through |
| `mcps update` | - | Refreshes servers that are managed or registered in a supported agent |
| `mcps install <names>` | - | Installs servers and registers them; names or `all` |
| `mcps list` | - | Each server, whether it is managed, and every matching agent entry |
| `status` | - | `skills update --check` plus `mcps list` |
| `--only` | All | Comma separated servers for `mcps update` |
| `--agents` | Existing configs | Comma separated agents for `mcps install`, or `all` |
| `--dry-run` | Off | Show the plan without writing anything |
| `--skip-deps` | Off | Do not create the venv or install requirements |
| `--source` | Latest commit | Use a local gti-skills checkout instead |
| `--home` | `~/.gti-skills` or `GTI_SKILLS_HOME` | Where sources and managed servers live |
| `--user-home` | Home folder | Where agent config files are read |

Agent config files written:

| Agent | File | Entry |
|-------|------|-------|
| OpenCode | `~/.config/opencode/opencode.json` | `mcp.servers.<name>` (or `mcp.<name>` when the file uses that form) with `type: local` and `command` |
| Claude Code | `~/.claude.json` | `mcpServers.<name>` with `type: stdio`, `command`, `args` |
| Cursor | `~/.cursor/mcp.json` | `mcpServers.<name>` |
| Kiro | `~/.kiro/settings/mcp.json` | `mcpServers.<name>` |
| Antigravity | `~/.gemini/antigravity/mcp_config.json` | `mcpServers.<name>` |
| Codex | `~/.codex/config.toml` | `[mcp_servers.<name>]` with `command` and `args` |

## Output

```text
source   latest is 041d7fc (already downloaded)
skills   node packages/cli update
Everything is at 041d7fc.
mcp      kabum: files installed, deps installed
           opencode:kabum repointed
mcp      shopee: files installed, deps installed
           opencode:shopee repointed
           kept login state: .browser-profile, cookies.json
           one-time login if needed: ~/.gti-skills/mcps/shopee/.venv/Scripts/python.exe ~/.gti-skills/mcps/shopee/login.py
backup   ~/.config/opencode/opencode.json.gti-backup-2026-11-06T18-40-00-000Z
```

```text
~/.gti-skills/
├── sources/<commit-12>/        # latest gti-skills source, shared with the CLI
└── mcps/<name>/                # one managed copy per MCP server
    ├── server.py ...           # files from the source
    ├── .venv/                  # Python environment
    ├── .gti-mcp.json           # commit, copied files, requirements hash
    └── cookies.json ...        # runtime state, never removed
```

| Section | Contents |
|---------|----------|
| `source` | Commit used and whether it was downloaded |
| `skills` | The CLI update output |
| `mcp` | Per server: files, dependencies, agent entries, kept state, login hint |
| `backup` | Every config file backed up before a change |

## Security

- **Network:** the script calls the GitHub API for the latest commit and its tarball, and pip and the browser installers download server dependencies. `GITHUB_TOKEN` or `GH_TOKEN` is sent only to `api.github.com`.
- **Tokens and logins:** login state the MCP servers create (cookies, browser profiles, `.env`) stays on this machine; it is copied only from an older install folder into the managed one.
- **File access:** writes go to `~/.gti-skills/` and to the six agent config files listed above, each backed up first. Tarball paths that leave the target folder are skipped.

## Development

| Command | Action |
|---------|--------|
| `npm run test:skills` | Runs the GTI tests with the other skill script tests, from the repository root |
| `node skills/gti/scripts/gti.mjs mcps update --dry-run --source .` | Shows the MCP plan using this checkout |
| `node packages/cli validate --skill gti` | Checks the skill against the repository rules |

## Troubleshooting

<details>
<summary><strong>GitHub answered 403 or a rate limit message</strong></summary>

Anonymous GitHub API calls are limited per hour. Set a token and run again:

```bash
GITHUB_TOKEN=<token> node skills/gti/scripts/gti.mjs update
```

</details>

<details>
<summary><strong>Python 3.10 or later was not found</strong></summary>

The MCP servers need Python 3.10+. Install it (on Windows, from python.org with the `py` launcher) and run `/gti mcps update` again.

</details>

<details>
<summary><strong>A server stopped working after the update</strong></summary>

Restore the backup next to the agent config (`<file>.gti-backup-<time>`), or run the server by hand with the command in `mcps list` to see its error. Servers that log in, such as Shopee, may need the one-time login shown in the output.

</details>

<details>
<summary><strong>An MCP shows as not installed</strong></summary>

It is not managed yet and no supported agent has an entry for it. Install it:

```bash
node skills/gti/scripts/gti.mjs mcps install kabum
```

</details>

## Limitations

- MCP entries for Cline, Kilo Code, GitHub Copilot, and Muse Code are not written; the output gives the command and script to add by hand.
- Config files with comments (JSONC) are not edited; the output says which entry to change.
- Entries are matched by name (`kabum`, `kabum-mcp`) or by a path through the server's folder; an entry with another name pointing elsewhere is not found.
- The first MCP update downloads Chromium builds for the browser-based servers and can take several minutes.

## License

No license has been declared for this skill yet. See the [root README](../../README.md#license).
