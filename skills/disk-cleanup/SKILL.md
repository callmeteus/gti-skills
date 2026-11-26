---
name: disk-cleanup
description: >-
  Frees disk space on Windows, Linux, and macOS. Scans the chosen drives in parallel for temporary files, caches,
  old logs and crash dumps, the trash, duplicate files, old installers in Downloads, build output in stale
  projects, stale git worktrees, packages installed many times (old Playwright, Puppeteer, and Cypress browsers, Node versions),
  Docker and package manager leftovers, system leftovers (Windows.old, old kernels, snap revisions,
  Time Machine snapshots), settings that waste space (unlimited journald, hibernation, restore points, WSL disks
  that never shrink), and programs not used in months. Three levels: safe, aggressive, and yolo ("nao ligo").
  Asks which drives to clean, never touches Google Drive or other cloud mounts, and deletes nothing until the user
  chooses, unless automatic mode is on (off by default; system drive only). Use when the disk is full, or the user asks
  to free space, clean the PC, find duplicates, or what uses the disk. Do not use for backups,
  file recovery, or disk partitioning.
metadata:
  display-name: Disk Cleanup
---

# Disk Cleanup

## Core Rule

Always respond in the user's language, regardless of the language used in this skill, its references, or the tool output.

## Autonomous Mode

When the user says to work on your own, for example "do it yourself", "faz você mesmo", "you don't need to ask me", "não precisa me chamar", or "just do it", or when the request runs unattended:

- **Do not stop for input.** Skip questions, confirmations, and pauses that wait for the user. At each decision, take the option this skill recommends, or the safest default, and note the decision and the reason.
- **Do not open anything for the user.** No browser tabs, viewers, editors, or servers started for the user to look at. Still write every file the skill produces and give the paths at the end.
- **Never take a gated irreversible or outward action** unless the request already allows it: deleting the user's data, tests, or files; publishing, posting, pushing, or sending; paying; typing credentials. List each one as pending instead.
- **Finish with one report:** the decisions you took and why, what you did, what is pending, and what you could not verify.

In this skill:

- **Which drives (step 2):** only the system drive (where the operating system is installed). Never another drive, never Google Drive.
- **Which level (step 3):** the saved `level` preference, else `safe`.
- **What to delete (step 5):** nothing, unless automatic mode is on (see below). Without automatic mode, the scan and the report are the result, and every deletion is listed as pending with its id and the exact `clean` command.
- **With automatic mode on:** run `clean --auto --run-commands --apply` at the chosen level. It deletes only findings marked `auto` within that level, on the system drive.
- **Programs the user named in the request:** uninstall them with `uninstall "<name>" --apply`; a name that matches no program or several is reported, not guessed.
- **Settings, uninstalls the user did not name, Docker volumes, phone backups, and duplicates in backup folders (step 5):** never in this mode. List them as pending with their commands.
- **Items that need administrator or root rights:** never pass `--elevate` in this mode (it opens a password dialog that waits for the user). List them as pending with the command, or with the `--elevate` command to run later.
- **Reports:** write them; do not open them.

## Automatic Mode

Automatic mode deletes files without asking. It is **off by default**. It is on only when the user turns it on in this request ("modo automático", "apaga sozinho", "clean automatically", "limpa sem perguntar") or saved it with `prefs set auto true`. Announce at the start of every run whether it is on, the level, and the drive.

In automatic mode:

- **Only the system drive** is scanned and cleaned, whatever drives the user named.
- **Only findings marked `auto`** at or below the level: temp files, caches, logs, trash, old downloads, duplicates outside backup folders, build output, and tool-owned cleanup commands. Never settings, uninstalls, Docker volumes, phone backups, or manual steps.
- **Default level is `safe`.** Use `aggressive` or `yolo` only when the user named it in this request or saved it.
- **Every deletion is logged** in the manifest, and the report lists what was freed and what was left pending.

## Output Location

Everything this skill generates (scans, reports, cleanup manifests, and preferences) goes to `~/.gti/disk-cleanup/`, where `GTI_HOME` replaces `~/.gti`. Scans are per machine, so the folder is `~/.gti/disk-cleanup/<machine>/`, where `<machine>` is the host name. Nothing is written into the user's repositories or the folders being scanned.

| Folder | Contents |
|--------|----------|
| `~/.gti/disk-cleanup/preferences.json` | Saved level, automatic mode, user exclusions, and age thresholds |
| `~/.gti/disk-cleanup/<machine>/scans/<stamp>/` | `scan.json` (every finding with its id) and `report.md` |
| `~/.gti/disk-cleanup/<machine>/latest-scan.txt` | Path of the newest scan, used by `clean` by default |
| `~/.gti/disk-cleanup/<machine>/cleanups/<stamp>/` | `manifest.jsonl` (every path deleted or skipped), `result.json`, and `report.md` |

## When to use

- The disk is full or almost full, or the user asks to free space or clean the computer.
- The user asks what is using the disk, where the space went, or for the largest files and folders.
- The user wants duplicate files, old downloads, unused programs, or old build folders found or removed.
- A system setting is suspected of eating space: a journal or log that never stops growing, hibernation, restore points, Docker or WSL disks.

Do not use this skill for backups, recovering deleted files, resizing or partitioning disks, or cleaning cloud storage.

## Levels

| Level | Also called | Deletes |
|-------|-------------|---------|
| `safe` | seguro | Things that regenerate on their own: temp files older than 2 days, browser and app caches, package manager download caches, thumbnails, crash dumps, rotated logs, dangling Docker images, APT, DNF, Pacman, and Delivery Optimization caches, Playwright browser revisions no install uses |
| `aggressive` | agressivo | Safe, plus: the trash, duplicates, old installers and extracted archives in Downloads, build output in projects untouched for 90 days, git worktrees untouched for 30 days with nothing uncommitted (the branch stays), old Puppeteer and Cypress browser builds, developer tool caches, Docker build cache, journald above 200 MB, old kernels, disabled snap revisions, Windows Update downloads and upgrade leftovers, Time Machine local snapshots |
| `yolo` | não ligo | Aggressive, plus: build output in active projects, old Node.js versions (never automatic), every unused Docker image and stopped container, every app cache in `~/Library/Caches` on macOS, Maven and model caches, installers older than 7 days and archives older than 30, Xcode archives, the Windows Installer patch cache |

A level includes everything below it. Levels choose what the skill offers in bulk; they never block what the user names. An item the user picks by id, or a program the user names, is done whatever its level. Full matrix, with the settings and programs each level lists: [references/rules/levels.md](references/rules/levels.md).

Never deleted at any level: anything in Google Drive, OneDrive, Dropbox, iCloud, or other cloud-synced folders; keys, credentials, and wallets; documents, photos, and videos (only duplicate copies, with the original kept); the only copy of anything; anything behind a link or junction. Read [references/rules/guardrails.md](references/rules/guardrails.md) before the first cleanup.

## Instructions

Run the script with `python3` on macOS and Linux and `python` or `py -3` on Windows. It uses only the standard library.

1. **Preferences.** Show the saved preferences and say whether automatic mode is on:

   ```bash
   python3 <skill-dir>/scripts/disk_cleanup.py prefs show
   ```

   Read [references/workflow/01-setup-and-drives.md](references/workflow/01-setup-and-drives.md).

2. **Drives.** List the drives. Google Drive (on any letter), other cloud mounts, network shares, and optical drives are marked `EXCLUDED` and are never scanned or cleaned:

   ```bash
   python3 <skill-dir>/scripts/disk_cleanup.py drives
   ```

   Ask the user which drives to clean, with the system drive selected by default, and show the free space of each. In automatic mode, skip the question: only the system drive. Then read the platform guide:

   | System | Guide |
   |--------|-------|
   | Windows | [references/platforms/windows.md](references/platforms/windows.md) |
   | Linux | [references/platforms/linux.md](references/platforms/linux.md) |
   | macOS | [references/platforms/macos.md](references/platforms/macos.md) |

3. **Level.** Ask for the level (safe, aggressive, or yolo, default the saved one, else safe), unless the user already named it.

4. **Scan.** One command scans every category in parallel: targets, cleanup commands, system leftovers, settings, programs, and one walk of the user's data split across one process per CPU (duplicates, build output, packages installed many times, Downloads, large files). Folder sizes use the native `du` when it is there.

   ```bash
   python3 <skill-dir>/scripts/disk_cleanup.py scan --drives C: D: --level aggressive
   python3 <skill-dir>/scripts/disk_cleanup.py scan --auto
   ```

   Read [references/workflow/02-scan.md](references/workflow/02-scan.md). For the `packages` category (duplicate browser builds, global packages per Node version, heavy packages copied into every project), read [references/rules/packages.md](references/rules/packages.md).

5. **Review and choose.** Read `report.md`. Show the user the reclaimable space per level and per category, then ask what to delete: by category, by id, or everything marked auto at the level. Ask separately, item by item, for settings, uninstalls, Docker volumes, phone backups, and duplicates in backup folders. Read [references/workflow/03-review.md](references/workflow/03-review.md).

6. **Clean.** Dry run first, then the same command with `--apply`:

   ```bash
   python3 <skill-dir>/scripts/disk_cleanup.py clean --ids 0ce67e0a8d 64e3cfc743 --level aggressive
   python3 <skill-dir>/scripts/disk_cleanup.py clean --ids 0ce67e0a8d 64e3cfc743 --level aggressive --apply
   python3 <skill-dir>/scripts/disk_cleanup.py clean --auto --level safe --run-commands --apply
   ```

   Every path is checked again right before it is deleted, duplicates are hashed again, and each deletion is logged. Read [references/workflow/04-clean.md](references/workflow/04-clean.md).

   **Items that need administrator or root rights** (journald, APT, snap, Windows Update, system logs): tell the user how many and how much, say that the operating system will show its own password dialog, and with their yes add `--elevate`. The script runs those items in one elevated copy of itself through polkit (`pkexec`) on Linux, the administrator prompt on macOS, or UAC on Windows. The user types the password into that dialog; the agent never asks for it, sees it, or types it, and never clicks the dialog for the user. If the dialog is cancelled or unavailable (no graphical session), the items stay pending with their commands.

   ```bash
   python3 <skill-dir>/scripts/disk_cleanup.py clean --categories logs system --level aggressive --run-commands --elevate --apply
   ```

   **When the user names programs to remove,** do not look for them among the scan's unused programs: the scan lists only programs with a known old last use. Uninstall by name, from every installed program, whatever the level:

   ```bash
   python3 <skill-dir>/scripts/disk_cleanup.py programs --search insomnia
   python3 <skill-dir>/scripts/disk_cleanup.py uninstall "Immersed Agent" "Gunfire Reborn" SideQuest Insomnia
   python3 <skill-dir>/scripts/disk_cleanup.py uninstall "Immersed Agent" "Gunfire Reborn" SideQuest Insomnia --apply
   ```

   On Windows the uninstaller may show its own window or the Windows permission dialog (UAC): tell the user to answer it there; never approve it for them. The command checks afterwards which programs are really gone.

7. **Report.** Give free space before and after per drive, what was freed per category, what is pending (admin, settings, uninstalls, manual steps) with exact commands, and what was not verified. Use [assets/templates/cleanup-report.md](assets/templates/cleanup-report.md). Read [references/workflow/05-report.md](references/workflow/05-report.md).

Before reporting, go through [references/quality/checklist.md](references/quality/checklist.md).

## Examples

```text
User: Meu C: está cheio, limpa pra mim.
Agent: Lists drives: C: (system, 9 GB free), D: data, G: "Google Drive" marked excluded. Asks which drives
(C: selected) and the level; the user picks C: and agressivo. Scans in 40 s and shows: 50 GB at safe (npm and
pip caches, temp, browser caches), 72 GB at aggressive (trash, old build folders, Windows Update downloads),
plus settings: hiberfil.sys 13 GB and Storage Sense off. The user approves the categories and hibernation reduced.
Dry run, then --apply: 61 GB freed; hibernation set with powercfg in an elevated prompt the user opened.
```

```text
User: Modo automático, não precisa me chamar.
Agent: Automatic mode on, level safe (no saved level), system drive only. Scans /, cleans every auto finding at
safe, and reports 38 GB freed, with apt-get clean and journal vacuum pending because they need root, and the
yolo items listed with their ids for later.
```

```text
User: Find duplicate photos on D: and E:, nothing else.
Agent: scan --drives D: E: --categories duplicates --level aggressive. Shows 112 sets (18 GB), the kept copy of
each, and 3 sets inside "Backup 2023" that stay unless the user picks yolo. Deletes the approved sets after
hashing both copies again.
```

## Resources

| Path | Purpose |
|------|---------|
| `scripts/disk_cleanup.py` | The command line: `drives`, `scan`, `clean`, `programs`, `uninstall`, `prefs` |
| `scripts/cleanup/` | Levels and findings, the parallel scanners, the cleaner and its guard, reports, file system helpers |
| `scripts/platforms/` | One module per operating system: drives, cloud folders, targets, commands, settings, programs |
| `references/workflow/` | One file per step: setup and drives, scan, review, clean, report |
| `references/rules/levels.md` | What each level includes, category by category |
| `references/rules/guardrails.md` | What is never deleted, and every check before a deletion |
| `references/rules/packages.md` | Packages installed many times: what is found, what stays, and how to keep one copy |
| `references/platforms/` | Windows, Linux, and macOS: what is checked, admin commands, and manual steps |
| `references/quality/checklist.md` | Checks before the report |
| `assets/templates/cleanup-report.md` | The final report structure |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.

## Notes

- Sizes come from the scan, never from a guess. A `~` marks an estimate; `unknown` means the tool reports the size only after it runs.
- Administrator rights come only from the operating system's own dialog (`--elevate`) after the user agrees, or from a terminal the user elevated. The agent never asks for, sees, or types a password.
- Never size folders with PowerShell `Get-ChildItem -Recurse` or `Measure-Object`, or with Explorer: they are many times slower than the script.
