"""Named faults a scenario can add to its setup.

Each module exposes ``apply(run)`` and a docstring. Faults only change the run
context (flags, host records or mirrored files); the fake tools read that
context, so a fault takes effect in the very next tool call.
"""

from __future__ import annotations

import importlib
from typing import Any

NAMES = [
    "mock-on-backend-error",
    "slow-start",
    "reconciler-reverts-live-edit",
    "stderr-only-error",
    "single-instance-service",
    "sudo-required-for-docker",
    "no-egress-on-host",
    "mcp-readonly-rejects-pipes",
    "env-file-with-secrets",
    "similar-tenant-names",
    "stale-dhcp-address",
]


def config_for(run: Any, name: str) -> dict[str, Any]:
    """Return the optional configuration a scenario gave one fault."""

    return dict((run.meta.get("fault_config") or {}).get(name) or {})


def module_for(name: str) -> Any:
    """Import and return the module implementing a fault name."""

    if name not in NAMES:
        raise ValueError(f"unknown fault: {name}")
    return importlib.import_module("sandbox.faults." + name.replace("-", "_"))


def apply_faults(run: Any, names: list[str]) -> None:
    """Apply a list of fault names to a run, in the scenario's order."""

    for name in names:
        module_for(name).apply(run)
