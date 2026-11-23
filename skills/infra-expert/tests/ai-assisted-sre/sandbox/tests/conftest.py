"""Shared pytest fixtures for the sandbox tests."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sandbox.fake_secrets import SecretStore
from sandbox.runctx import HostRecord, RunContext


@pytest.fixture
def run(tmp_path: Path) -> RunContext:
    """A run with one guest and one fixture secret, without any real host."""

    base = tmp_path / "run"
    context = RunContext(run_id="s01-test", root=base)
    context.add_host(HostRecord(
        name="vm.prod.shop.acme.test",
        ec2_name="s01-test--vm.prod.shop.acme.test",
        instance_id="i-test0001",
        image="nginx",
        tags={"Name": "s01-test--vm.prod.shop.acme.test", "RunId": "s01-test"},
        services=["nginx"],
        ip="172.31.5.10",
    ))
    store = SecretStore(base / "secrets.json")
    store.set("/shop", "DB_PASSWORD", "fixture-value-123")
    store.register_fixture_value("fixture-value-123")
    from sandbox.hostfs import HostFileStore

    HostFileStore(base / "hosts").write(
        "vm.prod.shop.acme.test",
        "/etc/nginx/conf.d/app.conf",
        "server { listen 80; }\n",
    )
    return context
