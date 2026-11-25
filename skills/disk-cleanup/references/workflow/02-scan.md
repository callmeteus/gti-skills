# Step 4: Scan

Goal: every finding measured, with an id, a level, a size, a reason, and a risk, before anything is deleted.

## Run

```bash
python3 <skill-dir>/scripts/disk_cleanup.py scan --drives C: D: --level aggressive
python3 <skill-dir>/scripts/disk_cleanup.py scan --drives / /mnt/data
python3 <skill-dir>/scripts/disk_cleanup.py scan --auto
python3 <skill-dir>/scripts/disk_cleanup.py scan --drives D: --categories duplicates large
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--drives` | system drive | Drive ids, roots, or labels from `drives` |
| `--auto` | off | Automatic mode: the system drive only, whatever `--drives` says |
| `--level` | saved, else `safe` | Recorded in the scan; the report shows every level anyway |
| `--categories` | all | Any of `temp caches logs trash duplicates downloads dev system config programs large` |
| `--jobs` | 2 per CPU, at most 16 | Parallel workers |
| `--out` | `~/.gti/disk-cleanup/<machine>/scans/<stamp>/` | Folder for `scan.json` and `report.md` |

The scan finds everything at every level; the level only matters for cleaning. That way the report can show what each level would free.

## What runs in parallel

```text
scan
 ├── targets     known temp, cache, log, and trash folders, sized in a thread pool (native du when present)
 ├── commands    cleanups the owning tool does (apt-get clean, docker prune, Dism), each probed for size
 ├── system      leftovers that need a probe (Windows.old)
 ├── config      settings that waste space (journald, hibernation, restore points, WSL disks)
 ├── programs    installed programs and when each was last used
 └── data walk   the user's data, split breadth first across one process per CPU
       ├── duplicates   size, then first and last 64 KiB, then the whole file (BLAKE2b)
       ├── dev          build output next to its marker file, sized from single-link files only
       ├── downloads    old installers, disk images, extracted archives
       └── large        the 25 largest files and the space per folder
```

On a laptop with 4.7 million files the whole scan took about 35 seconds. A tool that is missing (docker, snap, flatpak) or a probe that fails becomes a line under "Not verified", never a failed scan.

## Elevation

Without administrator or root rights, folders the user cannot read are measured as far as possible and items that need rights are marked `admin`. Do not elevate on your own and never ask for a password. If the user wants those items, they can run the agent's terminal as Administrator or with their own `sudo`, or run the listed commands themselves.

## Reading the result

The scan prints the reclaimable total per level and writes `report.md`. Sizes are allocated bytes on disk, not apparent sizes, so sparse files (Docker.raw, VM disks) are not overcounted. Hardlinked files are counted once, and build folders count only files no other folder links to (pnpm and Bun stores link into `node_modules`).
