"""Paths and constants shared by the runner, the checks and the report."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
SCENARIOS_DIR = PACKAGE_ROOT / "scenarios"
SANDBOX_DIR = PACKAGE_ROOT / "sandbox"
DEFAULT_TEMPLATE = SANDBOX_DIR / "repo-templates" / "base"

# SSH target of the notebook that runs MiniStack, for example ubuntu@host.
NOTEBOOK = os.environ.get("AI_SRE_NOTEBOOK", "")
NOTEBOOK_PACKAGE = Path("/data/ai-assisted-sre")
NOTEBOOK_RUNS = NOTEBOOK_PACKAGE / "runs"
CONTAINER_IMAGE = "ai-sre-sandbox-agent"
CONTAINER_NETWORK = "ai-sre-sandbox"
# ACME_SANDBOX_ROOT is the *package* root; paths.run_dir() appends "runs".
CONTAINER_ROOT = "/opt/ai-sre-sandbox"
CONTAINER_MOUNT = "/opt/ai-sre-sandbox/runs"
CONTAINER_AUTH = "/auth/provider-auth.json"
CONTAINER_REPO = "/work/acme-infra"


def operator_dir() -> Path:
    """Return the operator folder: ~/.gti/infra-expert/scenarios, or under GTI_HOME.

    It holds the MiniStack credentials file, the vendored Python dependencies
    and the fetched results. Nothing here goes into the repository.
    """

    base = Path(os.environ.get("GTI_HOME") or Path.home() / ".gti").expanduser()
    return base / "infra-expert" / "scenarios"


def runs_root() -> Path:
    """Return the directory that holds all local and notebook run artifacts."""

    override = os.environ.get("AI_SRE_RUNS_ROOT")
    if override:
        return Path(override).resolve()
    return Path(os.environ.get("ACME_SANDBOX_ROOT", str(PACKAGE_ROOT / "runs"))).resolve()


def run_dir(run_id: str) -> Path:
    """Return the directory for one run."""

    return runs_root() / run_id


def results_dir(stamp: str, scenario: str) -> Path:
    """Return the local folder where a remote run's artifacts are copied."""

    return operator_dir() / "results" / f"{stamp}-ai-sre-{scenario}"


def stamp() -> str:
    """Return the UTC timestamp used in run and result folder names."""

    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


def claude_style_run_id(scenario_id: str, when: str | None = None) -> str:
    """Build a unique, filesystem-safe run id."""

    return f"{scenario_id}-{when or stamp()}"
