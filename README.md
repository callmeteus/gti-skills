<div align="center">

# GTI Skills

> Production-tested agent skills for ten coding agents

**Drop-in skills that teach coding agents real workflows: design graphics from HTML, turn tutorials into skills, and turn videos into documentation. Written once, installed into Cursor, Claude Code, Antigravity, OpenCode, Cline, Kilo, Kiro, Codex, Copilot, and Muse Code.**

[![Skills](https://img.shields.io/badge/skills-4-blue.svg)](#skill-catalog)
[![Format](https://img.shields.io/badge/format-Agent%20Skills-green.svg)](#skill-anatomy)
[![Agents](https://img.shields.io/badge/agents-10%20supported-8A63D2.svg)](#supported-agents)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)
[![GitHub stars](https://img.shields.io/github/stars/callmeteus/gti-skills?style=flat)](https://github.com/callmeteus/gti-skills/stargazers)

[Skill Catalog](#skill-catalog) • [Quick Start](#quick-start) • [Installation](#installation) • [Supported Agents](#supported-agents) • [Contributing](#contributing)

</div>

---

## Table of Contents

- [What Is GTI Skills?](#what-is-gti-skills)
- [Skill Catalog](#skill-catalog)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Supported Agents](#supported-agents)
- [Compatibility](#compatibility)
- [How Skills Work](#how-skills-work)
- [Skill Anatomy](#skill-anatomy)
- [Authoring Skills](#authoring-skills)
- [Repository Layout](#repository-layout)
- [Contributing](#contributing)
- [Security](#security)
- [Documentation](#documentation)
- [About GTI](#about-gti)
- [License](#license)

## What Is GTI Skills?

Agent skills are self-contained folders that teach a coding agent how to handle one kind of task: when to activate, what to ask, which tools to run, and what the result must look like. The agent loads a skill only when a request matches its description, so skills add capability without bloating every prompt.

GTI Skills is the collection the [Gio Technology Investments (GTI)](https://github.com/GioTechnologyInvestments) team uses day to day. Every skill in it:

- **Solves one job end to end.** No generic prompt templates. Each skill was extracted from a real, repeated workflow.
- **Follows the open standard.** Skills use the [Agent Skills](https://agentskills.io/specification) layout, so one source works in every supported agent.
- **Loads progressively.** A short `SKILL.md` is always read; detailed guides in `references/` are read only when a step needs them.
- **Is self-sufficient.** Skills that need external tools ship a script that detects and installs what is missing.
- **Answers in your language.** Skill source is English, but the agent always replies in the language you write in.

## Skill Catalog

| Skill | Description | Requirements | Docs |
|-------|-------------|--------------|------|
| **Art Director** | Local-first graphic design studio. Designs photo-led, layered social posts, posters, covers, and slides in HTML/CSS/SVG with a professional style guide and effects toolkit, iterates in a browser Live Mode, audits, and exports PNG, JPEG, SVG, or PDF. Never calls generative image APIs. | Node 20+, Chromium | [README](skills/artdirector/README.md) |
| **Video to Skill** | Turns a YouTube tutorial into a ready-to-use, validated skill folder by cross-referencing the transcript with keyframes of code, terminals, and UI. | Python 3.8+, ffmpeg, yt-dlp | [README](skills/video-to-skill/README.md) |
| **Video to Markdown** | Converts a YouTube or local video into study notes, a tutorial, a full transcript, or meeting notes with timestamp links and inline keyframes. | Python 3.8+, ffmpeg, yt-dlp | [README](skills/video-to-markdown/README.md) |
| **UX Psychology Review** | Reviews forms, onboarding, signup, upgrade, and pricing screens against six behavioral principles and returns before and after changes that pass an ethics check. | None | [README](skills/ux-psychology-review/README.md) |

## Quick Start

Requires Node.js 20 or newer. Install a skill into Claude Code for the current project and use it immediately:

```bash
git clone https://github.com/callmeteus/gti-skills.git
cd gti-skills
node packages/cli install --harness claude --skill video-to-markdown --dest /path/to/your/project
```

Start a new agent session in that project and ask in plain language:

```text
Convert https://youtube.com/watch?v=VIDEO_ID into study notes with timestamps.
```

The agent matches the request to the skill, installs any missing dependencies, and writes the Markdown file.

## Installation

The CLI in [packages/cli](packages/cli/README.md) copies a skill into the folder each agent reads. It needs only Node.js.

```bash
node packages/cli install --harness <ids|all> [--skill <ids|all>] [--scope project|user] [--dest <dir>] [--dry-run]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--harness` | Required | Comma separated agent ids from [Supported Agents](#supported-agents), or `all` |
| `--skill` | `all` | Comma separated skill ids, or `all` |
| `--scope` | `project` | `project` installs into `--dest`; `user` installs into your home directory for every project |
| `--dest` | Current directory | Project root for the project scope |
| `--dry-run` | Off | Print what would be written |

Examples (the same commands work in macOS, Linux, and Windows PowerShell):

```bash
node packages/cli install --harness cursor,claude --skill video-to-skill,video-to-markdown --dest ../my-project
node packages/cli install --harness all --scope user
node packages/cli install --harness opencode --skill artdirector --dry-run
```

Reinstalling replaces the skill folder. Restart the agent session afterwards so it picks up the new skill.

Other CLI commands:

| Command | Purpose |
|---------|---------|
| `node packages/cli list` | Show skills and agents |
| `node packages/cli validate` | Validate every skill |
| `node packages/cli build` | Sync shared scripts and regenerate the per-agent guides (contributors) |
| `node packages/cli check` | Fail when synced or generated files are stale (CI) |

### Copy by hand

A skill is one self-contained folder, identical for every agent. Copy `skills/<skill-id>` into the folder your agent reads (see [Supported Agents](#supported-agents)).

macOS and Linux:

```bash
mkdir -p /path/to/your/project/.claude/skills
cp -r skills/video-to-markdown /path/to/your/project/.claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force C:\path\to\your\project\.claude\skills | Out-Null
Copy-Item -Recurse skills\video-to-markdown C:\path\to\your\project\.claude\skills\
```

Each skill carries a short guide per agent in `skills/<skill-id>/harnesses/<agent-id>/GUIDE.md`: install paths, how to invoke the skill, and how to confirm it loaded. The skill itself is never duplicated per agent.

> **Art Director needs its engine.** It drives the package in `packages/artdirector`. Build it once (see the [Art Director installation](skills/artdirector/README.md#installation)) and use the `install` command, which records where the package lives.

## Supported Agents

The registry [packages/cli/registry/harnesses.json](packages/cli/registry/harnesses.json) is the single source of truth for these folders.

| Agent | Id | Project folder | User folder | Path source |
|-------|----|----------------|-------------|-------------|
| Cursor / Cursor CLI | `cursor` | `.cursor/skills` | `~/.cursor/skills` | [Official docs](https://cursor.com/docs/skills) |
| Claude / Claude Code | `claude` | `.claude/skills` | `~/.claude/skills` | [Official docs](https://code.claude.com/docs/en/skills) |
| Antigravity | `antigravity` | `.agents/skills` | `~/.gemini/antigravity/skills` | [Official docs](https://antigravity.google/docs/skills) |
| OpenCode | `opencode` | `.opencode/skills` | `~/.config/opencode/skills` | [Official docs](https://opencode.ai/docs/skills/) |
| Cline | `cline` | `.cline/skills` | `~/.cline/skills` | [Official docs](https://docs.cline.bot/customization/skills) |
| Kilo Code | `kilo` | `.kilocode/skills` | `~/.kilocode/skills` | [Official docs](https://kilo.ai/docs/customize/skills) |
| Kiro | `kiro` | `.kiro/skills` | `~/.kiro/skills` | [Official docs](https://kiro.dev/docs/skills/) |
| Codex | `codex` | `.agents/skills` | `~/.agents/skills` | [Community report](https://developers.openai.com/codex/skills) |
| GitHub Copilot | `copilot` | `.github/skills` | `~/.copilot/skills` | [Official docs](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/create-skills) |
| Muse Code | `muse` | `.agents/skills` | `~/.agents/skills` | [Community report](https://www.withone.ai/blog/muse-code-skills-not-mcp) |

Notes:

- Antigravity, Codex, and Muse Code share the `.agents/skills` project folder. Installing for several of them writes the folder once.
- Antigravity 2.0 documents `~/.gemini/config/skills` for user scope, and older versions use `.agent/skills` for projects. The registry uses the paths of the current IDE and codelab; edit the registry if your version differs.
- Cursor, OpenCode, and Copilot also read `.claude/skills` and `.agents/skills`, so a skill installed there is found by more than one agent.
- Paths marked as a community report were not confirmed in official documentation. Run the agent's own skill listing to verify.
- The OpenCode `/artdirector` command is installed with the Art Director skill at project scope.

## Compatibility

| Skill | Node.js | Python | ffmpeg and yt-dlp | Network |
|-------|:-------:|:------:|:-----------------:|:-------:|
| Art Director | 20+ | 3.8+, optional (photo scripts) | No | Fonts at render time; photo search |
| Video to Skill | No | 3.8+ | Yes | YouTube |
| Video to Markdown | No | 3.8+ | Yes | YouTube |
| UX Psychology Review | No | No | No | No |

| Platform | Status |
|----------|--------|
| macOS (Intel and Apple Silicon) | Supported. Apple Silicon uses `mlx-whisper` for faster local transcription. |
| Linux | Supported. System packages install through `apt-get`, `dnf`, or `pacman`. |
| Windows | Supported. System packages install through `winget`. |

## How Skills Work

```text
  "Turn this talk into notes"
              │
              v
  ┌───────────────────────┐   name and description of every
  │      Coding agent     │ <─ installed skill are matched
  └───────────┬───────────┘   against the request
              │ match
              v
  ┌───────────────────────┐
  │ <skill>/SKILL.md      │   instructions load only
  └───────────┬───────────┘   for the matched skill
              │
     ┌────────┼─────────────┐
     v        v             v
  references/ scripts/    assets/
  read when   run instead templates and
  a step      of retyping examples
  needs them  logic
              │
              v
   result, explained in the user's language
```

## Skill Anatomy

Every skill uses the Agent Skills layout (progressive disclosure) with purpose-named subfolders:

```text
skills/<skill-id>/
├── skill.json              # Repository manifest (not installed)
├── SKILL.md                # Frontmatter + instructions, under 500 lines
├── README.md               # Human documentation (not installed)
├── references/             # Detailed guides, loaded on demand
│   ├── workflow/           #   one numbered file per step
│   └── quality/            #   checklists and anti-patterns
├── scripts/                # Code the agent runs
│   ├── setup/
│   └── <purpose>/
├── assets/                 # Templates and examples the skill outputs
│   ├── templates/
│   └── examples/
└── harnesses/              # One short guide per coding agent
    └── <agent-id>/GUIDE.md #   generated: install, invoke, verify
```

Minimal `SKILL.md`:

```markdown
---
name: my-skill
description: >-
  What the skill does. Use when the user asks for ... Do not use for ...
---

# My Skill

## Core Rule

Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

## When to use
...
```

| Frontmatter field | Required | Purpose |
|-------------------|----------|---------|
| `name` | Yes | Kebab-case skill ID, equal to the folder name |
| `description` | Yes | What the agent matches against the request, 1024 characters at most |
| `compatibility` | No | Runtime requirements, 500 characters at most |
| `license` | No | License of the skill when it differs from the repository |
| `metadata` | No | Extra string keys, such as `display-name` |

## Authoring Skills

Every skill in this repository must follow these rules. The full contract lives in [AGENTS.md](AGENTS.md).

| Rule | Requirement |
|------|-------------|
| **Language rule** | `SKILL.md` instructs the agent to respond in the user's language, regardless of the language of the skill or the analyzed content. Non-negotiable. |
| **English source** | Skill files, references, and READMEs are written in English. |
| **Single purpose** | One skill, one job. Split broad skills instead of growing them. |
| **Precise triggers** | The `description` states when to use the skill and when not to. |
| **Organized folders** | Group files into purpose-named subfolders; link each reference from the step that needs it. |
| **Scripts over prose** | Logic the agent would retype goes in `scripts/`. |
| **Self-sufficient** | External tools are detected and installed by a bundled script. |
| **Field-tested** | A skill is used on real work before it is merged. |
| **Standard README** | Every README follows the [README Standard](AGENTS.md#readme-standard) in AGENTS.md. |

Create a skill with the scaffold from Video to Skill, or by hand, then run:

```bash
node packages/cli validate
node packages/cli build
```

## Repository Layout

```text
gti-skills/
├── AGENTS.md                  # Rules for every skill and package
├── README.md                  # This file
├── skills/                    # One folder per skill, the source of truth
│   ├── artdirector/
│   ├── ux-psychology-review/
│   ├── video-to-markdown/
│   └── video-to-skill/
├── packages/                  # Code packages
│   ├── cli/                   # list, validate, build, check, install
│   ├── artdirector/           # Engine behind the Art Director skill
│   └── python/
│       └── shared/            # Scripts shared by the video skills
└── .github/workflows/         # CI: validation and tests
```

Every skill folder is the single copy of that skill. Agents differ only in the install folder and a few usage details, which each skill documents in its own `harnesses/` folder.

## Contributing

Contributions are welcome, both new skills and improvements to existing ones.

1. Fork the repository and create a branch.
2. Add `skills/<kebab-case-name>/` with `skill.json`, `SKILL.md`, and a `README.md` that follows the [skill README template](AGENTS.md#skill-readme-template).
3. Put detail in `references/`, helpers in `scripts/`, and static files in `assets/`.
4. Document every script, including flags and defaults, and put tests in the skill's `tests/` folder.
5. Run `node packages/cli build` and `npm test`, and commit the synced and generated files.
6. Add the skill to the [Skill Catalog](#skill-catalog), [Compatibility](#compatibility), and [Repository Layout](#repository-layout) sections.
7. Open a pull request describing the workflow the skill automates and how you tested it.

Pull request checklist:

- [ ] `SKILL.md` has `name` and `description` frontmatter, and `name` equals the folder name
- [ ] `SKILL.md` includes the language Core Rule
- [ ] All files are in English
- [ ] `node packages/cli check` and `npm test` pass
- [ ] README follows the [skill README template](AGENTS.md#skill-readme-template): same header, badges, and section order
- [ ] No `GUIDE.md` or synced shared script was edited by hand

To add a coding agent, add it to [packages/cli/registry/harnesses.json](packages/cli/registry/harnesses.json) and rebuild.

To report a bug or request a skill, [open an issue](https://github.com/callmeteus/gti-skills/issues).

## Security

Skills run commands on your machine with the permissions of your agent. Read a skill's `SKILL.md` and scripts before installing it, and review install prompts (for example `sudo`, `winget`, or `pip install`) before approving them.

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/callmeteus/gti-skills/security/advisories/new) rather than public issues.

## Documentation

| Document | Contents |
|----------|----------|
| [AGENTS.md](AGENTS.md) | Rules every skill and package must follow, including the README Standard |
| [packages/cli/README.md](packages/cli/README.md) | The `list`, `validate`, `build`, `check`, and `install` commands |
| [packages/python/shared/README.md](packages/python/shared/README.md) | Scripts shared by the video skills |
| [packages/artdirector/README.md](packages/artdirector/README.md) | Art Director engine source and scripts |
| [packages/artdirector/ARCHITECTURE.md](packages/artdirector/ARCHITECTURE.md) | Art Director design decisions and limitations |
| [skills/artdirector/README.md](skills/artdirector/README.md) | Art Director installation, CLI, and workflow |
| [skills/video-to-skill/README.md](skills/video-to-skill/README.md) | Generating skills from tutorial videos |
| [skills/video-to-markdown/README.md](skills/video-to-markdown/README.md) | Converting videos into Markdown notes |
| [skills/ux-psychology-review/README.md](skills/ux-psychology-review/README.md) | Reviewing conversion screens with UX psychology principles |

## About GTI

[Gio Technology Investments (GTI)](https://github.com/GioTechnologyInvestments) is a technology investment and development group focused on building practical tools.

## License

No repository-wide license has been declared yet. Skills may carry their own license:

| Skill | License |
|-------|---------|
| Art Director | MIT, see [LICENSE](packages/artdirector/LICENSE) and [NOTICE.md](packages/artdirector/NOTICE.md) |
| Video to Skill | Not declared |
| Video to Markdown | Not declared |
| UX Psychology Review | Not declared |

Until a root license is added, contact the maintainers before redistributing skills without a declared license.
