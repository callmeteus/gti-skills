"""Levels, findings, and the preferences every run starts from."""

from __future__ import annotations

import hashlib
import unicodedata
from dataclasses import asdict, dataclass, field

LEVELS = ("safe", "aggressive", "yolo")

LEVEL_ALIASES = {
    "safe": "safe", "seguro": "safe", "segura": "safe", "seguridad": "safe",
    "aggressive": "aggressive", "agressivo": "aggressive", "agressiva": "aggressive", "agresivo": "aggressive",
    "yolo": "yolo", "nao-ligo": "yolo", "nao ligo": "yolo", "naoligo": "yolo", "dont-care": "yolo",
    "dont care": "yolo", "don't care": "yolo", "no me importa": "yolo", "all": "yolo",
}

# What a finding asks the cleaner to do.
DELETE = "delete"                # remove the listed paths
DELETE_CONTENTS = "delete_contents"  # empty the listed folders, keeping the folders (optionally only old entries)
COMMAND = "command"              # run a cleanup command that the tool owns (apt-get clean, docker image prune)
SETTING = "setting"              # change a system setting (journald size, hibernation, restore points)
UNINSTALL = "uninstall"          # remove a program
REPORT = "report"                # information only: large files, folders, things only the user can judge

FILE_ACTIONS = (DELETE, DELETE_CONTENTS)
SYSTEM_ACTIONS = (SETTING, UNINSTALL)

CATEGORIES = (
    "temp", "caches", "logs", "trash", "duplicates", "downloads", "dev", "packages", "system",
    "config", "programs", "large",
)

DEFAULT_PREFERENCES = {
    "level": "safe",
    "auto": False,
    "exclude": [],
    "temp_age_days": 2,
    "download_age_days": 30,
    "stale_project_days": 90,
    "stale_worktree_days": 30,
    "unused_program_days": 180,
    "min_duplicate_mb": 1,
    "large_file_mb": 500,
    "min_finding_mb": 1,
}


def normalize(text):
    text = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode("ascii")
    return " ".join(text.lower().replace("_", " ").split())


def parse_level(text):
    """Accepts English and Portuguese names: safe/seguro, aggressive/agressivo, yolo/nao ligo."""
    key = normalize(text)
    for candidate in (key, key.replace(" ", "-"), key.replace("-", " "), key.replace(" ", "")):
        if candidate in LEVEL_ALIASES:
            return LEVEL_ALIASES[candidate]
    raise ValueError(f"unknown level {text!r}: use safe, aggressive, or yolo (seguro, agressivo, nao ligo)")


def level_rank(level):
    return LEVELS.index(parse_level(level))


def within(level, selected):
    """True when a finding of `level` is part of a run at `selected`."""
    return level_rank(level) <= level_rank(selected)


@dataclass
class Finding:
    category: str
    title: str
    action: str
    level: str
    size: int = 0
    paths: list = field(default_factory=list)
    command: object = None          # argv list, or a string run through the shell when `shell` is true
    shell: bool = False
    manual: bool = False             # the command is an instruction for the user (a settings page), not a command line
    admin: bool = False              # needs root or an elevated prompt
    auto: bool = False               # allowed in automatic mode at its level (files and tool-owned cleanups only)
    estimate: bool = False           # size is an estimate, not a measurement
    reason: str = ""
    risk: str = ""
    restore: str = ""
    older_than_days: object = None   # delete_contents: only entries untouched for this many days
    keep: object = None              # duplicates: the copy that stays
    digest: object = None            # duplicates: content hash of the set
    drive: object = None
    details: dict = field(default_factory=dict)
    id: str = ""

    def __post_init__(self):
        if self.category not in CATEGORIES:
            raise ValueError(f"unknown category {self.category}")
        self.level = parse_level(self.level)
        if self.action in SYSTEM_ACTIONS or self.action == REPORT or self.manual:
            self.auto = False
        if not self.id:
            key = "|".join([self.category, self.action, self.title, *map(str, self.paths), str(self.command)])
            self.id = hashlib.sha1(key.encode("utf-8", "replace")).hexdigest()[:10]

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, data):
        known = {k: v for k, v in data.items() if k in cls.__dataclass_fields__}
        return cls(**known)


def human(size):
    size = float(size or 0)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if abs(size) < 1024 or unit == "TB":
            return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def parse_human(text):
    """'1.2GB', '512 MiB', '300M', '1.5 G' -> bytes. Returns 0 when unreadable."""
    import re
    match = re.search(r"([\d.,]+)\s*([kmgtp]?)(i?b?)", str(text).strip(), re.I)
    if not match:
        return 0
    digits = match.group(1)
    digits = digits.replace(",", "") if "." in digits else digits.replace(",", ".")
    try:
        number = float(digits)
    except ValueError:
        return 0
    unit = match.group(2).lower()
    power = " kmgtp".index(unit) if unit else 0
    return int(number * (1024 ** power))
