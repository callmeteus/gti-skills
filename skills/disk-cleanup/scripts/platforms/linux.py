"""Linux: mounts from /proc/self/mountinfo, XDG caches, package managers, journald, snap, flatpak, Docker."""

from __future__ import annotations

import glob
import json
import os
import re
import time
from pathlib import Path

from cleanup import fsutil
from cleanup.drives import CLOUD_FSTYPES, NETWORK_FSTYPES, Drive, classify, root_names
from cleanup.model import REPORT, SETTING, Finding, parse_human
from platforms.base import Command, Platform, Target, unused_program

REAL_FSTYPES = {
    "ext2", "ext3", "ext4", "xfs", "btrfs", "zfs", "f2fs", "ntfs", "ntfs3", "fuseblk", "vfat", "exfat",
    "bcachefs", "jfs", "reiserfs", "hfsplus", "apfs", "nilfs2",
}
SKIP_MOUNT_PREFIXES = ("/proc", "/sys", "/dev", "/run/credentials", "/snap/", "/var/lib/docker", "/var/snap",
                       "/var/lib/containers", "/var/lib/kubelet")
BOOT_MOUNTS = {"/boot", "/boot/efi", "/efi"}
BROWSERS = ("google-chrome", "google-chrome-beta", "chromium", "BraveSoftware/Brave-Browser", "microsoft-edge",
            "vivaldi", "opera")
FHS = {"bin", "boot", "dev", "etc", "home", "lib", "lib32", "lib64", "libx32", "lost+found", "media", "mnt",
       "opt", "proc", "root", "run", "sbin", "snap", "srv", "sys", "tmp", "usr", "var", "cdrom", "swapfile",
       "swap.img", "timeshift", ".snapshots", "nix", "efi"}


def unescape(text):
    return re.sub(r"\\([0-7]{3})", lambda m: chr(int(m.group(1), 8)), text)


def parse_mountinfo(text):
    """Returns [(source, mountpoint, fstype, major:minor)] from /proc/self/mountinfo."""
    mounts = []
    for line in text.splitlines():
        left, _, right = line.partition(" - ")
        lf, rf = left.split(), right.split()
        if len(lf) < 5 or len(rf) < 2:
            continue
        mounts.append((unescape(rf[1]), unescape(lf[4]), rf[0], lf[2]))
    return mounts


def group_drives(mounts, labels=None, removable=None):
    """One drive per device. Btrfs subvolumes of one device (/ and /home) are one drive."""
    labels, removable = labels or {}, removable or set()
    drives = {}
    for source, mountpoint, fstype, devno in mounts:
        if mountpoint.startswith(SKIP_MOUNT_PREFIXES) or mountpoint in BOOT_MOUNTS:
            continue
        remote = fstype in CLOUD_FSTYPES or fstype in NETWORK_FSTYPES
        if fstype not in REAL_FSTYPES and not remote and "/gvfs" not in mountpoint:
            continue  # proc, tmpfs, overlay, squashfs, lxcfs, and other virtual file systems
        key = source if source.startswith("/dev/") else f"{source}@{devno}"
        drive = drives.get(key)
        if drive is None:
            real = os.path.realpath(source) if source.startswith("/dev/") else source
            drive = drives[key] = Drive(id=source if source.startswith("/dev/") else mountpoint,
                                        label=labels.get(real, ""), fstype=fstype,
                                        kind="removable" if real in removable else "fixed")
        drive.mountpoints.append(mountpoint)
    for drive in drives.values():
        drive.mountpoints.sort(key=len)
        drive.system = "/" in drive.mountpoints
        if drive.system:
            drive.id = "/"
    return list(drives.values())


class Linux(Platform):
    name = "linux"
    program_usage_hint = "Access times are missing on noatime mounts."

    def list_drives(self):
        try:
            text = Path("/proc/self/mountinfo").read_text(encoding="utf-8", errors="replace")
        except OSError:
            text = ""
        labels = {}
        for link in glob.glob("/dev/disk/by-label/*"):
            labels[os.path.realpath(link)] = unescape(os.path.basename(link).replace("\\x20", " "))
        removable = set()
        for dev in glob.glob("/sys/class/block/*"):
            real = os.path.realpath(dev)
            for candidate in (os.path.join(real, "removable"), os.path.join(os.path.dirname(real), "removable")):
                try:
                    if Path(candidate).read_text().strip() == "1":
                        removable.add("/dev/" + os.path.basename(dev))
                        break
                except OSError:
                    continue
        drives = group_drives(parse_mountinfo(text), labels, removable)
        for drive in drives:
            classify(drive, root_names(drive.root) if not drive.fstype.startswith("fuse.") else ())
            usage = fsutil.disk_usage(drive.root) if not drive.excluded else {"total": 0, "free": 0}
            drive.total, drive.free = usage["total"], usage["free"]
        return drives

    def cloud_paths(self):
        h = self.home
        names = ["GoogleDrive", "Google Drive", "google-drive", "gdrive", "My Drive", "Insync", "Dropbox",
                 "OneDrive", "pCloudDrive", "MEGA", "Nextcloud", "ownCloud", ".cache/rclone", ".local/share/insync",
                 ".config/Insync", ".dropbox", ".dropbox-dist"]
        paths = [str(h / n) for n in names]
        uid = os.getuid() if hasattr(os, "getuid") else 0
        paths.append(f"/run/user/{uid}/gvfs")
        return paths

    def protected_paths(self):
        system = ["/", "/bin", "/boot", "/etc", "/home", "/lib", "/lib64", "/opt", "/root", "/sbin", "/srv", "/usr",
                  "/var", "/var/lib", "/var/log", "/var/cache", "/tmp", "/var/tmp", "/snap", "/nix", "/media", "/mnt"]
        return super().protected_paths() + system + [str(self.home / ".config"), str(self.home / ".local"),
                                                     str(self.home / ".local/share"), str(self.home / ".cache")]

    def downloads_dir(self):
        out = fsutil.run(["xdg-user-dir", "DOWNLOAD"], timeout=5)
        if out and out.strip() and out.strip() != str(self.home):
            return Path(out.strip())
        dirs = self.home / ".config/user-dirs.dirs"
        try:
            for line in dirs.read_text().splitlines():
                if line.startswith("XDG_DOWNLOAD_DIR="):
                    value = line.split("=", 1)[1].strip().strip('"').replace("$HOME", str(self.home))
                    return Path(value)
        except OSError:
            pass
        return self.home / "Downloads"

    def data_roots(self, ctx, drive):
        if not drive.system:
            return list(drive.mountpoints)
        roots = [str(self.home)] if ctx.on_selected(str(self.home)) else []
        try:
            for entry in os.scandir("/"):
                if entry.name not in FHS and not entry.name.endswith(".usr-is-merged") \
                        and entry.is_dir(follow_symlinks=False) and ctx.on_selected(entry.path):
                    roots.append(entry.path)
        except OSError:
            pass
        return roots

    def walk_skip(self, ctx):
        return super().walk_skip(ctx) | {fsutil.norm(p) for p in ("/timeshift", "/.snapshots", "/proc", "/sys")}

    # Targets -----------------------------------------------------------------------------------
    def targets(self, ctx):
        h = "~"
        browsers = []
        for browser in BROWSERS:
            for sub in ("Cache", "Code Cache", "GPUCache"):
                browsers.append(f"{h}/.cache/{browser}/*/{sub}")
                browsers.append(f"{h}/.config/{browser}/*/{sub}")
        return [
            Target("temp", "Temporary files older than the temp age", ("/tmp", "/var/tmp"), older_than_days="temp",
                   reason="Files left in the temp folders by programs that did not clean up."),
            Target("caches", "Thumbnail cache", (f"{h}/.cache/thumbnails",)),
            Target("caches", "Firefox cache", (f"{h}/.cache/mozilla/firefox/*/cache2",
                                               f"{h}/snap/firefox/common/.cache/mozilla/firefox/*/cache2",
                                               f"{h}/.var/app/org.mozilla.firefox/cache/mozilla/firefox/*/cache2")),
            Target("caches", "Chromium-based browser caches", tuple(browsers)),
            Target("caches", "Electron app caches (VS Code, Slack, Discord, Teams)",
                   (f"{h}/.config/*/Cache", f"{h}/.config/*/Code Cache", f"{h}/.config/*/GPUCache",
                    f"{h}/.config/*/CachedData", f"{h}/.config/Code/CachedExtensionVSIXs")),
            Target("caches", "Service worker caches of web apps",
                   (f"{h}/.config/*/*/Service Worker/CacheStorage", f"{h}/.config/*/Service Worker/CacheStorage"),
                   level="aggressive", restore="Web apps download their offline files again."),
            Target("caches", "Python package caches (pip, uv, Poetry, pipenv)",
                   (f"{h}/.cache/pip", f"{h}/.cache/uv", f"{h}/.cache/pypoetry/cache", f"{h}/.cache/pypoetry/artifacts",
                    f"{h}/.cache/pipenv")),
            Target("caches", "JavaScript package caches (npm, Yarn, pnpm, Bun, node-gyp)",
                   (f"{h}/.npm/_cacache", f"{h}/.cache/yarn", f"{h}/.yarn/berry/cache", f"{h}/.cache/node-gyp",
                    f"{h}/.bun/install/cache", f"{h}/.cache/typescript", f"{h}/.cache/electron",
                    f"{h}/.cache/electron-builder")),
            Target("caches", "pnpm store", (f"{h}/.local/share/pnpm/store",), level="aggressive",
                   restore="pnpm downloads packages again on the next install."),
            Target("caches", "Go build cache", (f"{h}/.cache/go-build",)),
            Target("caches", "GPU shader caches", (f"{h}/.cache/mesa_shader_cache", f"{h}/.cache/mesa_shader_cache_db",
                                                   f"{h}/.nv/GLCache", f"{h}/.cache/nvidia/GLCache")),
            Target("caches", "App caches (Spotify, GNOME Software, fontconfig, VS Code C++)",
                   (f"{h}/.cache/spotify", f"{h}/.cache/gnome-software", f"{h}/.cache/fontconfig",
                    f"{h}/.cache/vscode-cpptools")),
            Target("caches", "Developer tool caches (JetBrains, Bazel, pre-commit, Deno, Playwright, Cypress)",
                   (f"{h}/.cache/JetBrains", f"{h}/.cache/bazel", f"{h}/.cache/pre-commit", f"{h}/.cache/deno",
                    f"{h}/.cache/ms-playwright", f"{h}/.cache/Cypress", f"{h}/.cache/puppeteer"),
                   level="aggressive", restore="Each tool downloads or rebuilds it on next use (IDE indexes rebuild)."),
            Target("caches", "Rust, Gradle, and Maven download caches",
                   (f"{h}/.cargo/registry/cache", f"{h}/.cargo/registry/src", f"{h}/.cargo/git/checkouts",
                    f"{h}/.gradle/caches", f"{h}/.gradle/wrapper/dists"),
                   level="aggressive", restore="Builds download the dependencies again."),
            Target("caches", "Maven local repository", (f"{h}/.m2/repository",), level="yolo",
                   risk="Artifacts installed locally with mvn install and not published are lost.",
                   restore="Builds download the dependencies again; rerun mvn install for local artifacts."),
            Target("caches", "Machine learning model caches (Hugging Face, PyTorch, Whisper)",
                   (f"{h}/.cache/huggingface", f"{h}/.cache/torch", f"{h}/.cache/whisper"), level="yolo",
                   risk="Models are downloaded again, often several GB each.", restore="Downloaded again on next use."),
            Target("caches", "Steam shader cache", (f"{h}/.local/share/Steam/steamapps/shadercache",
                                                    f"{h}/.steam/steam/steamapps/shadercache"), level="aggressive",
                   restore="Games rebuild shaders on next start (first launch is slower)."),
            Target("logs", "Crash reports", ("/var/crash",), admin=True),
            Target("logs", "Core dumps", ("/var/lib/systemd/coredump",), admin=True),
            Target("logs", "Rotated system logs", ("/var/log/*.gz", "/var/log/*/*.gz", "/var/log/*.[0-9]",
                                                    "/var/log/*/*.[0-9]", "/var/log/*.old"),
                   action="delete", admin=True, reason="Old log files already rotated out by logrotate."),
            Target("logs", "Old user session logs", (f"{h}/.xsession-errors.old", f"{h}/.local/share/xorg/*.old"),
                   action="delete"),
            Target("system", "snapd download cache", ("/var/lib/snapd/cache",), admin=True,
                   reason="Copies of installed snaps that snapd keeps as a download cache."),
        ]

    def trash_targets(self, ctx):
        uid = os.getuid() if hasattr(os, "getuid") else 0
        patterns = ["~/.local/share/Trash/files", "~/.local/share/Trash/info", "~/.local/share/Trash/expunged"]
        for drive in ctx.selected:
            for mount in drive.mountpoints:
                patterns += [f"{mount.rstrip('/')}/.Trash-{uid}/files", f"{mount.rstrip('/')}/.Trash-{uid}/info",
                             f"{mount.rstrip('/')}/.Trash/{uid}"]
        return [Target("trash", "Trash", tuple(patterns), level="aggressive",
                       reason="Files the user already deleted.", restore="Not recoverable after emptying.")]

    # Commands ----------------------------------------------------------------------------------
    def commands(self, ctx):
        docker = DockerProbe("docker")
        podman = DockerProbe("podman")
        return [
            Command("system", "APT package cache", ["apt-get", "clean"], binary="apt-get", admin=True,
                    measure=("/var/cache/apt/archives",), on="/var/cache"),
            Command("system", "Packages and old kernels no longer needed (APT)", ["apt-get", "autoremove", "--purge", "-y"],
                    level="aggressive", binary="apt-get", admin=True, probe=old_kernels, on="/usr",
                    risk="Removes kernels older than the running and newest ones; keep one fallback kernel.",
                    restore="Reinstall the package with apt-get install."),
            Command("system", "DNF package cache", ["dnf", "clean", "all"], binary="dnf", admin=True,
                    measure=("/var/cache/dnf", "/var/cache/yum", "/var/cache/libdnf5"), on="/var/cache"),
            Command("system", "Packages no longer needed (DNF)", ["dnf", "autoremove", "-y"], level="aggressive",
                    binary="dnf", admin=True, probe=old_kernels, on="/usr"),
            Command("system", "Pacman cache beyond the last two versions", ["paccache", "-rk2"], binary="paccache",
                    admin=True, measure=("/var/cache/pacman/pkg",), on="/var/cache",
                    reason="Measured size is the whole cache; the command keeps the last two versions of each package."),
            Command("system", "Whole Pacman cache", ["pacman", "-Scc", "--noconfirm"], level="yolo", binary="pacman",
                    admin=True, measure=("/var/cache/pacman/pkg",), on="/var/cache",
                    risk="Downgrading a package needs a download from the archive."),
            Command("system", "Zypper cache", ["zypper", "clean", "--all"], binary="zypper", admin=True,
                    measure=("/var/cache/zypp",), on="/var/cache"),
            Command("system", "Unused Flatpak runtimes", ["flatpak", "uninstall", "--unused", "-y"], binary="flatpak",
                    probe=flatpak_unused, on="/var/lib/flatpak"),
            Command("system", "Disabled snap revisions", SNAP_DISABLED, shell=True, level="aggressive", binary="snap",
                    admin=True, probe=snap_disabled, on="/var/lib/snapd",
                    reason="snapd keeps old revisions of each snap for rollback.",
                    restore="snap revert is no longer possible for the removed revisions."),
            Command("logs", "systemd journal above 200 MB", ["journalctl", "--vacuum-size=200M"], level="aggressive",
                    binary="journalctl", admin=True, probe=journal_excess, on="/var/log",
                    risk="Logs older than what fits in 200 MB are gone."),
            Command("dev", "Dangling Docker images", ["docker", "image", "prune", "-f"], binary="docker",
                    probe=docker.reclaim("Images", dangling=True), on="/var/lib/docker"),
            Command("dev", "Docker build cache", ["docker", "builder", "prune", "-f"], level="aggressive",
                    binary="docker", probe=docker.reclaim("Build Cache"), on="/var/lib/docker",
                    restore="The next docker build is slower."),
            Command("dev", "Every unused Docker image, stopped container, and network", ["docker", "system", "prune", "-a", "-f"],
                    level="yolo", binary="docker", probe=docker.reclaim("Images", "Containers"), on="/var/lib/docker",
                    risk="Stopped containers and their writable layers are deleted; images are pulled again."),
            Command("dev", "Unused Docker volumes", ["docker", "volume", "prune", "-a", "-f"], level="yolo",
                    binary="docker", auto=False, probe=docker.reclaim("Local Volumes"), on="/var/lib/docker",
                    risk="Volumes hold databases and uploads. Never run without the user's explicit yes."),
            Command("dev", "Unused Podman images", ["podman", "image", "prune", "-a", "-f"], level="aggressive",
                    binary="podman", probe=podman.reclaim("Images"), on=str(self.home)),
            Command("caches", "Conda package cache", ["conda", "clean", "--all", "-y"], level="aggressive",
                    binary="conda", measure=("~/miniconda3/pkgs", "~/anaconda3/pkgs", "~/miniforge3/pkgs",
                                             "~/mambaforge/pkgs", "~/.conda/pkgs")),
            Command("caches", "Homebrew cache", ["brew", "cleanup", "--prune=all", "-s"], binary="brew",
                    measure=("~/.cache/Homebrew",)),
            Command("system", "Nix store garbage", ["nix-collect-garbage"], binary="nix-collect-garbage", probe=unknown_size,
                    on="/nix"),
            Command("system", "Old Nix generations and their garbage", ["nix-collect-garbage", "-d"], level="yolo",
                    binary="nix-collect-garbage", probe=unknown_size, on="/nix",
                    risk="Rolling back to an older generation is no longer possible."),
        ]

    # Config ------------------------------------------------------------------------------------
    def config_findings(self, ctx):
        findings = []
        usage = journal_usage()
        if usage and usage > 1024 ** 3 and not journald_limit():
            findings.append(Finding(
                category="config", title="systemd journal has no size limit", action=SETTING, level="safe",
                admin=True, details={"prevents": "logs"},
                command="mkdir -p /etc/systemd/journald.conf.d && printf '[Journal]\\nSystemMaxUse=500M\\n' "
                        "> /etc/systemd/journald.conf.d/50-size.conf && systemctl restart systemd-journald && "
                        "journalctl --vacuum-size=500M", shell=True,
                reason=f"The journal uses {usage // 1024 ** 2} MB and SystemMaxUse is not set.",
                restore="Delete /etc/systemd/journald.conf.d/50-size.conf and restart systemd-journald."))
        retain = fsutil.run(["snap", "get", "system", "refresh.retain"], timeout=10)
        if retain and retain.strip().isdigit() and int(retain.strip()) > 2:
            findings.append(Finding(
                category="config", title="snapd keeps more than two revisions of every snap", action=SETTING,
                level="aggressive", admin=True, estimate=True, command=["snap", "set", "system", "refresh.retain=2"],
                reason=f"refresh.retain is {retain.strip()}.", restore=f"snap set system refresh.retain={retain.strip()}"))
        for path in big_files(["/var/log"], 1024 ** 3, depth=2):
            findings.append(Finding(
                category="config", title=f"Runaway log {os.path.basename(path)}", action=SETTING, level="aggressive",
                admin=True, size=os.path.getsize(path), paths=[path], command=["truncate", "-s", "0", path],
                reason="A single log over 1 GB means a service logs in a loop or logrotate does not cover it. "
                       "Find the service before truncating, or it fills again.",
                restore="The old log lines are gone."))
        docker_logs = sum(fsutil.allocated(fsutil.lstat(p)) for p in glob.glob("/var/lib/docker/containers/*/*-json.log")
                          if fsutil.lstat(p))
        if docker_logs > 1024 ** 3 and "max-size" not in read("/etc/docker/daemon.json"):
            findings.append(Finding(
                category="config", title="Docker container logs grow without limit", action=SETTING, level="safe",
                admin=True, size=docker_logs,
                manual=True, command='echo \'{"log-driver": "json-file", "log-opts": {"max-size": "50m", "max-file": "3"}}\' '
                        "# merge into /etc/docker/daemon.json, then systemctl restart docker", shell=True,
                reason="daemon.json sets no log-opts max-size; container logs keep growing.",
                risk="Restarting Docker restarts containers; the limit applies to containers created after it.",
                restore="Remove log-opts from /etc/docker/daemon.json and restart Docker."))
        coredumps = fsutil.tree("/var/lib/systemd/coredump").size
        if coredumps > 1024 ** 3:
            findings.append(Finding(
                category="config", title="Core dumps take over 1 GB", action=SETTING, level="safe", admin=True,
                shell=True, details={"prevents": "logs", "coredumps": coredumps},
                command="mkdir -p /etc/systemd/coredump.conf.d && printf '[Coredump]\\nMaxUse=500M\\n' > "
                        "/etc/systemd/coredump.conf.d/50-size.conf",
                reason="A program crashes repeatedly or core dump storage has no limit.",
                restore="Delete /etc/systemd/coredump.conf.d/50-size.conf."))
        for index, label, command in (
            (self.home / ".local/share/baloo", "KDE Baloo file index", "balooctl6 disable && balooctl6 purge"),
            (self.home / ".cache/tracker3", "GNOME Tracker file index", "tracker3 reset -s -r"),
        ):
            size = fsutil.tree(index).size
            if size > 1024 ** 3:
                findings.append(Finding(
                    category="config", title=f"{label} is over 1 GB", action=SETTING, level="aggressive", size=size,
                    command=command, shell=True, reason="Desktop search indexes every file, including build folders.",
                    risk="Desktop file search gets slower or stops finding file contents.",
                    restore="Enable the indexer again in the desktop search settings."))
        findings += swap_and_snapshots(ctx)
        return findings

    # Programs ----------------------------------------------------------------------------------
    def programs(self, ctx):
        found = []
        out = fsutil.run(["flatpak", "list", "--app", "--columns=application,name,size"], timeout=30)
        for line in (out or "").splitlines():
            parts = line.split("\t")
            if len(parts) < 3:
                continue
            app, name, size = parts[0], parts[1], parse_human(parts[2])
            last = fsutil.newest_mtime(self.home / ".var/app" / app)
            found.append(unused_program(ctx, name, size, last, "last change in ~/.var/app",
                                        ["flatpak", "uninstall", "-y", app], details={"kind": "flatpak"}))
        out = fsutil.run(["snap", "list"], timeout=30)
        for line in (out or "").splitlines()[1:]:
            parts = line.split()
            if len(parts) < 3 or parts[0] in ("core", "core18", "core20", "core22", "core24", "snapd", "bare") \
                    or parts[0].startswith(("gnome-", "gtk-", "kde-", "mesa-")):
                continue
            snap_file = Path(f"/var/lib/snapd/snaps/{parts[0]}_{parts[2]}.snap")
            size = snap_file.stat().st_size if snap_file.exists() else 0
            last = fsutil.newest_mtime(self.home / "snap" / parts[0])
            found.append(unused_program(ctx, parts[0], size, last, "last change in ~/snap",
                                        ["snap", "remove", parts[0]], admin=True, details={"kind": "snap"}))
        for image in [*glob.glob(str(self.home / "Applications/*.AppImage")), *glob.glob(str(self.home / "*.AppImage")),
                      *glob.glob(str(self.home / ".local/bin/*.AppImage"))]:
            st = fsutil.lstat(image)
            if st:
                found.append(unused_program(ctx, os.path.basename(image), st.st_size, st.st_atime, "file access time",
                                            ["rm", image], paths=[image], details={"kind": "AppImage"}))
        found += apt_programs(ctx)
        return [f for f in found if f]


SNAP_DISABLED = ("LANG=C snap list --all | awk '/disabled/{print $1, $3}' | "
                 "while read name rev; do snap remove \"$name\" --revision=\"$rev\"; done")


def apt_programs(ctx):
    """Manually installed packages that ship a desktop launcher: libraries and kernels are not programs."""
    if not fsutil.run_exists("dpkg-query") or not fsutil.run_exists("apt-mark"):
        return []
    manual = set((fsutil.run(["apt-mark", "showmanual"], timeout=30) or "").split())
    out = fsutil.run(["dpkg-query", "-W", "-f=${Installed-Size}\\t${Package}\\n"], timeout=60) or ""
    sizes = []
    for line in out.splitlines():
        size, _, name = line.partition("\t")
        if name in manual and size.isdigit() and int(size) > 50 * 1024 and not NOT_PROGRAMS.match(name):
            sizes.append((int(size) * 1024, name))
    found = []
    for size, name in sorted(sizes, reverse=True)[:40]:
        files = (fsutil.run(["dpkg", "-L", name], timeout=20) or "").splitlines()
        if not any(f.startswith("/usr/share/applications/") and f.endswith(".desktop") for f in files):
            continue
        binaries = [f for f in files if re.match(r"^/(usr/)?(s?bin|games)/|^/opt/|^/usr/share/[^/]+/[^/]+$", f)]
        last = 0
        for path in binaries[:400]:
            try:
                st = os.stat(path)
            except OSError:
                continue
            if os.path.isfile(path) and os.access(path, os.X_OK):
                last = max(last, st.st_atime)
        found.append(unused_program(ctx, name, size, last or None, "access time of its programs (approximate, needs relatime)",
                                    ["apt-get", "remove", "--purge", "-y", name], admin=True, details={"kind": "deb"}))
    return found


NOT_PROGRAMS = re.compile(r"^(lib|linux-|firmware|fonts?-|python3?-|perl|gir1|.*-dev$|.*-common$|.*-data$)")


def read(path):
    try:
        return Path(path).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def journal_usage():
    out = fsutil.run(["journalctl", "--disk-usage"], timeout=30)
    if not out:
        return None
    match = re.search(r"take up ([\d.,]+\s*[KMGT]?)", out)
    return parse_human(match.group(1)) if match else None


def journald_limit():
    texts = [read("/etc/systemd/journald.conf")] + [read(p) for p in glob.glob("/etc/systemd/journald.conf.d/*.conf")]
    texts += [read(p) for p in glob.glob("/usr/lib/systemd/journald.conf.d/*.conf")]
    return any(re.search(r"^\s*SystemMaxUse\s*=\s*\S", t, re.M) for t in texts)


def journal_excess(ctx):
    usage = journal_usage()
    if not usage or usage <= 200 * 1024 ** 2:
        return None
    return usage - 200 * 1024 ** 2, False, {"journal": usage}


def old_kernels(ctx):
    running = os.uname().release if hasattr(os, "uname") else ""
    versions = sorted((os.path.basename(p) for p in glob.glob("/lib/modules/*")), key=version_key)
    keep = {running} | set(versions[-1:])
    old = [v for v in versions if v not in keep]
    if not old:
        return 0, True, {}
    size = sum(fsutil.tree(f"/lib/modules/{v}").size for v in old)
    size += sum(fsutil.tree(p).size for v in old for p in glob.glob(f"/boot/*{v}*"))
    return size, True, {"old_kernels": old, "running": running}


def version_key(text):
    return [int(p) if p.isdigit() else p for p in re.split(r"[.\-+]", text)]


def snap_disabled(ctx):
    out = fsutil.run(["snap", "list", "--all"], timeout=30)
    if not out:
        return None
    size, revisions = 0, []
    for line in out.splitlines()[1:]:
        parts = line.split()
        if len(parts) >= 6 and "disabled" in parts[-1]:
            snap_file = Path(f"/var/lib/snapd/snaps/{parts[0]}_{parts[2]}.snap")
            size += snap_file.stat().st_size if snap_file.exists() else 0
            revisions.append(f"{parts[0]} rev {parts[2]}")
    return (size, False, {"revisions": revisions}) if revisions else None


def flatpak_unused(ctx):
    out = fsutil.run(["flatpak", "list", "--runtime", "--columns=application"], timeout=30)
    return (0, True, {"note": "flatpak does not report the size before removal"}) if out and out.strip() else None


def unknown_size(ctx):
    return 0, True, {"note": "size known only after the command runs"}


def big_files(roots, threshold, depth=2):
    found = []
    for root in roots:
        stack = [(root, 0)]
        while stack:
            folder, level = stack.pop()
            try:
                entries = list(os.scandir(folder))
            except OSError:
                continue
            for entry in entries:
                st = fsutil.lstat(entry.path)
                if st is None or fsutil.is_link(st):
                    continue
                if entry.is_dir(follow_symlinks=False) and level < depth:
                    stack.append((entry.path, level + 1))
                elif entry.is_file(follow_symlinks=False) and fsutil.allocated(st) >= threshold:
                    found.append(entry.path)
    return found


def swap_and_snapshots(ctx):
    findings = []
    try:
        ram = os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")
    except (ValueError, OSError, AttributeError):
        ram = 0
    for swap in ("/swapfile", "/swap.img", "/swap/swapfile"):
        st = fsutil.lstat(swap)
        if st and ram and st.st_size > max(ram * 1.5, 8 * 1024 ** 3):
            findings.append(Finding(
                category="config", title=f"Swap file {swap} is larger than needed", action=SETTING, level="yolo",
                admin=True, size=st.st_size - ram, estimate=True,
                command=f"swapoff {swap} && fallocate -l {ram // 1024 ** 3}G {swap} && mkswap {swap} && swapon {swap}",
                shell=True, reason=f"Swap is {st.st_size // 1024 ** 3} GB on {ram // 1024 ** 3} GB of RAM.",
                risk="Hibernation needs swap at least the size of RAM; heavy workloads may run out of memory.",
                restore=f"Recreate it with fallocate -l {st.st_size // 1024 ** 3}G {swap}."))
    for folder, tool in (("/timeshift/snapshots", "Timeshift"), ("/.snapshots", "Snapper")):
        try:
            count = len(os.listdir(folder))
        except OSError:
            continue
        if count > 5:
            findings.append(Finding(
                category="config", title=f"{tool} keeps {count} snapshots", action=REPORT, level="aggressive",
                estimate=True, paths=[folder],
                reason=f"Each {tool} snapshot holds every file changed since the previous one. Lower the retention "
                       f"in {tool}'s settings and delete old snapshots there, never by deleting folders."))
    return findings


class DockerProbe:
    """Reads `docker system df` once and answers per resource type."""

    def __init__(self, binary):
        self.binary = binary
        self._rows = None

    def rows(self):
        if self._rows is None:
            out = fsutil.run([self.binary, "system", "df", "--format", "{{json .}}"], timeout=60)
            self._rows = {}
            for line in (out or "").splitlines():
                try:
                    row = json.loads(line)
                except ValueError:
                    continue
                self._rows[row.get("Type", "")] = row
        return self._rows

    def reclaim(self, *types, dangling=False):
        def probe(ctx):
            if dangling:
                out = fsutil.run([self.binary, "images", "--filter", "dangling=true", "--format", "{{.Size}}"], timeout=60)
                size = sum(parse_human(line) for line in (out or "").splitlines())
                return (size, True, {"note": "image sizes include layers shared with other images"}) if size else None
            rows = self.rows()
            if not rows:
                return None
            size = sum(parse_human(str(rows.get(t, {}).get("Reclaimable", "0")).split("(")[0]) for t in types)
            return (size, False, {}) if size else None
        return probe
