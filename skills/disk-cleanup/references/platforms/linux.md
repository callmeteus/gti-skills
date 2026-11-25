# Linux

Run the script with `python3`. Any distribution with `/proc`; package manager items appear only for the managers installed.

## Drives and Google Drive

Drives come from `/proc/self/mountinfo`, one per device, so btrfs subvolumes of one device (`/` and `/home`) are one drive. The system drive is the device mounted at `/`. Pseudo file systems (proc, tmpfs, overlay, squashfs snaps, lxcfs, portals) are not drives. `/boot` and `/boot/efi` are never scanned.

Linux has no official Google Drive client, so Google Drive arrives as a FUSE or gvfs mount: rclone (`fuse.rclone`), google-drive-ocamlfuse, gnome-online-accounts (`/run/user/<uid>/gvfs/google-drive:...`), or Insync and similar folders in the home. All are excluded, as are `~/GoogleDrive`, `~/Google Drive`, `~/gdrive`, `~/Insync`, `~/Dropbox`, `~/OneDrive`, `~/.cache/rclone` (rclone's VFS cache can hold unsynced writes), and every network mount.

The data walk on the system drive covers the home folder and non-standard top-level folders (`/data`, `/work`), never `/usr`, `/etc`, `/var`, `/timeshift`, or `/.snapshots`.

## Speed

Folder sizes come from `du -skx` (allocated size, one file system), the data walk runs in one process per CPU.

## Root

Items marked `admin` need root. The skill never runs `sudo` and never asks for a password. The user can run the commands in the report, or run the agent under their own `sudo` session. Without root, the system journal size may be unreadable (unless the user is in the `systemd-journal` or `adm` group) and Docker data needs the `docker` group.

## What is checked

| Category | Items |
|----------|-------|
| Temp | `/tmp`, `/var/tmp` (entries changed or read within 2 days stay; X11, ICE, systemd-private, tmux, and ssh entries always stay) |
| Caches | Thumbnails, Firefox (including snap and flatpak), Chrome, Chromium, Brave, Edge, Vivaldi, Opera, Electron apps in `~/.config`, service worker caches, pip, uv, Poetry, pipenv, npm, Yarn, pnpm, Bun, node-gyp, Go, Mesa and NVIDIA shader caches, JetBrains, Bazel, pre-commit, Deno, Playwright, Cypress, Cargo, Gradle, Maven, Hugging Face, PyTorch, Whisper, Steam shader cache, Conda, Homebrew |
| Logs | `/var/crash`, `/var/lib/systemd/coredump`, rotated logs in `/var/log`, `journalctl --vacuum-size=200M` |
| Trash | `~/.local/share/Trash` and `.Trash-<uid>` on each chosen mount |
| System | `apt-get clean`, `apt-get autoremove --purge` (old kernels), `dnf clean all`, `dnf autoremove`, `paccache -rk2`, `pacman -Scc`, `zypper clean --all`, `flatpak uninstall --unused`, disabled snap revisions, snapd cache, `nix-collect-garbage` |
| Dev | Docker and Podman images, build cache, stopped containers, volumes (never automatic) |
| Config | journald without `SystemMaxUse`, snap `refresh.retain` over 2, any single log over 1 GB in `/var/log`, Docker logs without `max-size`, core dumps over 1 GB, Baloo or Tracker index over 1 GB, swap file far above RAM, Timeshift or Snapper keeping many snapshots |
| Programs | Flatpak apps (last use from `~/.var/app`), snaps (from `~/snap`), AppImages, manually installed packages with a desktop launcher (last use from access time; approximate, wrong on `noatime` mounts) |

## Restore

| Change | Undo |
|--------|------|
| journald limit | Delete `/etc/systemd/journald.conf.d/50-size.conf`, `systemctl restart systemd-journald` |
| Core dump limit | Delete `/etc/systemd/coredump.conf.d/50-size.conf` |
| snap retain | `snap set system refresh.retain=<old>` |
| Docker log limit | Remove `log-opts` from `/etc/docker/daemon.json`, restart Docker |
