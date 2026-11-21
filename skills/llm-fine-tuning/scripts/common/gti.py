"""Where LLM Fine Tuning keeps generated files: ~/.gti/llm-fine-tuning, or GTI_HOME. Nothing goes into the user's repository."""

from __future__ import annotations

import os
import re
from datetime import datetime
from pathlib import Path

SKILL_ID = "llm-fine-tuning"


def gti_root():
    """~/.gti/llm-fine-tuning (GTI_HOME replaces ~/.gti)."""
    return Path(os.environ.get("GTI_HOME") or Path.home() / ".gti").expanduser() / SKILL_ID


def project_name(start=None):
    """The git root's folder name, or the current folder's."""
    here = Path(start or Path.cwd()).resolve()
    for folder in (here, *here.parents):
        if (folder / ".git").exists():
            return folder.name or "project"
    return here.name or "project"


def gti_dir(*parts):
    """Folder for generated files: ~/.gti/llm-fine-tuning/<project>/<parts>; created on first use."""
    folder = gti_root().joinpath(project_name(), *parts)
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def work_path(value, sub):
    """A bare name resolves to <work folder>/<sub>/<name>; anything with a folder is used as given."""
    p = Path(value).expanduser()
    if p.is_absolute() or len(p.parts) > 1:
        return p
    return gti_dir(sub) / p


def load_dotenv():
    """Load KEY=VALUE lines from ~/.gti/llm-fine-tuning/.env. Never overrides the shell."""
    env_file = gti_root() / ".env"
    if not env_file.is_file():
        return None
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    return env_file


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-") or "model"


def stamp():
    return datetime.now().strftime("%Y%m%d-%H%M%S")
