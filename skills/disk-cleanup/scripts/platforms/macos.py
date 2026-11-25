"""macOS: volumes from `df` and `diskutil`, ~/Library caches, Xcode, Homebrew, Time Machine snapshots, iCloud."""

from __future__ import annotations

import glob
import os
import plistlib
import re
import time
from pathlib import Path

from cleanup import fsutil
from cleanup.drives import Drive, classify, root_names
from cleanup.model import REPORT, SETTING, Finding, parse_human
from platforms.base import Command, Platform, Target, unused_program
from platforms.linux import DockerProbe, unknown_size

# Caches that hold state, not just downloads: never emptied as part of "all of ~/Library/Caches".
KEEP_CACHES = {"com.apple.bird", "cloudkit", "com.apple.cloudkit", "com.apple.homed", "com.apple.containermanagerd",
               "com.apple.ap.adprivacyd", "familycircled", "com.apple.findmy.fmipcore", "com.apple.icloud.fmfd",
               "com.apple.nsurlsessiond", "com.apple.Safari.SafeBrowsing", "com.apple.akd"}


def parse_df(text):
    """`df -kP` lines -> [(device, mountpoint, total bytes, free bytes)]."""
    rows = []
    for line in text.splitlines()[1:]:
        match = re.match(r"^(\S+(?: \S+)*?)\s+(\d+)\s+(\d+)\s+(\d+)\s+\d+%\s+(/.*)$", line)
        if match:
            rows.append((match.group(1), match.group(5), int(match.group(2)) * 1024, int(match.group(4)) * 1024))
    return rows


class MacOS(Platform):
    name = "macos"
    program_usage_hint = "Spotlight has no last-opened date for apps it never indexed."

    def list_drives(self):
        out = fsutil.run(["df", "-kP"], timeout=30) or ""
        mounts = {}
        for line in (fsutil.run(["mount"], timeout=30) or "").splitlines():
            match = re.match(r"^(.+?) on (.+?) \(([^,)]+)", line)
            if match:
                mounts[match.group(2)] = (match.group(1), match.group(3))
        drives = []
        system = None
        for device, mountpoint, total, free in parse_df(out):
            source, fstype = mounts.get(mountpoint, (device, ""))
            if not device.startswith("/dev/") and not fstype.startswith(("smbfs", "nfs", "afpfs", "webdav", "macfuse",
                                                                          "osxfuse", "fuse")):
                continue
            if mountpoint.startswith("/System/Volumes/") and mountpoint != "/System/Volumes/Data":
                continue
            if mountpoint.startswith(("/Library/Developer/CoreSimulator", "/private/var/folders")):
                continue
            if mountpoint == "/System/Volumes/Data":
                if system:
                    system.mountpoints.append(mountpoint)
                continue
            drive = Drive(id=mountpoint, mountpoints=[mountpoint], fstype=fstype, total=total, free=free,
                          label=os.path.basename(mountpoint) if mountpoint != "/" else "Macintosh HD",
                          kind="network" if fstype in ("smbfs", "nfs", "afpfs", "webdav") else "fixed")
            if mountpoint == "/":
                drive.system = True
                system = drive
            classify(drive, root_names(mountpoint) if mountpoint != "/" else ())
            drives.append(drive)
        if system and "/System/Volumes/Data" not in system.mountpoints and os.path.isdir("/System/Volumes/Data"):
            system.mountpoints.append("/System/Volumes/Data")
        return drives

    def cloud_paths(self):
        h = self.home
        paths = [h / "Library/CloudStorage", h / "Library/Mobile Documents", h / "Google Drive", h / "GoogleDrive",
                 h / "My Drive", h / "Dropbox", h / "OneDrive", h / "Library/Application Support/Google/DriveFS",
                 h / "Library/Application Support/FileProvider", h / "Library/Containers/com.apple.CloudDocs.iCloudDriveFileProvider",
                 Path("/Volumes/GoogleDrive"), Path("/Volumes/Google Drive")]
        paths += [Path(p) for p in glob.glob(str(h / "Library/CloudStorage/*"))]
        return [str(p) for p in paths]

    def protected_paths(self):
        system = ["/", "/System", "/Library", "/Applications", "/Users", "/private", "/private/var", "/usr", "/bin",
                  "/sbin", "/opt", "/opt/homebrew", "/Volumes", "/System/Volumes/Data"]
        h = self.home
        return super().protected_paths() + system + [str(h / "Library"), str(h / "Library/Caches"),
                                                     str(h / "Library/Application Support"), str(h / "Applications")]

    def denied_paths(self):
        h = self.home
        return super().denied_paths() + [str(h / "Library/Keychains"), str(h / "Library/Mail"),
                                         str(h / "Library/Messages"), str(h / "Pictures/Photos Library.photoslibrary")]

    def appdata_names(self):
        return super().appdata_names() | {"applications"}

    # Targets -----------------------------------------------------------------------------------
    def targets(self, ctx):
        h = "~"
        tmp = os.environ.get("TMPDIR", "")
        chromium = []
        for browser in ("Google/Chrome", "BraveSoftware/Brave-Browser", "Microsoft Edge", "Chromium", "Vivaldi", "Arc/User Data"):
            for sub in ("Cache", "Code Cache", "GPUCache"):
                chromium.append(f"{h}/Library/Caches/{browser}/*/{sub}")
                chromium.append(f"{h}/Library/Application Support/{browser}/*/{sub}")
        return [
            Target("temp", "Temporary files older than the temp age", tuple(p for p in (tmp, "/private/tmp") if p),
                   older_than_days="temp", reason="Files left in the temp folders by programs that did not clean up."),
            Target("caches", "Browser caches (Safari, Chrome, Firefox, Edge, Brave, Arc)",
                   (f"{h}/Library/Caches/com.apple.Safari/WebKitCache", f"{h}/Library/Caches/Firefox/Profiles/*/cache2",
                    *chromium)),
            Target("caches", "Developer caches (Homebrew downloads, pip, npm, Yarn, Go, CocoaPods, Bun)",
                   (f"{h}/Library/Caches/Homebrew/downloads", f"{h}/Library/Caches/pip", f"{h}/.npm/_cacache",
                    f"{h}/Library/Caches/Yarn", f"{h}/Library/Caches/go-build", f"{h}/Library/Caches/CocoaPods",
                    f"{h}/.bun/install/cache", f"{h}/Library/Caches/pypoetry", f"{h}/.cache/uv", f"{h}/Library/Caches/node-gyp")),
            Target("caches", "Electron app caches (VS Code, Slack, Discord, Teams)",
                   (f"{h}/Library/Application Support/*/Cache", f"{h}/Library/Application Support/*/Code Cache",
                    f"{h}/Library/Application Support/*/GPUCache", f"{h}/Library/Application Support/*/CachedData")),
            Target("dev", "Xcode DerivedData", (f"{h}/Library/Developer/Xcode/DerivedData",),
                   restore="Xcode rebuilds it on the next build."),
            Target("dev", "Old iOS device support files", (f"{h}/Library/Developer/Xcode/iOS DeviceSupport",
                                                            f"{h}/Library/Developer/Xcode/watchOS DeviceSupport"),
                   level="aggressive", restore="Xcode copies them again when the device connects."),
            Target("dev", "Simulator caches", (f"{h}/Library/Developer/CoreSimulator/Caches",), level="aggressive"),
            Target("dev", "Xcode archives", (f"{h}/Library/Developer/Xcode/Archives",), level="yolo",
                   risk="Archives hold the dSYMs needed to read crash reports of shipped builds.",
                   restore="Not recoverable; rebuild from the tagged commit."),
            Target("caches", "Developer tool caches (JetBrains, Playwright, Cypress, Gradle, Cargo)",
                   (f"{h}/Library/Caches/JetBrains", f"{h}/Library/Caches/ms-playwright", f"{h}/Library/Caches/Cypress",
                    f"{h}/.gradle/caches", f"{h}/.cargo/registry/cache", f"{h}/.cargo/registry/src"),
                   level="aggressive", restore="Each tool downloads or rebuilds it on next use."),
            Target("caches", "Every other app cache in ~/Library/Caches", (f"{h}/Library/Caches/*",), action="delete_contents",
                   level="yolo", risk="Apps rebuild caches; some sign you out or redownload content.",
                   reason="Caches are regenerable by definition; a few apps keep state there, which is skipped."),
            Target("caches", "Machine learning model caches (Hugging Face, PyTorch)",
                   (f"{h}/.cache/huggingface", f"{h}/.cache/torch"), level="yolo",
                   risk="Models are downloaded again, often several GB each."),
            Target("logs", "User logs and crash reports", (f"{h}/Library/Logs/DiagnosticReports", f"{h}/Library/Logs/CrashReporter"),
                   reason="Crash and hang reports already sent or never needed."),
            Target("logs", "System crash reports", ("/Library/Logs/DiagnosticReports",), admin=True),
            Target("downloads", "iOS and iPadOS update files", (f"{h}/Library/iTunes/iPhone Software Updates",
                                                                 f"{h}/Library/iTunes/iPad Software Updates"),
                   level="safe", restore="Finder downloads the update again when needed."),
            Target("downloads", "Mail attachment downloads", (f"{h}/Library/Containers/com.apple.mail/Data/Library/Mail Downloads",),
                   level="aggressive", restore="Attachments stay in the messages and download again when opened."),
            Target("system", "iOS and iPadOS device backups", (f"{h}/Library/Application Support/MobileSync/Backup",),
                   level="yolo", auto=False, risk="The only local backup of a phone or tablet. Never without the user's yes.",
                   restore="Not recoverable; back the device up again."),
        ]

    def skip_target(self, path):
        return os.path.basename(path) in KEEP_CACHES

    def trash_targets(self, ctx):
        uid = os.getuid() if hasattr(os, "getuid") else 0
        patterns = ["~/.Trash"]
        for drive in ctx.selected:
            if not drive.system:
                patterns.append(f"{drive.root.rstrip('/')}/.Trashes/{uid}")
        return [Target("trash", "Trash", tuple(patterns), level="aggressive", reason="Files the user already deleted.",
                       restore="Not recoverable after emptying.")]

    # Commands ----------------------------------------------------------------------------------
    def commands(self, ctx):
        docker = DockerProbe("docker")
        return [
            Command("caches", "Homebrew old versions and cache", ["brew", "cleanup", "--prune=all", "-s"], binary="brew",
                    measure=("~/Library/Caches/Homebrew",)),
            Command("dev", "Unavailable iOS simulators", ["xcrun", "simctl", "delete", "unavailable"], binary="xcrun",
                    probe=simulators_unavailable),
            Command("system", "Time Machine local snapshots", ["tmutil", "thinlocalsnapshots", "/", "999999999999", "4"],
                    level="aggressive", binary="tmutil", probe=local_snapshots,
                    risk="Hourly local restore points are gone until Time Machine makes new ones.",
                    restore="Time Machine creates new local snapshots on its next backup."),
            Command("dev", "Dangling Docker images", ["docker", "image", "prune", "-f"], binary="docker",
                    probe=docker.reclaim("Images", dangling=True)),
            Command("dev", "Docker build cache", ["docker", "builder", "prune", "-f"], level="aggressive", binary="docker",
                    probe=docker.reclaim("Build Cache")),
            Command("dev", "Every unused Docker image, stopped container, and network", ["docker", "system", "prune", "-a", "-f"],
                    level="yolo", binary="docker", probe=docker.reclaim("Images", "Containers"),
                    risk="Stopped containers and their writable layers are deleted; images are pulled again."),
            Command("dev", "Unused Docker volumes", ["docker", "volume", "prune", "-a", "-f"], level="yolo", binary="docker",
                    auto=False, probe=docker.reclaim("Local Volumes"),
                    risk="Volumes hold databases and uploads. Never run without the user's explicit yes."),
            Command("caches", "Conda package cache", ["conda", "clean", "--all", "-y"], level="aggressive", binary="conda",
                    measure=("~/miniconda3/pkgs", "~/anaconda3/pkgs", "~/miniforge3/pkgs", "/opt/homebrew/Caskroom/miniconda/base/pkgs")),
            Command("system", "Nix store garbage", ["nix-collect-garbage"], binary="nix-collect-garbage", probe=unknown_size),
        ]

    # Config ------------------------------------------------------------------------------------
    def config_findings(self, ctx):
        findings = []
        raw = self.home / "Library/Containers/com.docker.docker/Data/vms/0/data/Docker.raw"
        st = fsutil.lstat(raw)
        if st and fsutil.allocated(st) > 20 * 1024 ** 3:
            findings.append(Finding(
                category="config", title="Docker Desktop disk image is large", action=SETTING, level="aggressive",
                size=fsutil.allocated(st), estimate=True, paths=[str(raw)],
                manual=True, command="Docker Desktop > Settings > Resources > Advanced: lower the disk image size limit",
                reason=f"Docker.raw uses {fsutil.allocated(st) // 1024 ** 3} GB. Prune first; the file shrinks as Docker trims it.",
                restore="Raise the limit again in the same setting."))
        sleep = fsutil.lstat("/private/var/vm/sleepimage")
        mode = fsutil.run(["pmset", "-g"], timeout=10) or ""
        match = re.search(r"hibernatemode\s+(\d+)", mode)
        if sleep and match and match.group(1) == "3" and is_desktop_mac():
            findings.append(Finding(
                category="config", title="Hibernation image on a desktop Mac", action=SETTING, level="yolo", admin=True,
                size=sleep.st_size, command="pmset -a hibernatemode 0 && rm /private/var/vm/sleepimage", shell=True,
                reason="A desktop Mac with power always connected rarely needs a hibernation image the size of RAM.",
                risk="A power cut while asleep loses the open session.", restore="pmset -a hibernatemode 3"))
        if os.environ.get("HOMEBREW_NO_INSTALL_CLEANUP"):
            findings.append(Finding(
                category="config", title="Homebrew never cleans old versions", action=SETTING, level="safe", estimate=True,
                manual=True, command="Remove HOMEBREW_NO_INSTALL_CLEANUP from your shell profile",
                reason="HOMEBREW_NO_INSTALL_CLEANUP keeps every old version of every formula.",
                restore="Set HOMEBREW_NO_INSTALL_CLEANUP=1 again."))
        return findings

    # Programs ----------------------------------------------------------------------------------
    def programs(self, ctx):
        apps = glob.glob("/Applications/*.app") + glob.glob(str(self.home / "Applications/*.app"))

        def inspect(app):
            if is_apple_app(app):
                return None
            size = fsutil.tree(app).size
            return unused_program(
                ctx, os.path.basename(app)[:-4], size, last_used(app), "Spotlight last opened date",
                ["mv", app, str(self.home / ".Trash")], paths=[app],
                risk="Leftover data stays in ~/Library/Application Support and ~/Library/Containers; remove it separately.",
                restore="Install it again from the App Store or its website.")

        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=ctx.jobs) as pool:
            return [f for f in pool.map(inspect, apps) if f]


def is_apple_app(app):
    try:
        with open(os.path.join(app, "Contents/Info.plist"), "rb") as handle:
            info = plistlib.load(handle)
    except (OSError, ValueError, plistlib.InvalidFileException):
        return False
    return str(info.get("CFBundleIdentifier", "")).startswith("com.apple.")


def last_used(app):
    out = fsutil.run(["mdls", "-name", "kMDItemLastUsedDate", "-raw", app], timeout=15)
    if not out or "null" in out:
        return None
    try:
        return time.mktime(time.strptime(out.strip()[:19], "%Y-%m-%d %H:%M:%S"))
    except ValueError:
        return None


def is_desktop_mac():
    model = fsutil.run(["sysctl", "-n", "hw.model"], timeout=5) or ""
    return not model.strip().startswith("MacBook")


def simulators_unavailable(ctx):
    out = fsutil.run(["xcrun", "simctl", "list", "devices", "unavailable"], timeout=60)
    if not out:
        return None
    ids = re.findall(r"\(([0-9A-F-]{36})\)", out)
    if not ids:
        return None
    base = Path.home() / "Library/Developer/CoreSimulator/Devices"
    return sum(fsutil.tree(base / i).size for i in ids), False, {"devices": len(ids)}


def local_snapshots(ctx):
    out = fsutil.run(["tmutil", "listlocalsnapshots", "/"], timeout=30)
    count = len([line for line in (out or "").splitlines() if "com.apple.TimeMachine" in line])
    return (0, True, {"snapshots": count, "note": "APFS does not report snapshot size cheaply"}) if count else None
