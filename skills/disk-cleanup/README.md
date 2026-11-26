<div align="center">

# Disk Cleanup

> Free disk space safely on Windows, Linux, and macOS

**Scans the drives you choose in parallel for temp files, caches, logs, trash, duplicates, old downloads, build output, system leftovers, wasteful settings, and unused programs, then deletes what you pick at one of three levels, never touching Google Drive.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Python](https://img.shields.io/badge/python-3.8%2B-blue.svg)](#requirements)
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
- [Architecture](#architecture)
- [Security](#security)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [License](#license)

## Overview

A full disk is rarely one big file. It is package manager caches, browser caches, temp folders nobody empties, build folders of projects untouched for a year, Docker images, old kernels and snap revisions, a journal with no size limit, a hibernation file the size of RAM, and the same videos in three folders. Cleanup tools either delete too little or delete blindly, and almost none know that deleting inside a Google Drive mount deletes in the cloud.

Disk Cleanup gives the agent one script that lists the drives, excludes Google Drive (on any letter) and every other cloud or network mount, scans the chosen drives with every category running in parallel and the data walk split across one process per CPU, and writes a report with an id, a level, a size, a reason, and a risk for each finding. The user picks what goes, by category or id, at one of three levels: safe, aggressive, or yolo ("nao ligo"). The cleaner checks every path again right before deleting it and logs every deletion. Automatic mode, off by default, deletes everything marked auto at the level on the system drive only.

```text
  drives ──> Google Drive, cloud, network: EXCLUDED
     │
     v
  user picks drives (system drive by default; automatic mode: system drive only) and a level
     │
     v
  scan, all at once:
     ├── temp, caches, logs, trash      known folders, sized with du or a thread pool
     ├── cleanup commands               apt, dnf, pacman, snap, flatpak, docker, Dism, tmutil
     ├── settings                       journald, hibernation, restore points, WSL disks, indexes
     ├── programs                       installed apps and their last use
     └── data walk (one process/CPU)    duplicates, build output, Downloads, large files
     │
     v
  report.md + scan.json (ids, levels, sizes, risks)
     │
     v
  user chooses (or automatic mode) ──> clean: dry run, then --apply
     │                                   every path checked again, duplicates hashed again
     v
  manifest.jsonl + report with free space before and after, and a pending list
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Scan every category in parallel and measure real allocated sizes | Touch Google Drive, OneDrive, Dropbox, iCloud, or network shares |
| Ask which drives to clean, with the system drive selected | Clean drives the user did not choose, or more than the system drive in automatic mode |
| Delete caches, temp files, logs, trash, duplicates, old downloads, and build output by level | Delete documents, photos, or videos, except verified duplicate copies |
| Run the owning tool's cleanup (apt-get clean, docker prune, Dism, tmutil) | Delete inside WinSxS, Docker, snap, or snapshot folders by hand |
| Find settings that waste space and give the command and the undo | Change a setting or uninstall a program without the user's yes for that item |
| List programs unused for months with their uninstall command | Elevate, ask for a password, or accept an EULA |

## Features

- **Three levels:** safe (regenerates on its own), aggressive (trash, duplicates, stale build output, rollback points), and yolo (active build output, every unused Docker image, model caches), each including the one below.
- **Google Drive on any letter:** excluded by volume label, by its folder layout (My Drive, Meu Drive, Shared drives), by the Google Drive for desktop registry, or by rclone, ocamlfuse, and gvfs mount types.
- **Parallel scan:** six scanners at once, a thread pool for folder sizes, and the data walk split breadth first across one process per CPU; about 35 seconds for 4.7 million files on a laptop.
- **Native du:** `du -skx` on Linux and macOS, and Sysinternals `du64` on Windows when it is installed and its EULA was already accepted.
- **Safe duplicates:** size, then the first and last 64 KiB, then the whole file with BLAKE2b; only user content, never inside repositories, program folders, or SDKs; the original kept by location and name; copies in backup folders kept unless the level is yolo.
- **Honest sizes:** allocated bytes, hardlinks counted once, build folders sized from single-link files so pnpm and Bun stores are not overcounted, estimates marked as estimates.
- **Settings that waste space:** journald and Docker logs with no limit, core dumps, hibernation and page files, restore points, search indexes, WSL and Docker disks that never shrink, snap retention, Storage Sense.
- **Stale git worktrees:** worktrees left by coding agents and people (opencode, Claude Code, Cursor, Maestro) with no change for 30 days are removed with `git worktree remove`, never `--force`, only when git says nothing is uncommitted and the commit is on a branch, which stays; worktrees with uncommitted work, detached commits, a lock, or a missing repository are only reported.
- **Packages installed many times:** Playwright browser revisions no install uses (the rule Playwright applies itself), old Puppeteer and Cypress builds, global npm packages repeated in every Node version, old Node versions (kept: current, default, newest, and versions pinned in `.nvmrc`), and heavy packages such as electron, esbuild, or torch copied into many projects, with how to keep one copy.
- **Uninstall by name:** `uninstall "Gunfire Reborn" SideQuest` finds each program among everything installed, whatever its level or last use, runs the uninstallers one at a time (Windows shows its own permission dialog), and checks that each one is gone.
- **Unused programs:** listed only with a real last-use date older than 180 days: Prefetch and UserAssist on Windows, Spotlight on macOS, Flatpak, snap, AppImage, and packages with a launcher on Linux. A program with no reliable date is never called unused; runtimes, updates, drivers, and sync clients are never listed.
- **Guarded cleaner:** every path checked again for links, protected folders, keys and credentials, cloud folders, excluded drives, and user exclusions; duplicates hashed again; every deletion in a manifest.
- **Automatic mode:** off by default; system drive only; only findings marked auto at the level; settings, uninstalls, volumes, and phone backups always stay pending.
- **Preferences:** saved level, automatic mode, exclusions, and age thresholds in `~/.gti/disk-cleanup/preferences.json`, each change shown with its old and new value.

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| Python | 3.8+ | Runs `disk_cleanup.py` (standard library only) | No |
| `du` | Any | Faster folder sizes on Linux and macOS (optional) | No |
| Sysinternals Du | Any | Faster folder sizes on Windows (optional; EULA accepted by the user) | No |
| Docker, snap, flatpak, apt, dnf, pacman, brew, tmutil | Any | Their cleanups are offered only when they are installed | No |

| Platform | Python command | Notes |
|----------|----------------|-------|
| Windows 10 and 11 | `python` or `py -3` | Admin items need an elevated prompt |
| Linux | `python3` | Admin items need root |
| macOS 12+ | `python3` | Some folders need Full Disk Access for the terminal |

## Installation

From the repository root, install the skill into any supported agent:

```bash
node packages/cli install --harness claude --skill disk-cleanup
```

The same command works in PowerShell. Use a comma separated list or `all` for several agents, `--scope user` to install for every project, and `--dry-run` to preview.

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

The skill is one self-contained folder, identical for every agent. To copy it by hand, put `skills/disk-cleanup` in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p ~/.claude/skills && cp -r skills/disk-cleanup ~/.claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force $HOME\.claude\skills | Out-Null
Copy-Item -Recurse skills\disk-cleanup $HOME\.claude\skills\
```

Each agent has a short guide in `skills/disk-cleanup/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded. A user install is the natural choice: disk cleanup is about the machine, not one project.

## Quick Start

```text
My disk is almost full. Free some space.
```

The agent lists the drives (Google Drive marked excluded), asks which ones to clean and at which level, scans them in parallel, shows what each level would free, deletes what you approve after a dry run, and reports the free space before and after with a list of what is pending.

## Usage

### Input

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| Drives | No | System drive | Asked unless named; automatic mode uses only the system drive |
| Level | No | Saved level, else `safe` | `safe`, `aggressive`, or `yolo` (seguro, agressivo, nao ligo) |
| Categories | No | All | `temp caches logs trash duplicates downloads dev packages system config programs large` |
| Automatic mode | No | Off | Deletes everything marked auto at the level without asking |

### Examples

```text
Limpa meu C: no modo agressivo.
```

```text
Find duplicate photos and videos on D: and E:, nothing else.
```

```text
What is using my disk? Don't delete anything.
```

```text
Modo automático, nível seguro, não precisa me chamar.
```

```text
Why does my disk keep filling up? Check the system settings.
```

```text
Find packages I have installed many times, like Playwright and Puppeteer browsers.
```

```text
Remove git worktrees nobody touched in a month.
```

## How It Works

```text
1. prefs show            level, automatic mode, exclusions
2. drives                list; exclude Google Drive, cloud, network, optical; ask which (or system only)
3. level                 safe, aggressive, or yolo
4. scan                  every category in parallel -> scan.json + report.md
5. review                sizes per level and category; the user picks categories and ids
                         settings, uninstalls, volumes, backups: item by item
6. clean                 dry run -> --apply; guard every path; hash duplicates again; manifest
7. report                free space before and after, pending with commands, not verified
```

## Reference

### disk_cleanup.py drives

```bash
python3 scripts/disk_cleanup.py drives [--json]
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--json` | off | Print the drives as JSON, with `excluded` and `exclude_reason` |

### disk_cleanup.py scan

```bash
python3 scripts/disk_cleanup.py scan [--drives C: D:] [--auto] [--level L] [--categories ...] [--jobs N] [--out DIR]
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--drives` | system drive | Drive ids, roots, or labels; excluded drives are refused |
| `--auto` | off | Automatic mode: system drive only |
| `--level` | saved, else `safe` | Recorded in the scan |
| `--categories` | all | Limit the scan to these categories |
| `--jobs` | 2 per CPU, at most 16 | Parallel workers |
| `--out` | `~/.gti/disk-cleanup/<machine>/scans/<stamp>/` | Output folder |

### disk_cleanup.py clean

```bash
python3 scripts/disk_cleanup.py clean [--scan PATH] [--level L] [--ids ...] [--categories ...] [--auto] [--run-commands] [--allow-system-changes] [--apply]
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--scan` | `latest` | Scan to clean from; refused when older than 24 hours |
| `--level` | saved, else `safe` | Highest level acted on |
| `--ids` | none | Findings the user approved; an id runs whatever its level |
| `--categories` | none | Every finding of these categories within the level |
| `--exclude-ids` | none | Findings to keep |
| `--exclude-paths` | none | Paths to keep in this run |
| `--auto` | off | Every finding marked auto within the level; needs a scan made with `--auto` |
| `--run-commands` | off | Also run cleanup commands |
| `--allow-system-changes` | off | Run settings and uninstalls named in `--ids`; refused with `--auto` |
| `--allow-old-scan` | off | Accept a scan older than 24 hours |
| `--jobs` | 4 | Parallel deletions |
| `--apply` | off | Delete; without it, a dry run |

### disk_cleanup.py programs

```bash
python3 scripts/disk_cleanup.py programs [--search TEXT] [--json]
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--search` | none | Only programs whose name contains this text |
| `--json` | off | Print the programs as JSON |

### disk_cleanup.py uninstall

```bash
python3 scripts/disk_cleanup.py uninstall NAME [NAME ...] [--apply]
```

| Argument | Default | Description |
|----------|---------|-------------|
| `NAME` | required | Program names as the user said them; each must match exactly one installed program |
| `--apply` | off | Run the uninstallers; without it, a dry run. Afterwards, checks which programs are really gone |

### disk_cleanup.py prefs

```bash
python3 scripts/disk_cleanup.py prefs show
python3 scripts/disk_cleanup.py prefs set <key> <value>
python3 scripts/disk_cleanup.py prefs unset <key>
python3 scripts/disk_cleanup.py prefs reset
```

| Key | Default | Description |
|-----|---------|-------------|
| `level` | `safe` | Default level |
| `auto` | `false` | Automatic mode |
| `exclude` | `[]` | Paths never deleted (comma separated, added to the list) |
| `temp_age_days` | `2` | Temp entries changed or read more recently stay |
| `download_age_days` | `30` | Age of installers and archives in Downloads |
| `stale_project_days` | `90` | Build output of older projects is aggressive, newer is yolo |
| `stale_worktree_days` | `30` | Git worktrees with no change this long are removal candidates |
| `unused_program_days` | `180` | Programs unused this long are listed |
| `min_duplicate_mb` | `1` | Smallest file checked for duplicates |
| `large_file_mb` | `500` | Smallest file in the largest files list |
| `min_finding_mb` | `1` | Smallest target reported |

## Output

```text
~/.gti/disk-cleanup/
├── preferences.json
└── <machine>/
    ├── latest-scan.txt
    ├── scans/<stamp>/
    │   ├── scan.json
    │   └── report.md
    └── cleanups/<stamp>/
        ├── manifest.jsonl
        ├── result.json
        └── report.md
```

| Section | Contents |
|---------|----------|
| Drives | Every drive with type, file system, free and total space, whether it was scanned, and why it was excluded |
| Reclaimable space by level | Category by level totals |
| One section per category | Id, level, size, item, action, auto, why, and risk |
| Where the space is | Files walked and the 30 biggest first-level folders |
| Not verified | Missing tools, unreadable folders, elevation notes |
| Cleanup report | Free space before and after per drive, what each item freed, skipped paths, and pending items with commands |

`GTI_HOME` replaces `~/.gti`.

## Architecture

| Path | Responsibility |
|------|----------------|
| `scripts/disk_cleanup.py` | Command line: drives, scan, clean, prefs |
| `scripts/cleanup/model.py` | Levels, findings, preferences, size parsing |
| `scripts/cleanup/drives.py` | Drive model, Google Drive and cloud detection, drive selection |
| `scripts/cleanup/scanners.py` | Parallel scanners, the multi-process data walk, duplicates, build output, Downloads |
| `scripts/cleanup/worktrees.py` | Stale git worktrees: activity from git's index and reflog, and the checks before `git worktree remove` |
| `scripts/cleanup/packages.py` | Browser builds per version (Playwright, Puppeteer, Cypress), Node versions, packages copied into many projects |
| `scripts/cleanup/clean.py` | Choosing findings, the guard, deletion, commands, manifest |
| `scripts/cleanup/fsutil.py` | Link-safe walking, native du, hashing, deletion helpers |
| `scripts/cleanup/report.py` | Scan and cleanup reports |
| `scripts/platforms/` | `windows.py`, `linux.py`, `macos.py`: drives, cloud folders, targets, commands, settings, programs |

## Security

- **Network:** none. The script reads the local file system and runs local tools; it sends nothing anywhere.
- **Privileges:** the script never elevates, never runs `sudo`, and never asks for a password; admin items are listed with their commands.
- **File access:** links and junctions are never followed or deleted; keys, credentials, wallets, and cloud-synced folders are never touched; every deletion is logged.
- **Third-party terms:** the Sysinternals EULA is never accepted on the user's behalf.

## Development

| Command | Action |
|---------|--------|
| `python3 -m unittest discover -s skills/disk-cleanup/tests` | Run the skill tests (drive detection, levels, scan, guard, cleaner, preferences) |
| `npm run test:python` | Run every Python test in the repository |
| `node packages/cli validate --skill disk-cleanup` | Validate the skill |

## Troubleshooting

<details>
<summary><strong>My Google Drive letter was scanned</strong></summary>

None of the signals matched: the label was renamed, the root is not readable yet, and the registry holds no mount point. Run `drives` and check the label. Exclude the letter for good:

```bash
python3 scripts/disk_cleanup.py prefs set exclude "H:\\"
```

</details>

<details>
<summary><strong>Many items say "needs administrator or root rights"</strong></summary>

The agent is not elevated, and the skill never elevates on its own. Run the commands from the report in an elevated prompt or under your own `sudo`, or start the agent from an elevated terminal and scan again.

</details>

<details>
<summary><strong>Free space grew less than the freed total</strong></summary>

Files in use are freed only when the program closes them, hardlinked files stay while another link exists, and APFS snapshots or Time Machine local snapshots hold deleted blocks. Close the programs, or thin the snapshots (aggressive level), and check again.

</details>

<details>
<summary><strong>"The scan is N hours old"</strong></summary>

Files change, so the cleaner refuses scans older than 24 hours. Scan again, or pass `--allow-old-scan` if nothing changed.

</details>

<details>
<summary><strong>Few or no programs are listed as unused</strong></summary>

A program is listed only when its last use is known. On Windows, Prefetch needs an elevated prompt; without it only programs opened from Start or Explorer (UserAssist) have a date, and audio plugins never have one. The report's notes count the programs left out. Scan from an elevated terminal for more dates.

</details>

<details>
<summary><strong>The Trash or Mail folders are unreadable on macOS</strong></summary>

The terminal app lacks Full Disk Access. Grant it in System Settings > Privacy & Security > Full Disk Access and scan again.

</details>

## Limitations

- Windows Store apps are not listed as programs; check Settings > Apps.
- Last-use dates are approximate on Linux (access time, wrong on `noatime` mounts) and unknown on Windows without elevation.
- APFS clones and btrfs reflinks share blocks; deleting one copy can free less than its size.
- Sizes of Docker images include layers shared between images; Flatpak and Nix report what they free only after running.
- Windows.old, WSL disk compaction, and the page file are manual steps through Windows Settings.
- Hardlinks across separate walk processes may be counted twice in the folder totals (never in build folder sizes).

## License

No license has been declared for this skill yet. See the [root license section](../../README.md#license).
