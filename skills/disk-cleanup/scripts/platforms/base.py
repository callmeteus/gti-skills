"""What every operating system module provides, and the shared pieces they are built from."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from cleanup import fsutil
from cleanup.model import DEFAULT_PREFERENCES


@dataclass
class Target:
    """A known place that holds regenerable or disposable files: temp folders, caches, old logs."""

    category: str
    title: str
    patterns: tuple
    action: str = "delete_contents"
    level: str = "safe"
    older_than_days: object = None   # "temp" uses the temp_age_days preference
    admin: bool = False
    auto: bool = True
    reason: str = ""
    risk: str = ""
    restore: str = "Regenerated automatically by the program that uses it."


@dataclass
class Command:
    """A cleanup the owning tool does better than deleting files: apt-get clean, docker image prune."""

    category: str
    title: str
    argv: object                     # list, or a string run through the shell
    level: str = "safe"
    binary: str = ""                 # skip when this tool is not installed
    admin: bool = False
    auto: bool = True
    shell: bool = False
    measure: tuple = ()              # paths whose size estimates what the command frees
    probe: object = None             # callable(ctx) -> (size, estimate, details) or None to skip the finding
    on: str = ""                     # a path on the drive this command cleans (drive filter)
    reason: str = ""
    risk: str = ""
    restore: str = ""


@dataclass
class Context:
    level: str
    prefs: dict
    drives: list                     # every drive found
    selected: list                   # drives chosen for this run
    elevated: bool
    jobs: int
    notes: list = field(default_factory=list)
    home: Path = field(default_factory=Path.home)

    def pref(self, key):
        return self.prefs.get(key, DEFAULT_PREFERENCES.get(key))

    def drive_of(self, path):
        """The drive a path lives on: the longest mount point that contains it."""
        best, best_len = None, -1
        for drive in self.drives:
            for mount in drive.mountpoints or [drive.id]:
                if fsutil.is_under(path, mount) and len(mount) > best_len:
                    best, best_len = drive, len(mount)
        return best

    def on_selected(self, path):
        drive = self.drive_of(path)
        return drive is not None and any(drive is d for d in self.selected)

    def note(self, text):
        self.notes.append(text)


class Platform:
    name = "base"

    def __init__(self):
        self.home = Path.home()

    # Drives -------------------------------------------------------------------------------------
    def list_drives(self):
        raise NotImplementedError

    # Safety --------------------------------------------------------------------------------------
    def cloud_paths(self):
        """Folders synced with a cloud service: never scanned, never deleted. Deleting there deletes in the cloud."""
        return []

    def protected_paths(self):
        """Paths that may never be deleted as a whole: a deletion may not equal or contain one of them."""
        h = self.home
        user = [h, h / "Desktop", h / "Documents", h / "Downloads", h / "Pictures", h / "Music", h / "Videos",
                h / "Movies", h / "Public", h / "Templates"]
        return [str(p) for p in user]

    def denied_paths(self):
        """Subtrees where nothing is ever deleted: keys, credentials, wallets, password stores."""
        h = self.home
        names = [".ssh", ".gnupg", ".password-store", ".aws", ".azure", ".kube", ".docker/config.json",
                 ".config/gcloud", ".bitcoin", ".ethereum", ".electrum", ".local/share/keyrings", ".pki",
                 ".mozilla/firefox/profiles.ini"]
        return [str(h / n) for n in names] + self.cloud_paths()

    # Findings ------------------------------------------------------------------------------------
    def targets(self, ctx):
        return []

    def commands(self, ctx):
        return []

    def system_findings(self, ctx):
        return []

    def config_findings(self, ctx):
        return []

    def programs(self, ctx):
        return []

    def trash_targets(self, ctx):
        return []

    def skip_target(self, path):
        """True for a path a target pattern matched but that must stay (a cache that holds state)."""
        return False

    # Data walk ------------------------------------------------------------------------------------
    def downloads_dir(self):
        return self.home / "Downloads"

    def data_roots(self, ctx, drive):
        """Where duplicates, large files, and stale build folders are looked for on one drive."""
        if drive.system:
            return [str(self.home)] if ctx.on_selected(str(self.home)) else []
        return [drive.root]

    def walk_skip(self, ctx):
        """Folders the data walk never enters: system folders, cloud folders, other mounts."""
        skip = set(self.cloud_paths())
        for drive in ctx.drives:
            if not any(drive is d for d in ctx.selected) or drive.excluded:
                skip.update(drive.mountpoints)
        return {fsutil.norm(p) for p in skip if p}

    def appdata_names(self):
        """Folder names whose contents belong to programs, not to the user: never duplicate candidates."""
        return {"appdata", "library", "application data", "site-packages", "dist-packages"}


def env_path(name, default=""):
    value = os.environ.get(name)
    return Path(value) if value else (Path(default) if default else None)
