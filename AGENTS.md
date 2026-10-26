# AGENTS.md - gti-skills

## Core Rule
All skills in this repository MUST instruct the agent to respond in the user's language, regardless of the language used in the skill content, instructions, or examples. 

This rule is non-negotiable and must be included in every `SKILL.md` created or modified in this repository. 

## Repository Layout

```text
gti-skills/
├── skills/                 # One folder per skill. Only skills live here.
│   └── <skill-id>/
├── packages/               # Code packages. Never put a skill here.
│   ├── cli/                # Node: list, validate, build, check, install
│   ├── artdirector/        # Node and TypeScript: the engine behind the Art Director skill
│   └── python/
│       └── shared/         # Python scripts shared by several skills
├── AGENTS.md
└── README.md
```

- **Packages:** anything that has its own build, tests, or dependencies, or that several skills share, is a package and lives under `packages/`. Python packages live under `packages/python/`.
- **Skills:** a skill folder contains only what an agent loads, plus `skill.json` and `README.md` for the repository.
- **One copy of each skill:** a skill exists once, in `skills/<skill-id>/`. There is no per-agent copy of it anywhere. Every agent loads the same folder; the per-agent differences live in the small `harnesses/` folder inside the skill.

## Skill Format
All skills follow the open [Agent Skills](https://agentskills.io/specification) standard, which every supported coding agent loads. The layout is called **progressive disclosure**: a short `SKILL.md` is always loaded, and detailed files are read only when a step needs them.

Frontmatter:

| Field | Required | Rule |
|-------|----------|------|
| `name` | Yes | The skill ID: lowercase letters, digits, single hyphens, max 64 characters, equal to the folder name |
| `description` | Yes | 1 to 1024 characters. What the skill does, `Use when ...`, and when not to use it |
| `compatibility` | No | Max 500 characters. Runtime requirements |
| `license` | No | License name or bundled file |
| `metadata` | No | String keys and values, for example `display-name` |

### Skill structure
Group files into subfolders by purpose. Use as many subfolders as needed to keep each folder under about eight files.

```text
skills/<skill-id>/
├── skill.json              # Repository manifest (not installed)
├── SKILL.md                # Required: under 500 lines, overview and navigation
├── README.md               # Human documentation (not installed)
├── references/             # Detailed docs, loaded on demand
│   ├── workflow/           #   one file per step: 01-collect.md, 02-extract.md
│   ├── quality/            #   checklists and anti-patterns
│   └── <topic>/
├── scripts/                # Code the agent runs instead of rewriting logic
│   ├── setup/
│   └── <purpose>/
├── assets/                 # Static files the skill outputs or copies
│   ├── templates/
│   └── examples/           #   name examples EXAMPLE-SKILL.md, never SKILL.md
├── harnesses/              # One short guide per coding agent
│   └── <agent-id>/
│       ├── GUIDE.md        #   GENERATED: install paths, how to invoke, how to verify
│       └── project-files/  #   Optional, not installed with the skill: files copied to the
│                           #   project root for that agent, such as a slash command file
└── tests/                  # Optional tests for the skill scripts (not installed)
```

The skill folder is identical for every agent. `harnesses/<agent-id>/GUIDE.md` is generated from the agent registry and holds only what differs: install folders, whether `/skill-name` works, how to confirm the skill loaded, and agent notes. `SKILL.md` has a short "Running in your agent" section that points to these guides.

- **One level deep:** link every reference directly from `SKILL.md`, from the step that needs it. Do not chain references through other references.
- **Numbered workflow:** workflow files are named `01-`, `02-`, and so on, in the order the agent reads them.
- **No nested skills:** only the top `SKILL.md` may be named `SKILL.md`. Some agents scan folders recursively and would register a second skill.
- **No machine paths:** refer to files relative to `<skill-dir>`, the folder that contains `SKILL.md`. Tell the agent to use `python3` on macOS and Linux and `python` or `py -3` on Windows.

### skill.json
Each skill has a `skill.json` manifest in its folder. It is read by `packages/cli` and is never installed.

| Field | Required | Purpose |
|-------|----------|---------|
| `id` | Yes | Skill ID, equal to the folder name |
| `displayName` | Yes | Name used in documentation |
| `package` | No | Package the skill drives, for example `packages/artdirector` |
| `rootPointer` | No | File inside the installed skill that receives the absolute package path at install time |
| `shared` | No | List of `{ "from", "to" }`: copies a shared folder, for example `packages/python/shared/scripts`, into the skill |
| `generated` | No | List of `{ "to", "template" }`: extra documents rendered from the agent registry |
| `harnessNotes` | No | Map of agent id to one sentence added to that agent's `GUIDE.md`. The key `*` applies to every agent |

## Supported agents
The registry `packages/cli/registry/harnesses.json` is the single source of truth. Every skill supports every agent in it: the CLI installs the same skill folder into each agent's folder, and each skill carries a generated guide per agent.

| Id | Agent | Project folder | User folder |
|----|-------|----------------|-------------|
| `cursor` | Cursor / Cursor CLI | `.cursor/skills` | `~/.cursor/skills` |
| `claude` | Claude / Claude Code | `.claude/skills` | `~/.claude/skills` |
| `antigravity` | Antigravity | `.agents/skills` | `~/.gemini/antigravity/skills` |
| `opencode` | OpenCode | `.opencode/skills` | `~/.config/opencode/skills` |
| `cline` | Cline | `.cline/skills` | `~/.cline/skills` |
| `kilo` | Kilo Code | `.kilocode/skills` | `~/.kilocode/skills` |
| `kiro` | Kiro | `.kiro/skills` | `~/.kiro/skills` |
| `codex` | Codex | `.agents/skills` | `~/.agents/skills` |
| `copilot` | GitHub Copilot | `.github/skills` | `~/.copilot/skills` |
| `muse` | Muse Code | `.agents/skills` | `~/.agents/skills` |

To support a new agent, add it to the registry, run the build, and update the tables in `README.md` and this file.

## Build and generated files
Run `node packages/cli build` after changing any skill, any shared script, or the registry, and commit the result. CI runs `node packages/cli check` and fails when synced or generated files are stale.

| Command | Purpose |
|---------|---------|
| `node packages/cli list` | Show skills and agents |
| `node packages/cli validate` | Validate every skill against the standard and these rules |
| `node packages/cli build` | Sync shared files, regenerate the per-agent guides, and validate |
| `node packages/cli check` | Fail when anything generated is out of date |
| `node packages/cli install --harness <ids\|all>` | Install skills into agents (`--skill`, `--scope project\|user`, `--dest`, `--dry-run`) |

Never edit these by hand; change the source and rebuild:

- `harnesses/<agent-id>/GUIDE.md` in every skill (source: the registry and `skill.json`)
- `scripts/lib`, `scripts/setup`, `scripts/download`, `scripts/transcript`, and `scripts/frames` inside the video skills (source: `packages/python/shared/scripts`)
- `references/harnesses/install-locations.md` (source: the registry)

Tests:

| Command | Covers |
|---------|--------|
| `npm test` | CLI tests and every Python test |
| `cd packages/artdirector && npm test` | Art Director engine |

## Language
All skill files must be written in English. 
The ONLY thing that must be localized is: "respond in the user's language, regardless of..." which is stated in the core rule above.

## README Standard
Every `README.md` in this repository follows one of three fixed templates: the **root README** (`README.md`), the **skill README** (`skills/<name>/README.md`), or the **package README** (`packages/**/README.md`). Section names, order, header layout, badges, and table formats are fixed so every skill reads the same way. When you add or edit a README, match the template exactly and keep the existing skill READMEs aligned with it.

### Skill naming
Every skill has two names, and each is used in a fixed place:

| Name | Format | Example | Used in |
|------|--------|---------|---------|
| Skill ID | kebab-case | `video-to-skill` | Folder name, `SKILL.md` frontmatter `name`, install paths, and commands |
| Display name | Title-cased words separated by spaces | Video to Skill | README `#` title, README prose, and the root Skill Catalog, Compatibility, and License tables |

Current skills:

| Skill ID | Display name |
|----------|--------------|
| `artdirector` | Art Director |
| `video-to-skill` | Video to Skill |
| `video-to-markdown` | Video to Markdown |
| `ux-psychology-review` | UX Psychology Review |

Short connecting words (`to`, `from`, `and`, `of`) stay lowercase in display names. Never use the skill ID as a README title.

### General rules
- **English only**, clear and technical, complete sentences. No hype or filler.
- **No emojis** and **no em dash or en dash**. Use a hyphen `-`.
- **Verify every fact** (commands, flags, defaults, ports, paths, versions) against the code, `package.json`, or the script's `argparse` definition before writing it. Never invent a command.
- **ASCII diagrams** in ` ```text ` blocks. No screenshots or mermaid.
- **Commands** in fenced `bash` or `powershell` blocks, complete and copy-pasteable. Give a PowerShell variant for any copy or path command.
- **Links** are relative for files in this repository and labeled for external URLs. No bare URLs.
- **Feature and rule lists** use `- **Label:** explanation`.
- Use `## Section` headings with a blank line before and after. Never skip heading levels.

### Skill README template
Sections marked **required** must always exist, even if short. Optional sections may only appear in the position shown.

| # | Section | Status | Contents |
|---|---------|--------|----------|
| 1 | Header | Required | Centered block, see [Header format](#header-format) |
| 2 | `## Table of Contents` | Required | Links to every `##` section below, in order |
| 3 | `## Overview` | Required | The problem and approach in 1-2 paragraphs, an ASCII diagram, and a two-column table `This skill does` / `This skill does not` |
| 4 | `## Features` | Required | `- **Label:** explanation` bullets |
| 5 | `## Requirements` | Required | Table `Dependency \| Version \| Purpose \| Auto-installed`, then a platform table when installation differs per OS |
| 6 | `## Installation` | Required | The `node packages/cli install` command for this skill, a table of the 10 agents it installs to, a manual copy alternative in bash and PowerShell, and optional dependency pre-install |
| 7 | `## Quick Start` | Required | One `text` block with a natural-language request, then one sentence describing what happens |
| 8 | `## Usage` | Required | Input tables (`### Required input`, `### Optional input`, or a single `### Input` table with a Required column) and `### Examples` |
| 9 | `## How It Works` | Required | ASCII step diagram of the workflow |
| 10 | `## Reference` | Required | One `###` subsection per script or command group, each with a usage block and a table `Argument \| Default \| Description` (or `Command \| Purpose \| Key flags` for CLIs) |
| 11 | `## Output` | Required | Example of the produced artifact and a table `Section \| Contents` (or the export formats and state layout) |
| 12 | `## Architecture` | Optional | Table `Path \| Responsibility` and a link to `ARCHITECTURE.md` |
| 13 | `## Security` | Optional | Bullets covering network exposure, tokens, and file access |
| 14 | `## Development` | Optional | Table `Command \| Action` taken from `package.json` or equivalent |
| 15 | `## Troubleshooting` | Required | One `<details>` block per problem, see [Troubleshooting format](#troubleshooting-format) |
| 16 | `## Limitations` | Required | Bullets with known constraints |
| 17 | `## Acknowledgements` | Optional | Table `Project \| License \| Used for` |
| 18 | `## License` | Required | The license and a link to `LICENSE`, or "No license has been declared for this skill yet." with a link to the root license section |

### Header format
```markdown
<div align="center">

# <Display Name>

> <Tagline: what the user gets, under 12 words>

**<One sentence: what the skill does and how.>**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![<Runtime>](https://img.shields.io/badge/<runtime>-<version>-blue.svg)](#requirements)
[![Agents](https://img.shields.io/badge/agents-10%20supported-8A63D2.svg)](#installation)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](#requirements)
[![License](https://img.shields.io/badge/license-<license>-yellow.svg)](#license)

[Quick Start](#quick-start) • [Usage](#usage) • [Reference](#reference) • [Troubleshooting](#troubleshooting)

</div>

---
```

- Badges always appear in this order: Format, Runtime, Agents, Platforms, License. Use `license-not%20declared-lightgrey` when the skill has no license.
- The navigation line is always the four links above.

### Troubleshooting format
```markdown
<details>
<summary><strong>Symptom as the user sees it</strong></summary>

Cause in one sentence. Then the fix, with a command block when one applies.

</details>
```

### Package README template
Package READMEs are short. They document the code, not the skill; the skill README stays the user-facing document.

```markdown
# <Package title>

One sentence: what the package does.

## Overview

What the package owns, and what it does not handle. Name the skill or skills that use it.

## Run

Commands from the repository root and from the package folder, in `bash` blocks.

## Layout

| Path | Responsibility |
|------|----------------|

## Scripts

| Command | Action |
|---------|--------|

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|

## Testing

The test command and what it covers.

See [../../README.md](../../README.md) for the full repository.
```

Rules: use the exact section names and order above; write `None` under Environment when there are no variables; point to the skill README with a relative link in Overview.

### Root README template
The root `README.md` uses these sections in this order: centered header (title, tagline, summary, badges, navigation), `## Table of Contents`, `## What Is GTI Skills?`, `## Skill Catalog`, `## Quick Start`, `## Installation`, `## Supported Agents`, `## Compatibility`, `## How Skills Work`, `## Skill Anatomy`, `## Authoring Skills`, `## Repository Layout`, `## Contributing`, `## Security`, `## Documentation`, `## About GTI`, `## License`.

When a skill is added, removed, or renamed, update the Skill Catalog, Compatibility, Repository Layout, Documentation, and License tables, plus the skill count badge, and the [Skill naming](#skill-naming) table above. Tables list skills by display name; paths and commands use the skill ID.
