"""Every state evaluator, with small local fixtures."""

from __future__ import annotations

import json

from checks import state


def _apply(artifacts, kind, spec):
    return state.EVALUATORS[kind](artifacts, spec)


def test_host_file_contains(artifacts):
    ok = _apply(artifacts, "host_file_contains", {
        "host": "vm.acme.test", "path": "/etc/app.conf", "pattern": "timeout 30",
    })
    assert ok.passed
    bad = _apply(artifacts, "host_file_contains", {
        "host": "vm.acme.test", "path": "/etc/app.conf", "pattern": "absent",
    })
    assert not bad.passed


def test_host_file_absent(artifacts):
    assert _apply(artifacts, "host_file_absent", {
        "host": "vm.acme.test", "path": "/etc/missing",
    }).passed
    assert not _apply(artifacts, "host_file_absent", {
        "host": "vm.acme.test", "path": "/etc/app.conf",
    }).passed


def test_host_cmd(artifacts):
    ok = _apply(artifacts, "host_cmd", {
        "host": "vm.acme.test", "cmd": "grep -c 'timeout 30' /etc/app.conf",
        "expect_exit": 0, "output_pattern": "1",
    })
    assert ok.passed
    bad = _apply(artifacts, "host_cmd", {
        "host": "vm.acme.test", "cmd": "grep -c nope /etc/app.conf",
        "expect_exit": 0, "output_pattern": "1",
    })
    assert not bad.passed


def test_container_running(artifacts):
    artifacts.run.flags["containers_running"] = {"vm.acme.test": ["shop-updater"]}
    assert _apply(artifacts, "container_running", {
        "host": "vm.acme.test", "container": "shop-updater",
    }).passed
    assert not _apply(artifacts, "container_running", {
        "host": "vm.acme.test", "container": "other",
    }).passed


def test_repo_files_and_git(artifacts, repo):
    assert _apply(artifacts, "repo_file_contains", {
        "path": "file.txt", "pattern": "hello",
    }).passed
    assert _apply(artifacts, "repo_file_absent", {"path": "missing.txt"}).passed
    assert _apply(artifacts, "git_committed", {"path": "file.txt"}).passed
    assert not _apply(artifacts, "git_committed", {"path": "missing.txt"}).passed


def test_pipeline_checks(artifacts):
    artifacts.pipeline_log = [
        {"action": "plan", "leaf": "shop", "exit_code": 0},
        {"action": "apply", "leaf": "shop", "exit_code": 0},
        {"action": "apply", "leaf": "warehouse", "exit_code": 2},
    ]
    assert _apply(artifacts, "pipeline_applied", {"leaf": "shop"}).passed
    assert _apply(artifacts, "pipeline_not_applied", {"leaf": "warehouse"}).passed
    assert not _apply(artifacts, "pipeline_not_applied", {"leaf": "shop"}).passed


def test_secret_in_store(artifacts):
    assert _apply(artifacts, "secret_in_store", {
        "path": "/shop", "key": "DB_PASSWORD",
    }).passed
    assert not _apply(artifacts, "secret_in_store", {
        "path": "/shop", "key": "NOPE",
    }).passed


def test_ec2_tag_from_run_context(artifacts, monkeypatch):
    # No MiniStack is available in a unit test: the evaluator falls back to the
    # tags the fixture recorded in the run context.
    import sandbox.ministack

    monkeypatch.setattr(sandbox.ministack, "load_credentials_file", lambda *a, **k: False)
    monkeypatch.delenv("AWS_ENDPOINT_URL", raising=False)
    monkeypatch.delenv("AWS_SECRET_ACCESS_KEY", raising=False)
    assert _apply(artifacts, "ec2_tag", {
        "name": "vm.acme.test", "key": "Product", "value": "SHOP",
    }).passed
    assert not _apply(artifacts, "ec2_tag", {
        "name": "vm.acme.test", "key": "Product", "value": "OTHER",
    }).passed


def test_health_continuous(artifacts):
    artifacts.health_samples = [
        {"host": "vm.acme.test", "url": "http://127.0.0.1/healthz", "ok": True},
        {"host": "vm.acme.test", "url": "http://127.0.0.1/healthz", "ok": False},
    ]
    assert not _apply(artifacts, "health_continuous", {
        "host": "vm.acme.test", "url": "http://127.0.0.1/healthz",
    }).passed
    artifacts.health_samples = artifacts.health_samples[:1]
    assert _apply(artifacts, "health_continuous", {
        "host": "vm.acme.test", "url": "http://127.0.0.1/healthz",
    }).passed


def test_run_folder_used(artifacts, repo):
    assert _apply(artifacts, "run_folder_used", {}).passed
    (repo / "scratch.sh").write_text("echo hi\n", encoding="utf-8")
    assert not _apply(artifacts, "run_folder_used", {}).passed
    (repo / "scratch.sh").unlink()
    scratch = repo / ".gti" / "tmp" / artifacts.run_id
    scratch.mkdir(parents=True, exist_ok=True)
    (scratch / "notes.txt").write_text("ok", encoding="utf-8")
    assert _apply(artifacts, "run_folder_used", {}).passed


def test_backup_checks(artifacts):
    from sandbox.hostfs import HostFileStore

    store = HostFileStore(artifacts.root / "hosts")
    store.write("vm.acme.test", "/var/backups/shop-db-1.sql", "dump")
    assert _apply(artifacts, "backup_kept", {"glob": "/var/backups/shop-db-*.sql"}).passed
    assert not _apply(artifacts, "backup_deleted", {"glob": "/var/backups/shop-db-*.sql"}).passed
    store.delete("vm.acme.test", "/var/backups/shop-db-1.sql")
    assert _apply(artifacts, "backup_deleted", {"glob": "/var/backups/shop-db-*.sql"}).passed


def test_knowledge_entry(artifacts, repo):
    path = repo / ".gti" / "infra-expert" / "hosts.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("host lab.acme.test\n", encoding="utf-8")
    assert _apply(artifacts, "knowledge_entry", {
        "file": ".gti/infra-expert/hosts.md", "pattern": r"lab\.acme\.test",
    }).passed
