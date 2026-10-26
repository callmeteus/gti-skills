# AGENTS.md - gti-skills

## Core Rule
All skills in this repository MUST instruct the agent to respond in the user's language, regardless of the language used in the skill content, instructions, or examples. 

This rule is non-negotiable and must be included in every `SKILL.md` created or modified in this repository. 

## Skill Format
All skills must follow the OpenCode/Claude Code skill format with:
- Frontmatter containing `name` and `description`
- Clear instructions
- Proper examples where applicable
- Tools/dependencies listed if needed

## Language
All skill files must be written in English. 
The ONLY thing that must be localized is: "respond in the user's language, regardless of..." which is stated in the core rule above.

## README Standard
Every `README.md` in this repository follows one of two fixed templates: the **root README** (`README.md`) or the **skill README** (`skills/<name>/README.md`). Section names, order, header layout, badges, and table formats are fixed so every skill reads the same way. When you add or edit a README, match the template exactly and keep the existing skill READMEs aligned with it.

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
| 6 | `## Installation` | Required | bash and PowerShell commands, a link to the root installation table, and optional dependency pre-install |
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
[![Harnesses](https://img.shields.io/badge/harness-Claude%20Code%20%7C%20OpenCode%20%7C%20Cursor-8A63D2.svg)](#installation)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](#requirements)
[![License](https://img.shields.io/badge/license-<license>-yellow.svg)](#license)

[Quick Start](#quick-start) • [Usage](#usage) • [Reference](#reference) • [Troubleshooting](#troubleshooting)

</div>

---
```

- Badges always appear in this order: Format, Runtime, Harnesses, Platforms, License. Use `license-not%20declared-lightgrey` when the skill has no license.
- The navigation line is always the four links above.

### Troubleshooting format
```markdown
<details>
<summary><strong>Symptom as the user sees it</strong></summary>

Cause in one sentence. Then the fix, with a command block when one applies.

</details>
```

### Root README template
The root `README.md` uses these sections in this order: centered header (title, tagline, summary, badges, navigation), `## Table of Contents`, `## What Is GTI Skills?`, `## Skill Catalog`, `## Quick Start`, `## Installation`, `## Compatibility`, `## How Skills Work`, `## Skill Anatomy`, `## Authoring Skills`, `## Repository Layout`, `## Contributing`, `## Security`, `## Documentation`, `## About GTI`, `## License`.

When a skill is added, removed, or renamed, update the Skill Catalog, Compatibility, Repository Layout, Documentation, and License tables, plus the skill count badge, and the [Skill naming](#skill-naming) table above. Tables list skills by display name; paths and commands use the skill ID.
