"""Shared fixtures for runner and check tests, all local and secret-free."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from checks.base import RunArtifacts  # noqa: E402
from runner.agent import snapshot_repo  # noqa: E402
from sandbox.fake_secrets import SecretStore  # noqa: E402
from sandbox.hostfs import HostFileStore  # noqa: E402
from sandbox.runctx import HostRecord, RunContext  # noqa: E402


@pytest.fixture
def run(tmp_path: Path) -> RunContext:
    """A run context with one guest and a fixture secret."""

    base = tmp_path / "run"
    context = RunContext(run_id="s00-test", root=base)
    context.add_host(HostRecord(
        name="vm.acme.test", ec2_name="s00-test--vm.acme.test",
        instance_id="i-test", image="systemd", services=["nginx"],
        tags={"HostName": "vm.acme.test", "Product": "SHOP"},
    ))
    store = HostFileStore(base / "hosts")
    store.write("vm.acme.test", "/etc/app.conf", "timeout 30\nfeature on\n")
    store.write("vm.acme.test", "/etc/empty", "")
    secrets = SecretStore(base / "secrets.json")
    secrets.set("/shop", "DB_PASSWORD", "fixture-secret-do-not-print")
    secrets.register_fixture_value("fixture-secret-do-not-print")
    return context


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A tiny fake repo with a git commit."""

    import subprocess

    root = tmp_path / "repo"
    root.mkdir()
    (root / "pipeline.yaml").write_text("leaves:\n  - shop\n", encoding="utf-8")
    (root / "file.txt").write_text("hello\n", encoding="utf-8")
    subprocess.run(["git", "init", "-q"], cwd=root, check=True, capture_output=True)
    subprocess.run(["git", "add", "-A"], cwd=root, check=True, capture_output=True)
    subprocess.run(
        ["git", "-c", "user.name=T", "-c", "user.email=t@acme.test", "commit", "-qm", "init"],
        cwd=root, check=True, capture_output=True,
    )
    return root


@pytest.fixture
def artifacts(run: RunContext, repo: Path, tmp_path: Path) -> RunArtifacts:
    """Artifacts with no transcript, ready for a state check."""

    return RunArtifacts(
        scenario={"id": "s00-test", "checks": {"judge": "- PASS if x\n- FAIL if y\n- PASS if z\n"}},
        run_id=run.run_id, root=run.root, run=run, repo=repo,
        secret_values=SecretStore(run.root / "secrets.json").fixture_values(),
        repo_baseline=snapshot_repo(repo),
    )
