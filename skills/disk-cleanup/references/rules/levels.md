# Levels

A level includes every level below it. Levels choose what `--categories` and automatic mode take in bulk; an id the user picks, or a program the user names, runs whatever its level. A program is listed only when its last use is known and older than `unused_program_days`; a program with no reliable date is never called unused at any level, only counted in the report's notes. The scan finds all levels at once; the level decides what `clean` may act on. Settings and uninstalls are listed at a level but never applied without the user's yes for that item.

| Category | safe (seguro) | aggressive (agressivo) | yolo (não ligo) |
|----------|---------------|------------------------|-----------------|
| Temp | Temp folders, entries untouched for 2 days | | |
| Caches | Browser, Electron app, thumbnail, GPU shader, pip, uv, Poetry, npm, Yarn, Bun, Go, Homebrew caches | pnpm store, JetBrains, Bazel, Playwright, Cypress, Cargo, Gradle, service worker caches, Steam shader cache, NuGet, Conda, new Teams | Maven repository, Hugging Face, PyTorch, Whisper models, every app cache in `~/Library/Caches` (macOS) |
| Logs | Crash reports, core dumps, rotated system logs, WER archives, minidumps | journald above 200 MB | |
| Trash | | Trash and Recycle Bin of the chosen drives | |
| Duplicates | | Copies outside backup folders, the original kept | Copies when one copy is in a backup folder (never automatic) |
| Downloads | iOS and iPadOS update files (macOS) | Installers and disk images older than 30 days, archives older than 30 days already extracted, Mail downloads (macOS) | Installers older than 7 days, every archive older than 30 days |
| Dev | Dangling Docker images, Xcode DerivedData, unavailable simulators | Build output in projects untouched for 90 days, Docker build cache, device support files, simulator caches | Build output in active projects, every unused Docker image and stopped container, Xcode archives, Docker volumes (never automatic) |
| System | APT, DNF, Zypper, Pacman (last 2 versions) caches, unused Flatpak runtimes, snapd cache, Delivery Optimization cache, component store cleanup, Nix garbage | Old kernels and unused packages, disabled snap revisions, Windows Update downloads, upgrade leftovers, Time Machine local snapshots, Windows.old (manual) | Whole Pacman cache, old Nix generations, component store reset, Windows Installer patch cache, phone backups (never automatic) |
| Config | journald with no limit, Docker logs with no limit, core dumps over 1 GB, Storage Sense off, Homebrew never cleaning | Reduced hibernation file, restore points over 10%, search index over 2 GB, WSL and Docker disks that never shrink, snap keeping over 2 revisions, runaway logs, Baloo or Tracker over 1 GB, Docker Desktop disk image | Hibernation off, page file larger than needed, swap file larger than needed, CompactOS and reserved storage (only under 15% free), hibernation image on a desktop Mac |
| Programs | | Not used for 180 days, by a real last-use date | |
| Large | Report only, at every level | | |

## What "auto" means

A finding marked `auto` may be cleaned in automatic mode at its level. Not `auto`, at any level: settings, uninstalls, manual steps, Docker volumes, phone backups, and duplicate sets with a copy in a backup folder.

## Choosing a level

- **safe:** nothing the user would notice except slower first loads.
- **aggressive:** the user loses the trash, old installers, and rollback points (old kernels, snap revisions, local snapshots), and rebuilds old projects when they open them.
- **yolo:** the user rebuilds active projects, pulls Docker images again, downloads models again, and gives up a few safety nets. It still never touches documents, photos, cloud folders, keys, or the only copy of anything.
