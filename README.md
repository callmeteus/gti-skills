<div align="center">

# GTI AI Skills

> Production-tested agent skills for ten coding agents

**Drop-in skills that teach coding agents real workflows: design graphics from HTML, turn tutorials into skills, and turn videos into documentation. Written once, installed into Cursor, Claude Code, Antigravity, OpenCode, Cline, Kilo, Kiro, Codex, Copilot, and Muse Code.**

[![Skills](https://img.shields.io/badge/skills-30-blue.svg)](#skill-catalog)
[![Format](https://img.shields.io/badge/format-Agent%20Skills-green.svg)](#skill-anatomy)
[![Agents](https://img.shields.io/badge/agents-10%20supported-8A63D2.svg)](#supported-agents)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)
[![GitHub stars](https://img.shields.io/github/stars/gtihq/ai-skills?style=flat)](https://github.com/gtihq/ai-skills/stargazers)

[Skill Catalog](#skill-catalog) • [Quick Start](#quick-start) • [Installation](#installation) • [Supported Agents](#supported-agents) • [Contributing](#contributing)

</div>

---

## Table of Contents

- [What Is GTI AI Skills?](#what-is-gti-ai-skills)
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

## What Is GTI AI Skills?

Agent skills are self-contained folders that teach a coding agent how to handle one kind of task: when to activate, what to ask, which tools to run, and what the result must look like. The agent loads a skill only when a request matches its description, so skills add capability without bloating every prompt.

GTI AI Skills is the collection the [Gio Technology Investments (GTI)](https://github.com/GioTechnologyInvestments) team uses day to day. Every skill in it:

- **Solves one job end to end.** No generic prompt templates. Each skill was extracted from a real, repeated workflow.
- **Follows the open standard.** Skills use the [Agent Skills](https://agentskills.io/specification) layout, so one source works in every supported agent.
- **Loads progressively.** A short `SKILL.md` is always read; detailed guides in `references/` are read only when a step needs them.
- **Is self-sufficient.** Skills that need external tools ship a script that detects and installs what is missing.
- **Answers in your language.** Skill source is English, but the agent always replies in the language you write in.

## Skill Catalog

| Skill | Packs | Description | Requirements | Docs |
|-------|-------|-------------|--------------|------|
| **Art Director** | art | Local-first graphic design studio. Designs photo-led, layered social posts, posters, covers, and slides in HTML/CSS/SVG with a professional style guide and effects toolkit, iterates in a browser Live Mode, audits, and exports PNG, JPEG, SVG, or PDF. Never calls generative image APIs. | Node 20+, Chromium | [README](skills/artdirector/README.md) |
| **Video to Skill** | coding | Turns a YouTube or X tutorial video into a ready-to-use, validated skill folder by cross-referencing the transcript with keyframes of code, terminals, and UI. | Python 3.8+, ffmpeg, yt-dlp | [README](skills/video-to-skill/README.md) |
| **Video to Markdown** | research | Converts a YouTube, X, or local video into study notes, a tutorial, a full transcript, or meeting notes with timestamp links and inline keyframes. | Python 3.8+, ffmpeg, yt-dlp | [README](skills/video-to-markdown/README.md) |
| **Video Editor** | art, social | Measured local video editing: cut, trim silence, speed, reframe, loudness, styled captions, seekable HTML motion graphics from Motion.md guides and a brand kit, platform export, and a static review page. | Node 20+, ffmpeg and ffprobe; Playwright and Chromium for motion graphics | [README](skills/video-editor/README.md) |
| **UX Psychology Review** | design | Reviews forms, onboarding, signup, upgrade, and pricing screens against six behavioral principles and returns before and after changes that pass an ethics check. | None | [README](skills/ux-psychology-review/README.md) |
| **Unslop Interface** | design, coding | Removes the generated look from dashboards and app screens in eight ordered passes: spacing, radius, color, icons, typography and copy, data display, actions and structure, and states and feel. | None | [README](skills/unslop-interface/README.md) |
| **Frontend Design Review** | design, coding | Reviews frontend work against the design system and three quality pillars with ranked issues and an accessibility grade, or builds distinctive interfaces from a committed direction; calls Unslop Interface in both modes. | None | [README](skills/frontend-design-review/README.md) |
| **Gestures** | coding, design | Builds drags, swipes, sheets, and hold-to-confirm that track the finger 1:1 and stay interruptible, in plain JavaScript or any framework, with a dependency-free gesture module and a recipe per framework. Adapted from Emil Kowalski's skill. | A browser with Pointer Events | [README](skills/gestures/README.md) |
| **GTI** | coding, personal | Keeps gti-skills current with one command (`/gti update`): updates every installed gti-skills skill from the latest GitHub commit, installs skills that are new in that commit for the packs already in use, and installs or refreshes the gti-skills MCP servers in a managed folder that agent configs point at, with backups. Works without a clone. | Node 18+, Python 3.10+ for MCP servers | [README](skills/gti/README.md) |
| **Maestro** | coding, personal | Orchestrates a request as delegated tasks: plans on the strongest model, remembers the user's model preferences, discovers the providers and models the harness can run, routes each task by context, speed, cost, and health, probes orchestration MCP servers such as OpenAgents, spawns cheaper workers, reuses their chats for review and fixes, falls back on rate limits, and never does the work itself. Detects Paseo, Claude and Claude Code, Cursor, Codex, OpenCode, Kilo, Cline, Command Code, Pi, Hermes, OpenAgents, and other ACP harnesses. | A harness with subagents, a worker CLI on PATH (with Python 3.8+), or an MCP orchestration server; Git | [README](skills/maestro/README.md) |
| **Maestro Council** | coding, personal | Convenes 3 to 7 agents on different models that write blind openings, debate each other directly for up to 3 rounds, and cast a blind vote, while Maestro chairs, checks for herding and collusion, and writes the verdict with the dissent. Entry point into Maestro, which it installs alongside. | Maestro; same as Maestro | [README](skills/maestro-council/README.md) |
| **Maestro Plan** | coding, personal | Writes Maestro's plan for a request (tasks, waves, routes, done criteria) and starts no worker; `/maestro resume` runs it later. Entry point into Maestro, which it installs alongside. | Maestro; same as Maestro | [README](skills/maestro-plan/README.md) |
| **Maestro Review** | coding, personal | Reviews a pull request or the local diff with Maestro's panel of 1 to 5 independent reviewers and a consensus built on evidence; posts only with permission. Entry point into Maestro, which it installs alongside. | Maestro; same as Maestro | [README](skills/maestro-review/README.md) |
| **Maestro Simple** | coding, personal | Simple orchestration through Maestro: one task, one cheap worker chat, and Maestro's evidence review in the same chat. Entry point into Maestro, which it installs alongside. | Maestro; same as Maestro | [README](skills/maestro-simple/README.md) |
| **Maestro Teach** | coding, personal | Maestro's teacher and student mode: a teacher writes a lesson, at least 3 students per iteration follow it, and the lesson is revised until they master the task with shorter output. Entry point into Maestro, which it installs alongside. | Maestro; same as Maestro | [README](skills/maestro-teach/README.md) |
| **Maestro Team** | coding, personal | Maestro with team mode on for long, hard runs: parallel workers share findings through mailboxes, a findings board, and task locks. Entry point into Maestro, which it installs alongside. | Maestro; same as Maestro | [README](skills/maestro-team/README.md) |
| **Better Tests** | coding | Makes agents write tests that catch bugs: real dependencies over mocks, public API assertions, a failing test before every fix, mandatory Stryker and fast-check for JS and TS (installed outside the project), and safe pruning of brittle suites. | Node 18+ and npm for JS and TS projects | [README](skills/better-tests/README.md) |
| **Web Performance Audit** | coding | Audits page load with the Chrome DevTools MCP server: a throttled trace, Core Web Vitals insights, network, accessibility snapshot, and codebase checks, with fixes ranked by measured savings. | Node LTS, Chrome, chrome-devtools-mcp | [README](skills/web-performance-audit/README.md) |
| **Fast CI** | coding, infra | Makes CI as fast as possible without letting it lie: audits the last 150 runs on any CI (GitHub Actions, Forgejo, Gitea, Woodpecker, GitLab, Jenkins, Kubernetes and K3s runners, or manual scripts) split into waiting, setup, and running, then lands small measured changes (warm runners, baked images, seeded caches, fast tools, time-balanced shards, proven test selection, hooks, budgets) until PRs get results in under a minute while the full suite still gates main, and checks rollback scripts, rollback jobs, and migrations with timed rollback drills. | Python 3.8+ | [README](skills/fast-ci/README.md) |
| **Leak Guard** | coding, infra | Installs, checks, tunes, and removes a local pre-tool guard that blocks secret exfiltration across coding agents, then scans transcripts, shell history, git history, guard events, and hidden instructions for leaks that already happened, with a redacted report and a rotation checklist. | Node 18+ | [README](skills/leak-guard/README.md) |
| **SEO Growth** | coding, research | Runs agency-style SEO inside the codebase: a live technical check (robots.txt, sitemap, soft 404s, redirects, canonicals, schema, and what Googlebot and AI crawlers actually receive), on-page fixes, Search Console mining for long questions, page-2 queries, and low CTR, buyer pages (comparison, alternatives, FAQ, clusters), and AI search visibility. | Python 3.8+ | [README](skills/seo-growth/README.md) |
| **Security Audit** | coding | Defensive, source-first security review in three modes (guidance, diff review, full audit) that maps trust boundaries into a coverage ledger, hunts with isolated agents, has fresh agents try to disprove every candidate, and writes validated findings, reports, and SARIF. Adapted from Cloudflare's skill. | Node 18+, Git; a sandbox to run target code | [README](skills/security-audit/README.md) |
| **X Research** | research, social | Researches X (Twitter) through a free, browser-based MCP server with a call budget, typed errors, and a web search fallback that the answer discloses. | Python 3.10+, Playwright Chromium, twitter MCP, X account | [README](skills/x-research/README.md) |
| **LLM Fine Tuning** | coding, research | Plans, runs, and ships LoRA fine-tunes on any platform: decides whether to fine-tune at all, checks and splits chat rows with exact token counts, picks an adapter that merges exactly, waits for approval before spending, probes behaviour on every checkpoint, verifies merges token by token, and evaluates against the base on the same harness. Bundles the Inkling 2 Small on Tinker recipe. | Python 3.9+; recipe: Python 3.11+, Tinker key | [README](skills/llm-fine-tuning/README.md) |
| **Weight Space Programming** | coding, research | Reads, fixes, and writes neural network weights by reasoning about what each layer computes, with no training: infers a checkpoint's task, removes failure directions with minimal edits, and hand-builds small networks, under a forward-pass budget and held-out evaluation. | Python 3.9+, numpy; PyTorch optional | [README](skills/weight-space-programming/README.md) |
| **Improve Codebase Architecture** | coding | Finds refactors that make a codebase easier to change and test, starting where git history shows the most change, and presents them in an HTML report with before and after diagrams written in everyday coding terms. Adapted from Matt Pocock's skill. | Git, Python 3.8+ | [README](skills/improve-codebase-architecture/README.md) |
| **Untangle Codebase** | coding | Runs one long refactor of a whole codebase or area: lists every hidden link, needless link, surplus piece, and special case, redesigns from today's requirements, and fixes everything one verified commit at a time, with an import graph, co-change history, a code skeleton, and a special-case count to measure progress. Adapted from Caldo's skill. | Git, Python 3.8+, a test command | [README](skills/untangle-codebase/README.md) |
| **Skill Distill** | coding | Turns a good coding-agent session into a skill that an open-weight or local model can follow: writes the skill, runs the student three times in tmux on fresh copies of the starting state, fixes the skill at the first divergence, and repeats until the student matches and the user accepts. Adapted from Sybil Solutions' skill. | Python 3.10+, git, tmux, a student harness (omp, pi, Codex, Claude Code, or opencode) | [README](skills/skill-distill/README.md) |
| **Disk Cleanup** | personal, coding | Frees disk space on Windows, Linux, and macOS: scans the chosen drives in parallel for temp files, caches, logs, trash, duplicates, old downloads, build output, Docker and package manager leftovers, system leftovers, settings that waste space, and unused programs, then deletes what the user picks at one of three levels (safe, aggressive, yolo). Never touches Google Drive or other cloud mounts; automatic mode is off by default and cleans only the system drive. | Python 3.8+ | [README](skills/disk-cleanup/README.md) |
| **Infra Expert** | infra, coding | Guards every infrastructure operation (SSH on hosts, cloud CLIs, Terraform, Kubernetes, Compose, CI, secret stores, Grafana, model servers, network devices), reviews infrastructure code and AWS accounts, finds what makes databases, caches, and services slow and writes a proactive notice with the numbers and the fix, assesses CVEs, writes change plans with approvals, and draws infrastructure diagrams. Project specifics live in the project's committed `.gti/infra-expert/` folder. | Git, Python 3.8+; AWS CLI v2 for the aws area | [README](skills/infra-expert/README.md) |

### Packs

Skills are grouped into packs so you can install a whole area at once. A skill can belong to several packs. The packs are defined in [packages/cli/registry/packs.json](packages/cli/registry/packs.json).

| Pack | Purpose | Skills |
|------|---------|--------|
| `coding` | Writing, testing, reviewing, and auditing code | Better Tests, Disk Cleanup, Fast CI, Frontend Design Review, Gestures, GTI, Improve Codebase Architecture, Infra Expert, Leak Guard, LLM Fine Tuning, Maestro, Maestro Council, Maestro Plan, Maestro Review, Maestro Simple, Maestro Teach, Maestro Team, Security Audit, SEO Growth, Skill Distill, Unslop Interface, Untangle Codebase, Video to Skill, Web Performance Audit, Weight Space Programming |
| `infra` | Infrastructure as code, cloud accounts, and observability as code | Fast CI, Infra Expert, Leak Guard |
| `design` | Interface design, design reviews, and UX | Frontend Design Review, Gestures, Unslop Interface, UX Psychology Review |
| `research` | Finding, collecting, and summarizing information from the web, video, and social media | LLM Fine Tuning, SEO Growth, Video to Markdown, Weight Space Programming, X Research |
| `social` | Social media research, monitoring, and content | Video Editor, X Research |
| `art` | Graphic design, illustration, and visual artwork | Art Director, Video Editor |
| `personal` | Personal productivity, notes, and everyday tasks | Disk Cleanup, GTI, Maestro, Maestro Council, Maestro Plan, Maestro Review, Maestro Simple, Maestro Teach, Maestro Team |

```bash
node packages/cli install --harness all --pack coding,design --scope user
```

## Quick Start

Requires Node.js 20 or newer. Install a skill into Claude Code for the current project and use it immediately:

```bash
git clone https://github.com/gtihq/ai-skills.git
cd ai-skills
node packages/cli install --harness claude --skill video-to-markdown --dest /path/to/your/project
```

Start a new agent session in that project and ask in plain language:

```text
Convert https://youtube.com/watch?v=VIDEO_ID into study notes with timestamps.
```

The agent matches the request to the skill, installs any missing dependencies, and writes the Markdown file.

## Installation

The CLI in [packages/cli](packages/cli/README.md) copies a skill into the folder each agent reads. It needs only Node.js.

### Install from GitHub (agent prompts)

Ready-to-use installation prompts are available in [`prompts/installation/`](prompts/installation/):

| Prompt | File | What it installs |
|--------|------|------------------|
| **Everything** | [`prompts/installation/install-all.md`](prompts/installation/install-all.md) | All skills + all MCP servers from GitHub |
| **Skills only** | [`prompts/installation/install-skills-only.md`](prompts/installation/install-skills-only.md) | All skills from GitHub |
| **MCPs only** | [`prompts/installation/install-mcps-only.md`](prompts/installation/install-mcps-only.md) | All MCP servers from [gtihq/ai-mcps](https://github.com/gtihq/ai-mcps) |

Each prompt is self-contained: it clones from `https://github.com/gtihq/ai-skills.git`, installs everything, and cleans up. Just paste the prompt into your agent and it will handle the rest.

```bash
node packages/cli install --harness <ids|all> [--skill <ids|all>] [--pack <ids|all>] [--scope project|user] [--dest <dir>] [--dry-run]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--harness` | Required | Comma separated agent ids from [Supported Agents](#supported-agents), or `all` |
| `--skill` | `all` | Comma separated skill ids, or `all` |
| `--pack` | None | Comma separated pack ids from [Packs](#packs), or `all`. Combined with `--skill`, installs both selections |
| `--scope` | `project` | `project` installs into `--dest`; `user` installs into your home directory for every project |
| `--dest` | Current directory | Project root for the project scope |
| `--dry-run` | Off | Print what would be written |

Examples (the same commands work in macOS, Linux, and Windows PowerShell):

```bash
node packages/cli install --harness cursor,claude --skill video-to-skill,video-to-markdown --dest ../my-project
node packages/cli install --harness all --scope user
node packages/cli install --harness claude --pack research --scope user
node packages/cli install --harness opencode --skill artdirector --dry-run
```

Reinstalling replaces the skill folder. Restart the agent session afterwards so it picks up the new skill.

### Updating

There are no releases: the latest commit on `master` is the current version. `install` records every installed folder and the commit it came from in `~/.gti/skills/installs.json`. `update` asks GitHub for the latest commit hash on `master`, downloads that commit as a tarball into `~/.gti/skills/sources/`, builds the code packages the updated skills drive (such as Art Director's), and reinstalls every folder that is older, with the installer from that commit.

```bash
node packages/cli update --check
node packages/cli update
node packages/cli update --harness claude --skill better-tests --scope user
```

| Flag | Default | Description |
|------|---------|-------------|
| `--check`, `--dry-run` | Off | Print which installs are outdated; download nothing |
| `--force` | Off | Reinstall even when the commit already matches |
| `--skip-build` | Off | Do not run `npm ci` and `npm run build` for skills with a code package |
| `--harness`, `--skill`, `--pack`, `--scope`, `--dest` | Every recorded install | Install exactly this selection from the latest commit, like `install` |

Without `--harness`, `update` also picks up skill folders installed before installs were recorded: it scans each agent's user folder and the project folders under the current directory for gti-skills skill names. `list` and `install` check GitHub at most once a day and print a notice when recorded installs are older than `master`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `GTI_SKILLS_HOME` | `~/.gti/skills` | Install records, update state, and downloaded sources |
| `GTI_SKILLS_REPO` | `gtihq/ai-skills` | GitHub repository updates come from |
| `GTI_SKILLS_BRANCH` | `master` | Branch whose latest commit is the current version |
| `GITHUB_TOKEN` or `GH_TOKEN` | Unset | GitHub token for private forks or a higher API rate limit |
| `GTI_SKILLS_NO_UPDATE_CHECK` | Unset | Set to any value to turn off the daily notice; `CI` also turns it off |

After an update, installed skills that drive a code package point to the package inside `~/.gti/skills/sources/<commit>/`, not to your clone.

Other CLI commands:

| Command | Purpose |
|---------|---------|
| `node packages/cli list` | Show skills, packs, and agents |
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

> **Art Director, Video Editor, and Leak Guard need their engines.** They drive the packages in `packages/artdirector`, `packages/videoeditor`, and `packages/leakguard`. Build the first two once (see the [Art Director installation](skills/artdirector/README.md#installation) and the [Video Editor installation](skills/video-editor/README.md#installation)); Leak Guard needs only Node 18+ and no build. Use the `install` command, which records where each package lives.

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
| Video to Skill | No | 3.8+ | Yes | YouTube, X |
| Video to Markdown | No | 3.8+ | Yes | YouTube, X |
| Video Editor | 20+ | No | Yes (ffmpeg and ffprobe, no yt-dlp); Playwright and Chromium for motion graphics | No |
| UX Psychology Review | No | No | No | No |
| Unslop Interface | 22+ optional (lintapple) | No | No | npm, once, if lintapple runs through npx |
| Frontend Design Review | 22+ optional (lintapple) | No | No | npm, once, if lintapple runs through npx |
| Gestures | 18+ (tests only) | No | No | No |
| GTI | 18+ | 3.10+ (MCP servers) | No | GitHub; PyPI and browser downloads for MCP servers |
| Better Tests | 18+ for JS and TS projects | No | No | npm registry, to install Stryker and fast-check outside the project |
| Security Audit | 18+ | No | No | Optional: Cloudflare Radar Zero Wire page; target code runs only in a sandbox with no network |
| Web Performance Audit | LTS (MCP server) | No | No | Target site; npm; PageSpeed Insights API for field data |
| Fast CI | No | 3.8+ | No | The CI server API, `gh`, or `kubectl` for the audit |
| Leak Guard | 18+ | No | No | None; the guard and the history scanner are local and read only |
| SEO Growth | No | 3.8+ | No | Target site for the live check |
| X Research | No | 3.10+ (MCP server) | No | x.com; FxTwitter API; web search for the fallback |
| LLM Fine Tuning | No | 3.9+; recipe 3.11+ with tinker-cookbook | No | Inference endpoint for probes; recipe: Tinker, Hugging Face, optional W&B and Modal |
| Weight Space Programming | No | 3.9+ with numpy; PyTorch optional | No | No |
| Improve Codebase Architecture | No | 3.8+ | No | Mermaid from jsDelivr when viewing the report |
| Maestro | No | 3.8+ for CLI workers (agent runner) | No | Optional: remote MCP servers such as OpenAgents; worker commands use the host's own tools |
| Untangle Codebase | No | 3.8+ | No | No |
| Maestro Council | No | Same as Maestro | No | Same as Maestro |
| Maestro Plan | No | Same as Maestro | No | Same as Maestro |
| Maestro Review | No | Same as Maestro | No | Same as Maestro |
| Maestro Simple | No | Same as Maestro | No | Same as Maestro |
| Maestro Teach | No | Same as Maestro | No | Same as Maestro |
| Maestro Team | No | Same as Maestro | No | Same as Maestro |
| Skill Distill | No | 3.10+; Playwright and Pillow for web results | No | Only what the student harness does, such as calls to its model server |
| Disk Cleanup | No | 3.8+ | No | No; scans and cleans local drives only |
| Infra Expert | No | 3.8+ | No | AWS APIs through the AWS CLI in the aws area, read-only; Mermaid from jsDelivr when viewing the report |

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

## Autonomous Mode

When the user says to work on your own ("do it yourself", "no need to ask me"), take the recommended option at every decision, open nothing for the user, never take a gated irreversible action, and finish with one report.

In this skill:

- ...

## Output Location

Everything this skill generates goes to `~/.gti/my-skill/<project>/` (`GTI_HOME` replaces `~/.gti`), never into the user's repository.

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
| **Autonomous Mode** | `SKILL.md` has a `## Autonomous Mode` section: what the skill does when the user says to work alone, and each place it would otherwise stop, ask, or open something. Checked by `node packages/cli validate`. |
| **Output Location** | `SKILL.md` has a `## Output Location` section: everything the skill generates goes to `~/.gti/<skill-id>/` (`GTI_HOME` replaces `~/.gti`), never into the user's repository. Checked by `node packages/cli validate`. |
| **English source** | Skill files, references, and READMEs are written in English. |
| **Single purpose** | One skill, one job. Split broad skills instead of growing them. |
| **Pack** | `skill.json` lists at least one pack from `packages/cli/registry/packs.json` in `packs`. |
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
ai-skills/
├── AGENTS.md                  # Rules for every skill and package
├── README.md                  # This file
├── skills/                    # One folder per skill, the source of truth
│   ├── artdirector/
│   ├── better-tests/
│   ├── disk-cleanup/
│   ├── fast-ci/
│   ├── frontend-design-review/
│   ├── gestures/
│   ├── gti/
│   ├── improve-codebase-architecture/
│   ├── infra-expert/
│   ├── leak-guard/
│   ├── llm-fine-tuning/
│   ├── maestro/
│   ├── maestro-council/
│   ├── maestro-plan/
│   ├── maestro-review/
│   ├── maestro-simple/
│   ├── maestro-teach/
│   ├── maestro-team/
│   ├── security-audit/
│   ├── seo-growth/
│   ├── skill-distill/
│   ├── untangle-codebase/
│   ├── unslop-interface/
│   ├── ux-psychology-review/
│   ├── video-editor/
│   ├── video-to-markdown/
│   ├── video-to-skill/
│   ├── web-performance-audit/
│   ├── weight-space-programming/
│   └── x-research/
├── packages/                  # Code packages
│   ├── cli/                   # list, validate, build, check, install
│   ├── artdirector/           # Engine behind the Art Director skill
│   ├── videoeditor/           # Engine behind the Video Editor skill
│   ├── lintapple/             # UI linter shared by Frontend Design Review and Unslop Interface
│   ├── leakguard/             # Pre-tool guard engine, per-agent hooks, and leak history scanner
│   ├── maestro-central/       # Real-time dashboard for Maestro runs
│   └── python/
│       ├── shared/            # Scripts shared by the video skills
│       └── agent-runner/      # Starts and resumes external coding agents for Skill Distill and Maestro
└── .github/workflows/         # CI: validation and tests
```

Every skill folder is the single copy of that skill. Agents differ only in the install folder and a few usage details, which each skill documents in its own `harnesses/` folder.

## Contributing

Contributions are welcome, both new skills and improvements to existing ones.

1. Fork the repository and create a branch.
2. Add `skills/<kebab-case-name>/` with `skill.json` (including its `packs`), `SKILL.md`, and a `README.md` that follows the [skill README template](AGENTS.md#skill-readme-template).
3. Put detail in `references/`, helpers in `scripts/`, and static files in `assets/`.
4. Document every script, including flags and defaults, and put tests in the skill's `tests/` folder.
5. Run `node packages/cli build` and `npm test`, and commit the synced and generated files.
6. Add the skill to the [Skill Catalog](#skill-catalog), [Compatibility](#compatibility), and [Repository Layout](#repository-layout) sections.
7. Open a pull request describing the workflow the skill automates and how you tested it.

Pull request checklist:

- [ ] `SKILL.md` has `name` and `description` frontmatter, and `name` equals the folder name
- [ ] `SKILL.md` includes the language Core Rule
- [ ] `SKILL.md` includes the `## Autonomous Mode` section
- [ ] `SKILL.md` includes the `## Output Location` section, and the skill writes nothing generated into the user's repository
- [ ] All files are in English
- [ ] `node packages/cli check` and `npm test` pass
- [ ] README follows the [skill README template](AGENTS.md#skill-readme-template): same header, badges, and section order
- [ ] No `GUIDE.md` or synced shared script was edited by hand

To add a coding agent, add it to [packages/cli/registry/harnesses.json](packages/cli/registry/harnesses.json) and rebuild.

To report a bug or request a skill, [open an issue](https://github.com/gtihq/ai-skills/issues).

## Security

Skills run commands on your machine with the permissions of your agent. Read a skill's `SKILL.md` and scripts before installing it, and review install prompts (for example `sudo`, `winget`, or `pip install`) before approving them.

`node packages/cli update` downloads the latest `master` commit from GitHub and runs its installer and `npm ci` for code packages. Run `update --check` first if you want to review the commit before applying it.

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/gtihq/ai-skills/security/advisories/new) rather than public issues.

## Documentation

| Document | Contents |
|----------|----------|
| [AGENTS.md](AGENTS.md) | Rules every skill and package must follow, including the README Standard |
| [packages/cli/README.md](packages/cli/README.md) | The `list`, `validate`, `build`, `check`, and `install` commands |
| [packages/python/shared/README.md](packages/python/shared/README.md) | Scripts shared by the video skills |
| [packages/python/agent-runner/README.md](packages/python/agent-runner/README.md) | Starting, resuming, and recording external coding agents in any harness |
| [skills/infra-expert/tests/ai-assisted-sre/README.md](skills/infra-expert/tests/ai-assisted-sre/README.md) | Infra Expert scenario runner: sandbox and checks that test the skill with a real agent |
| [gtihq/ai-mcps](https://github.com/gtihq/ai-mcps) | The MCP servers (KaBuM!, Mercado Livre, Shopee, Twitter, Zoom), kept in their own repository |
| [packages/artdirector/README.md](packages/artdirector/README.md) | Art Director engine source and scripts |
| [packages/lintapple/README.md](packages/lintapple/README.md) | Vendored lintapple UI linter and the runner shared by the UI skills |
| [packages/leakguard/README.md](packages/leakguard/README.md) | Leakguard engine, per-agent hooks, CLI flags, and the history scanner |
| [packages/maestro-central/README.md](packages/maestro-central/README.md) | Maestro central: local real-time dashboard, its API, and the demo |
| [packages/artdirector/ARCHITECTURE.md](packages/artdirector/ARCHITECTURE.md) | Art Director design decisions and limitations |
| [packages/videoeditor/README.md](packages/videoeditor/README.md) | Video Editor engine source and scripts |
| [packages/videoeditor/ARCHITECTURE.md](packages/videoeditor/ARCHITECTURE.md) | Video Editor design decisions and limitations |
| [packages/videoeditor/NOTICE.md](packages/videoeditor/NOTICE.md) | Video Editor credits and third-party licenses |
| [skills/artdirector/README.md](skills/artdirector/README.md) | Art Director installation, CLI, and workflow |
| [skills/video-editor/README.md](skills/video-editor/README.md) | Editing video with a deterministic ffmpeg timeline |
| [skills/video-to-skill/README.md](skills/video-to-skill/README.md) | Generating skills from tutorial videos |
| [skills/video-to-markdown/README.md](skills/video-to-markdown/README.md) | Converting videos into Markdown notes |
| [skills/ux-psychology-review/README.md](skills/ux-psychology-review/README.md) | Reviewing conversion screens with UX psychology principles |
| [skills/unslop-interface/README.md](skills/unslop-interface/README.md) | Removing the generated look from interfaces in eight passes |
| [skills/frontend-design-review/README.md](skills/frontend-design-review/README.md) | Design reviews with severity and building distinctive interfaces |
| [skills/gestures/README.md](skills/gestures/README.md) | Gesture-driven UI in any web framework |
| [skills/gti/README.md](skills/gti/README.md) | Updating skills and MCP servers with `/gti` |
| [skills/better-tests/README.md](skills/better-tests/README.md) | Writing tests that catch bugs and pruning brittle suites |
| [skills/security-audit/README.md](skills/security-audit/README.md) | Defensive security reviews, full audits with a coverage ledger, and SARIF export |
| [skills/web-performance-audit/README.md](skills/web-performance-audit/README.md) | Auditing page load and Core Web Vitals with Chrome DevTools |
| [skills/fast-ci/README.md](skills/fast-ci/README.md) | Making CI fast on any platform without retries, skips, or weaker checks, with a drilled rollback |
| [skills/seo-growth/README.md](skills/seo-growth/README.md) | Technical SEO, Search Console mining, buyer pages, and AI search visibility |
| [skills/x-research/README.md](skills/x-research/README.md) | Researching X with the twitter MCP server and its web search fallback |
| [skills/llm-fine-tuning/README.md](skills/llm-fine-tuning/README.md) | Fine-tuning language models with checked data, cost approval, behaviour probes, and exact merges |
| [skills/weight-space-programming/README.md](skills/weight-space-programming/README.md) | Reading, fixing, and writing neural network weights without training |
| [skills/improve-codebase-architecture/README.md](skills/improve-codebase-architecture/README.md) | Finding refactors and reporting them in plain coding terms |
| [skills/maestro/README.md](skills/maestro/README.md) | Orchestrating tasks across cheap workers with review gates and reusable chats |
| [skills/maestro-council/README.md](skills/maestro-council/README.md) | A council of agents that debate a question and vote, chaired by Maestro |
| [skills/maestro-plan/README.md](skills/maestro-plan/README.md) | Planning a Maestro run without starting workers |
| [skills/maestro-review/README.md](skills/maestro-review/README.md) | Reviewing a pull request with an independent panel and a consensus |
| [skills/maestro-simple/README.md](skills/maestro-simple/README.md) | Delegating one task to one cheap worker through Maestro |
| [skills/maestro-teach/README.md](skills/maestro-teach/README.md) | Teaching a lesson to student models until they master it |
| [skills/maestro-team/README.md](skills/maestro-team/README.md) | Long, hard Maestro runs with workers that share findings |
| [skills/untangle-codebase/README.md](skills/untangle-codebase/README.md) | Untangling a whole codebase in one verified refactor |
| [skills/skill-distill/README.md](skills/skill-distill/README.md) | Distilling a good session into a tested skill for an open-weight model |
| [skills/infra-expert/README.md](skills/infra-expert/README.md) | Reviewing and untangling infrastructure code and AWS accounts |
| [skills/disk-cleanup/README.md](skills/disk-cleanup/README.md) | Freeing disk space by level on Windows, Linux, and macOS without touching Google Drive |
| [skills/leak-guard/README.md](skills/leak-guard/README.md) | Installing the pre-tool guard, scanning local history, and rotating exposed credentials |

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
| Unslop Interface | Not declared; the shared [packages/lintapple](packages/lintapple/LICENSE) is MIT |
| Frontend Design Review | Not declared; the shared [packages/lintapple](packages/lintapple/LICENSE) is MIT |
| Gestures | MIT, see [LICENSE](skills/gestures/LICENSE); adapted from Emil Kowalski's gestures skill |
| GTI | Not declared |
| Better Tests | Not declared |
| Security Audit | MIT, see [LICENSE](skills/security-audit/LICENSE); adapted from Cloudflare's security-audit-skill |
| Web Performance Audit | Not declared |
| Fast CI | Not declared; based on a prompt posted on X by Pontus Abrahamsson |
| SEO Growth | Not declared |
| LLM Fine Tuning | MIT, see [LICENSE](skills/llm-fine-tuning/LICENSE); Inkling 2 Small recipe adapted from drost-ai/finetune-inkling-2-small |
| Weight Space Programming | Not declared |
| Improve Codebase Architecture | MIT, see [LICENSE](skills/improve-codebase-architecture/LICENSE); adapted from Matt Pocock's skills |
| Maestro | Not declared; the interface was inspired by the MIT-licensed Maestro Skills project; the bundled [agent runner](packages/python/agent-runner/LICENSE) is MIT |
| Maestro Council | Not declared |
| Maestro Plan | Not declared |
| Maestro Review | Not declared |
| Maestro Simple | Not declared |
| Maestro Teach | Not declared |
| Maestro Team | Not declared |
| Untangle Codebase | MIT, see [LICENSE](skills/untangle-codebase/LICENSE); adapted from Caldo's untangle-codebase skill |
| Skill Distill | MIT, see [LICENSE](skills/skill-distill/LICENSE); adapted from Sybil Solutions' skill-distill |
| Infra Expert | MIT, see [LICENSE](skills/infra-expert/LICENSE); the report renderer and hot spot scan are adapted from Improve Codebase Architecture |
| X Research | Not declared; the `twitter` MCP server in [gtihq/ai-mcps](https://github.com/gtihq/ai-mcps/tree/master/twitter-mcp) is MIT |
| Video Editor | Not declared |
| Disk Cleanup | Not declared |
| Leak Guard | Not declared |

Until a root license is added, contact the maintainers before redistributing skills without a declared license.
