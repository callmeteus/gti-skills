"""Where SEO Growth keeps generated files: ~/.gti/seo-growth, or GTI_HOME. Nothing goes into the user's repository."""

from __future__ import annotations

import os
import re
from datetime import datetime
from pathlib import Path

SKILL_ID = "seo-growth"


def gti_dir(*parts):
    """Folder for generated files: ~/.gti/seo-growth/... (GTI_HOME replaces ~/.gti)."""
    base = Path(os.environ.get("GTI_HOME") or Path.home() / ".gti").expanduser()
    folder = base.joinpath(SKILL_ID, *parts)
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def project_name(start=None):
    """The git root's folder name, or the current folder's."""
    here = Path(start or Path.cwd()).resolve()
    for folder in (here, *here.parents):
        if (folder / ".git").exists():
            return folder.name or "project"
    return here.name or "project"


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-") or "site"


def stamp():
    return datetime.now().strftime("%Y%m%d-%H%M%S")
