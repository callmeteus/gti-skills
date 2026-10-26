<div align="center">

# GTI Skills

> Production-tested agent skills for Claude Code, OpenCode, Cursor, and any `SKILL.md` harness

**Drop-in skills that teach coding agents real workflows: design graphics from HTML, turn tutorials into skills, and turn videos into documentation.**

[![Skills](https://img.shields.io/badge/skills-3-blue.svg)](#skill-catalog)
[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#skill-anatomy)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-supported-8A63D2.svg)](#installation)
[![OpenCode](https://img.shields.io/badge/OpenCode-supported-111111.svg)](#installation)
[![Cursor](https://img.shields.io/badge/Cursor-supported-0A0A0A.svg)](#installation)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)
[![GitHub stars](https://img.shields.io/github/stars/callmeteus/gti-skills?style=flat)](https://github.com/callmeteus/gti-skills/stargazers)

[Skill Catalog](#skill-catalog) • [Quick Start](#quick-start) • [Installation](#installation) • [Authoring Skills](#authoring-skills) • [Contributing](#contributing)

</div>

---

## Table of Contents

- [What Is GTI Skills?](#what-is-gti-skills)
- [Skill Catalog](#skill-catalog)
- [Quick Start](#quick-start)
- [Installation](#installation)
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
- **Is self-sufficient.** Skills that need external tools ship a script that detects and installs what is missing.
- **Answers in your language.** Skill source is English, but the agent always replies in the language you write in.
- **Is portable.** Plain `SKILL.md` folders that work across Claude Code, OpenCode, Cursor, and other compatible harnesses.

## Skill Catalog

| Skill | Description | Requirements | Docs |
|-------|-------------|--------------|------|
| **Art Director** | Local-first graphic design studio. Designs posters, social cards, infographics, covers, and slides in HTML/CSS/SVG, iterates in a browser Live Mode, audits, and exports PNG, JPEG, SVG, or PDF. Never calls generative image APIs. | Node 20+, Chromium | [README](skills/artdirector/README.md) |
| **Video to Skill** | Turns a YouTube tutorial into a ready-to-use `SKILL.md` by cross-referencing the transcript with keyframes of code, terminals, and UI. | Python 3, ffmpeg, yt-dlp | [README](skills/video-to-skill/README.md) |
| **Video to Markdown** | Converts a YouTube or local video into structured Markdown notes with timestamps, inline keyframes, and extracted commands. | Python 3, ffmpeg, yt-dlp | [README](skills/video-to-markdown/README.md) |

## Quick Start

Install a skill for Claude Code at user scope and use it immediately:

```bash
git clone https://github.com/callmeteus/gti-skills.git
mkdir -p ~/.claude/skills
cp -r gti-skills/skills/video-to-markdown ~/.claude/skills/
```

Start a new agent session and ask in plain language:

```text
Convert https://youtube.com/watch?v=VIDEO_ID into study notes with timestamps.
```

The agent matches the request to the skill, installs any missing dependencies, and writes the Markdown file.

## Installation

Each skill is a folder. Copy it into the skills directory of your harness: project scope makes it available in one repository, user scope makes it available everywhere.

| Harness | Project scope | User scope |
|---------|---------------|------------|
| Claude Code | `.claude/skills/<skill>/` | `~/.claude/skills/<skill>/` |
| OpenCode | `.opencode/skills/<skill>/` | `~/.config/opencode/skills/<skill>/` |
| Cursor | `.cursor/skills/<skill>/` | `~/.cursor/skills/<skill>/` |
| Generic agents | `.agents/skills/<skill>/` | `~/.agents/skills/<skill>/` |

macOS and Linux:

```bash
cp -r gti-skills/skills/video-to-skill ~/.claude/skills/
```

Windows (PowerShell):

```powershell
Copy-Item -Recurse gti-skills\skills\video-to-skill "$env:USERPROFILE\.claude\skills\"
```

Install every copy-based skill at once:

```bash
for skill in video-to-skill video-to-markdown; do cp -r "gti-skills/skills/$skill" ~/.claude/skills/; done
```

> **Art Director is a Node package with its own installer.** Build it once and run `artdirector install --agent <harness>` instead of copying the folder. See [Art Director installation](skills/artdirector/README.md#installation).

After installing, restart the agent session so the harness picks up the new skill.

## Compatibility

| Skill | Claude Code | OpenCode | Cursor | Generic `.agents` |
|-------|:-----------:|:--------:|:------:|:-----------------:|
| Art Director | Yes | Yes (plus `/artdirector` command) | Yes | Yes |
| Video to Skill | Yes | Yes | Yes | Yes |
| Video to Markdown | Yes | Yes | Yes | Yes |

| Platform | Status |
|----------|--------|
| macOS (Intel and Apple Silicon) | Supported. Apple Silicon uses `mlx-whisper` for faster local transcription. |
| Linux | Supported. System packages install through `apt`, `dnf`, or `pacman`. |
| Windows | Supported. System packages install through `winget` or `choco`. |

## How Skills Work

```text
  "Turn this talk into notes"
              │
              v
  ┌───────────────────────┐   descriptions of every
  │     Agent harness     │ <─ installed skill are
  └───────────┬───────────┘   matched against the request
              │ match
              v
  ┌───────────────────────┐
  │ skills/<name>/SKILL.md│   full instructions load
  └───────────┬───────────┘   only for the matched skill
              │
     ┌────────┼─────────────┐
     v        v             v
  ask for   run helper    follow reference
  context   scripts       docs and rules
     └────────┼─────────────┘
              v
   result, explained in the user's language
```

## Skill Anatomy

```text
skills/<skill-name>/
├── SKILL.md        # Frontmatter + agent instructions (required)
├── README.md       # Human documentation (required in this repository)
├── scripts/        # Helper scripts the agent runs (optional)
└── reference/      # Extra docs loaded on demand (optional)
```

Minimal `SKILL.md`:

```markdown
---
name: my-skill
description: >-
  What the skill does and exactly when the agent should use it.
  Name concrete triggers. Say when NOT to use it.
---

# my-skill

## Core Rule
Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

## When to use
- The user asks to ...

## Instructions
1. ...
```

| Frontmatter field | Required | Purpose |
|-------------------|----------|---------|
| `name` | Yes | Kebab-case identifier, matches the folder name |
| `description` | Yes | What the harness matches against the user's request |
| `license` | No | License of the skill when it differs from the repository |
| `compatibility` | No | Harnesses the skill was tested with |

## Authoring Skills

Every skill in this repository must follow these rules. The full contract lives in [AGENTS.md](AGENTS.md).

| Rule | Requirement |
|------|-------------|
| **Language rule** | `SKILL.md` instructs the agent to respond in the user's language, regardless of the language of the skill or the analyzed content. Non-negotiable. |
| **English source** | Skill files, references, and READMEs are written in English. |
| **Single purpose** | One skill, one job. Split broad skills instead of growing them. |
| **Precise triggers** | The `description` states when to use the skill and when not to. |
| **Actionable steps** | Instructions tell the agent what to do, in order, with real commands. |
| **Self-sufficient** | External tools are detected and installed by a bundled script. |
| **Field-tested** | A skill is used on real work before it is merged. |
| **Standard README** | Every skill README follows the [README Standard](AGENTS.md#readme-standard) in AGENTS.md. |

## Repository Layout

```text
gti-skills/
├── AGENTS.md                  # Rules for every skill in this repository
├── README.md                  # This file
└── skills/
    ├── artdirector/           # Node package: CLI, studio, renderer, skill
    ├── video-to-skill/        # SKILL.md + transcript and frame scripts
    └── video-to-markdown/     # SKILL.md + dependency installer
```

## Contributing

Contributions are welcome, both new skills and improvements to existing ones.

1. Fork the repository and create a branch.
2. Add `skills/<kebab-case-name>/` with a `SKILL.md` and a `README.md` that follows the [README Standard](AGENTS.md#readme-standard).
3. Put helper scripts in `scripts/` and document every one of them, including flags and defaults.
4. Test the skill in a real agent session on at least one harness.
5. Add the skill to the [Skill Catalog](#skill-catalog) and [Compatibility](#compatibility) tables.
6. Open a pull request describing the workflow the skill automates and how you tested it.

Pull request checklist:

- [ ] `SKILL.md` has `name` and `description` frontmatter
- [ ] `SKILL.md` includes the language Core Rule
- [ ] All files are in English
- [ ] Every script referenced in `SKILL.md` exists in the folder
- [ ] README follows the [skill README template](AGENTS.md#skill-readme-template): same header, badges, and section order

To report a bug or request a skill, [open an issue](https://github.com/callmeteus/gti-skills/issues).

## Security

Skills run commands on your machine with the permissions of your agent. Read a skill's `SKILL.md` and scripts before installing it, and review install prompts (for example `sudo`, `winget`, or `pip install`) before approving them.

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/callmeteus/gti-skills/security/advisories/new) rather than public issues.

## Documentation

| Document | Contents |
|----------|----------|
| [AGENTS.md](AGENTS.md) | Rules every skill must follow, including the README Standard |
| [skills/artdirector/README.md](skills/artdirector/README.md) | Art Director installation, CLI, and workflow |
| [skills/artdirector/ARCHITECTURE.md](skills/artdirector/ARCHITECTURE.md) | Art Director design decisions and limitations |
| [skills/video-to-skill/README.md](skills/video-to-skill/README.md) | Generating skills from tutorial videos |
| [skills/video-to-markdown/README.md](skills/video-to-markdown/README.md) | Converting videos into Markdown notes |

## About GTI

[Gio Technology Investments (GTI)](https://github.com/GioTechnologyInvestments) is a technology investment and development group focused on building practical tools.

## License

No repository-wide license has been declared yet. Skills may carry their own license:

| Skill | License |
|-------|---------|
| Art Director | MIT, see [LICENSE](skills/artdirector/LICENSE) and [NOTICE.md](skills/artdirector/NOTICE.md) |
| Video to Skill | Not declared |
| Video to Markdown | Not declared |

Until a root license is added, contact the maintainers before redistributing skills without a declared license.
