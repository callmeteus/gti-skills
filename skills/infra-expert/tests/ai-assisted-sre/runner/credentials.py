"""Extract exactly one model-provider credential for one agent run.

OpenCode keeps provider credentials in two places: a small ``auth.json`` in
its data directory and a credential table that ``opencode auth export``
includes. The ``opencode-go`` provider used by this suite lives in the second
place under the integration id ``opencode``. This module reads both and returns
a single-entry export document, which the container imports with
``opencode auth import``. It never returns or prints any other entry and never
writes a credential outside the run directory.
"""

from __future__ import annotations

import atexit
import json
import os
import signal
import subprocess
import time
from pathlib import Path
from typing import Any

# Provider ids in --model are not always the integration id OpenCode uses.
PROVIDER_ALIASES = {
    "opencode-go": ("opencode", "opencode-go"),
    "opencode": ("opencode",),
    "anthropic": ("anthropic",),
    "openai": ("openai",),
    "openrouter": ("openrouter",),
}


def provider_of(model: str) -> str:
    """Return the provider part of a ``provider/model`` string."""

    if "/" not in model:
        raise ValueError(f"model must be provider/model: {model}")
    return model.split("/", 1)[0]


def auth_file() -> Path:
    """Return the local OpenCode auth.json path."""

    override = os.environ.get("OPENCODE_AUTH_FILE")
    if override:
        return Path(override)
    return Path(os.environ.get("XDG_DATA_HOME", str(Path.home() / ".local" / "share"))) / "opencode" / "auth.json"


def _from_auth_json(provider: str, aliases: tuple[str, ...]) -> dict[str, Any] | None:
    file = auth_file()
    if not file.is_file():
        return None
    try:
        data = json.loads(file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    if not isinstance(data, dict):
        return None
    for name in (provider, *aliases):
        value = data.get(name)
        if isinstance(value, dict):
            return {
                "id": name,
                "integrationID": name,
                "label": name,
                "active": True,
                "value": value,
            }
    return None


def _from_export(provider: str, aliases: tuple[str, ...]) -> dict[str, Any] | None:
    """Ask OpenCode for its credential export and pick one entry."""

    try:
        completed = subprocess.run(
            ["opencode", "auth", "export"],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if completed.returncode != 0:
        return None
    try:
        entries = json.loads(completed.stdout)
    except json.JSONDecodeError:
        return None
    if not isinstance(entries, list):
        return None
    names = (provider, *aliases)
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        if entry.get("integrationID") in names or entry.get("id") in names:
            return entry
    return None


def extract(model: str) -> list[dict[str, Any]]:
    """Return a one-entry ``opencode auth import`` document for ``model``.

    Raises ``RuntimeError`` when no credential is available, so a run never
    proceeds with an empty or guessed credential file.
    """

    provider = provider_of(model)
    aliases = PROVIDER_ALIASES.get(provider, (provider,))
    entry = _from_auth_json(provider, aliases) or _from_export(provider, aliases)
    if entry is None:
        raise RuntimeError(
            f"no OpenCode credential for provider {provider}; "
            "log in with that provider before running the scenario"
        )
    return [entry]


def write(model: str, path: Path) -> Path:
    """Write the single-provider credential document to ``path`` with mode 600."""

    document = json.dumps(extract(model), ensure_ascii=False, sort_keys=True) + "\n"
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(document)
    os.chmod(path, 0o600)
    return path


def delete(path: Path) -> bool:
    """Delete one run credential; return whether a file was actually removed.

    Deletion is deliberately forgiving: it runs from ``atexit``, signal
    handlers and teardown, where a missing file or a race is normal.
    """

    path = Path(path)
    try:
        if path.is_file() or path.is_symlink():
            path.unlink()
            return True
    except OSError:
        pass
    return False


def sweep(root: Path, max_age_seconds: int = 7200) -> list[str]:
    """Delete ``runs/*/auth.json`` files older than two hours.

    A run whose SSH session dropped, whose host was killed, or whose process
    was aborted before its guard ran can leave a credential behind. This sweep
    runs at the start of every run as a second line of defence. It returns the
    paths it removed so the run can record them.
    """

    cutoff = time.time() - max_age_seconds
    removed: list[str] = []
    for auth in sorted(Path(root).glob("*/auth.json")):
        try:
            if auth.stat().st_mtime > cutoff:
                continue
        except OSError:
            continue
        if delete(auth):
            removed.append(str(auth))
    return removed


class CredentialGuard:
    """Remove one credential on normal exit, signal, or explicit close."""

    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self._previous: dict[int, Any] = {}
        self._closed = False
        # A per-guard callable lets unregister remove only this guard.
        self._atexit = lambda: delete(self.path)
        atexit.register(self._atexit)
        for number in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
            try:
                self._previous[number] = signal.getsignal(number)
                signal.signal(number, self._on_signal)
            except (ValueError, OSError):  # only the main thread may set handlers
                self._previous.pop(number, None)

    def _on_signal(self, number: int, _frame: Any) -> None:
        delete(self.path)
        raise SystemExit(128 + number)

    def close(self) -> None:
        """Delete the credential and restore the process's signal handlers."""

        if self._closed:
            return
        self._closed = True
        delete(self.path)
        atexit.unregister(self._atexit)
        for number, previous in self._previous.items():
            try:
                signal.signal(number, previous)
            except (ValueError, OSError):
                pass
        self._previous.clear()


def protect(path: Path) -> CredentialGuard:
    """Return a guard that deletes ``path`` however the run ends."""

    return CredentialGuard(path)
