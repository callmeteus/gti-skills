"""Where Disk Cleanup keeps generated files: ~/.gti/disk-cleanup, or GTI_HOME. Nothing goes into a repository."""

from __future__ import annotations

import json
import os
import platform
import re
from datetime import datetime
from pathlib import Path

SKILL_ID = "disk-cleanup"


def gti_dir(*parts, create=True):
    """Folder for generated files: ~/.gti/disk-cleanup/... (GTI_HOME replaces ~/.gti)."""
    base = Path(os.environ.get("GTI_HOME") or Path.home() / ".gti").expanduser()
    folder = base.joinpath(SKILL_ID, *parts)
    if create:
        folder.mkdir(parents=True, exist_ok=True)
    return folder


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-") or "machine"


def machine_name():
    """The machine's host name as a folder name: scans are per machine, not per repository."""
    return slug(platform.node() or "machine")


def stamp():
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    os.replace(tmp, path)


def read_json(path, default=None):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default
