"""Where GTI skills keep generated files: ~/.gti, or GTI_HOME. Nothing goes into the user's repository."""

from __future__ import annotations

import os
from pathlib import Path


def gti_dir(skill, *parts):
    """Folder for generated files: ~/.gti/<skill>/... (GTI_HOME replaces ~/.gti). Never the user's repository."""
    base = Path(os.environ.get("GTI_HOME") or Path.home() / ".gti").expanduser()
    folder = base.joinpath(skill, *parts)
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def project_name(start=None):
    """Name of the project being worked on: the git root's folder name, or the current folder's."""
    here = Path(start or Path.cwd()).resolve()
    for folder in (here, *here.parents):
        if (folder / ".git").exists():
            return folder.name or "project"
    return here.name or "project"
