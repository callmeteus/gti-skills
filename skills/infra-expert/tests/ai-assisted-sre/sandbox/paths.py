"""File locations shared by the sandbox processes.

The runner, the fake MCP and the fake pipeline are separate processes. They
agree on a run id and a root directory through environment variables, so no
in-process state has to survive between them. No secret is read from here.
"""

from __future__ import annotations

import os
from pathlib import Path

ENV_RUN_ID = "ACME_SANDBOX_RUN_ID"
ENV_ROOT = "ACME_SANDBOX_ROOT"
ENV_REPO = "ACME_SANDBOX_REPO"
ENV_SECRETS = "ACME_SANDBOX_SECRETS_FILE"

SANDBOX_ROOT = Path(__file__).resolve().parent


def sandbox_root() -> Path:
    """Return the root of this sandbox package."""

    return Path(os.environ.get(ENV_ROOT, str(SANDBOX_ROOT))).resolve()


def current_run_id(default: str = "local") -> str:
    """Return the run id exported by the runner."""

    return os.environ.get(ENV_RUN_ID, default)


def run_dir(run_id: str | None = None) -> Path:
    """Return the directory that holds all state for one scenario run."""

    return sandbox_root() / "runs" / (run_id or current_run_id())


def repo_root() -> Path:
    """Return the fake ACME repository the agent works in.

    Inside the agent container the current directory is the cloned repo, so it
    wins over the template; a runner can force a path with ACME_SANDBOX_REPO.
    """

    override = os.environ.get(ENV_REPO)
    if override:
        return Path(override).resolve()
    here = Path.cwd()
    if (here / "pipeline.yaml").is_file():
        return here
    return (sandbox_root() / "repo-templates" / "base").resolve()


def context_file(run_id: str | None = None) -> Path:
    """Return the JSON file with hosts, flags and metadata for a run."""

    return run_dir(run_id) / "context.json"


def mcp_log(run_id: str | None = None) -> Path:
    """Return the JSONL file every fake MCP call is written to."""

    return run_dir(run_id) / "mcp.jsonl"


def pipeline_log(run_id: str | None = None) -> Path:
    """Return the JSONL file every fake pipeline run is written to."""

    return run_dir(run_id) / "pipeline.jsonl"


def secrets_file(run_id: str | None = None) -> Path:
    """Return the file-backed fake secret store for a run."""

    override = os.environ.get(ENV_SECRETS)
    if override:
        return Path(override)
    return run_dir(run_id) / "secrets.json"


def host_files_root(run_id: str | None = None) -> Path:
    """Return the local mirror of every guest filesystem in a run."""

    return run_dir(run_id) / "hosts"
