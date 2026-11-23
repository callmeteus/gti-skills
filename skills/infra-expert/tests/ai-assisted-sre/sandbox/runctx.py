"""The run context: one JSON document that describes a live scenario run.

The fake tools and the fault implementations read this document, so a fault
that changes a flag in it has an effect on the next tool call even when the two
run in different processes. Files that belong to guest hosts are mirrored
locally as well; the mirror is what the fake MCP reads, and the fixtures also
push the same bytes to the real guest through MiniStack.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import paths


def safe_name(value: str) -> str:
    """Turn a host name into a directory name without changing its identity."""

    return re.sub(r"[^A-Za-z0-9._-]", "_", value)


def run_slug(run_id: str) -> str:
    """Return the part of a run id used in AWS names (Docker-safe)."""

    return safe_name(run_id).strip("-_.") or "run"


@dataclass
class HostRecord:
    """One fake EC2 guest and the services it is supposed to run."""

    name: str  # logical name from the scenario, e.g. vm.prod.shop.acme.test
    ec2_name: str  # namespaced Name tag on the EC2 instance
    instance_id: str
    image: str
    tags: dict[str, str] = field(default_factory=dict)
    services: list[str] = field(default_factory=list)
    ip: str = ""
    hint: str = ""
    single_instance: bool = False
    meta: dict[str, Any] = field(default_factory=dict)

    def to_json(self) -> dict[str, Any]:
        """Return the JSON representation stored in context.json."""

        return {
            "name": self.name,
            "ec2_name": self.ec2_name,
            "instance_id": self.instance_id,
            "image": self.image,
            "tags": self.tags,
            "services": self.services,
            "ip": self.ip,
            "hint": self.hint,
            "single_instance": self.single_instance,
            "meta": self.meta,
        }

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> "HostRecord":
        """Build a record from the JSON representation."""

        return cls(
            name=data["name"],
            ec2_name=data.get("ec2_name", data["name"]),
            instance_id=data.get("instance_id", ""),
            image=data.get("image", ""),
            tags=dict(data.get("tags") or {}),
            services=list(data.get("services") or []),
            ip=data.get("ip", ""),
            hint=data.get("hint", ""),
            single_instance=bool(data.get("single_instance", False)),
            meta=dict(data.get("meta") or {}),
        )


@dataclass
class RunContext:
    """Mutable state of one run, persisted as JSON after every change."""

    run_id: str
    root: Path
    hosts: dict[str, HostRecord] = field(default_factory=dict)
    instance_ids: list[str] = field(default_factory=list)
    ami_ids: list[str] = field(default_factory=list)
    flags: dict[str, Any] = field(default_factory=dict)
    meta: dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)

    @classmethod
    def load(cls, run_id: str | None = None, root: Path | None = None) -> "RunContext":
        """Load a context, or start a new one when the file does not exist."""

        rid = run_id or paths.current_run_id()
        base = Path(root) if root else paths.run_dir(rid)
        file = base / "context.json"
        if not file.exists():
            return cls(run_id=rid, root=base)
        with file.open(encoding="utf-8") as handle:
            data = json.load(handle)
        return cls(
            run_id=rid,
            root=base,
            hosts={name: HostRecord.from_json(row) for name, row in (data.get("hosts") or {}).items()},
            instance_ids=list(data.get("instance_ids") or []),
            ami_ids=list(data.get("ami_ids") or []),
            flags=dict(data.get("flags") or {}),
            meta=dict(data.get("meta") or {}),
            created_at=float(data.get("created_at", time.time())),
        )

    def save(self) -> None:
        """Write the context atomically so a reader never sees a partial file."""

        self.root.mkdir(parents=True, exist_ok=True)
        data = {
            "run_id": self.run_id,
            "hosts": {name: row.to_json() for name, row in self.hosts.items()},
            "instance_ids": self.instance_ids,
            "ami_ids": self.ami_ids,
            "flags": self.flags,
            "meta": self.meta,
            "created_at": self.created_at,
        }
        target = self.root / "context.json"
        fd, tmp = tempfile.mkstemp(dir=str(self.root), prefix=".context-", suffix=".json")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(data, handle, indent=2, sort_keys=True)
                handle.write("\n")
            os.replace(tmp, target)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)

    def add_host(self, host: HostRecord) -> None:
        """Register a host and persist the context."""

        self.hosts[host.name] = host
        self.save()

    def flag(self, name: str, value: Any = None) -> Any:
        """Read a fault flag, or set it when a value is given."""

        if value is None:
            return self.flags.get(name)
        self.flags[name] = value
        self.save()
        return value

    def host(self, name: str) -> HostRecord | None:
        """Resolve a host by logical name or by its namespaced EC2 name."""

        if name in self.hosts:
            return self.hosts[name]
        for row in self.hosts.values():
            if row.ec2_name == name:
                return row
        return None

    def all_host_rows(self) -> list[dict[str, str]]:
        """Return the rows returned by the fake prod_list_hosts tool."""

        rows = []
        for row in self.hosts.values():
            item = {"host": row.name, "label": row.image, "hint": row.hint}
            rows.append({k: v for k, v in item.items() if v})
        return rows
