"""Remote orchestration: detached start, status, fetch and cleanup commands.

No test opens a socket. SSH, rsync and time are replaced with local fakes.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest

from runner import remote


class Done:
    """A stand-in for subprocess.CompletedProcess."""

    def __init__(self, stdout: str = "", returncode: int = 0, stderr: str = "") -> None:
        self.stdout = stdout
        self.stderr = stderr
        self.returncode = returncode


def test_strip_wait_options() -> None:
    kept, wait, timeout = remote._strip_wait_options(
        ["run", "s07-keep-stderr", "--model", "p/m", "--wait", "--wait-timeout", "99"]
    )
    assert kept == ["run", "s07-keep-stderr", "--model", "p/m"]
    assert wait and timeout == 99
    kept, wait, timeout = remote._strip_wait_options(["run", "x", "--wait-timeout=12"])
    assert kept == ["run", "x"] and timeout == 12 and not wait


def test_detached_command_returns_immediately(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(remote, "_env_prefix", lambda: "")
    command = remote._detached_command(
        ["run", "s07-keep-stderr", "--run-id", "r1"], Path("/runs/r1")
    )
    assert "nohup python3 -m runner.cli run s07-keep-stderr --run-id r1" in command
    assert "/runs/r1/runner.pid" in command
    assert "/runs/r1/remote.log" in command
    assert command.rstrip().endswith('echo "$pid"')
    assert "--wait" not in command
    assert "nohup" in command and "&" in command


def test_status_reads_document(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    monkeypatch.setattr(remote, "_ssh", lambda *a, **k: Done(
        json.dumps({"state": "finished", "verdict": "PASS", "scenario_id": "s07-keep-stderr"})
    ))
    assert remote.cmd_status("r1") == 0
    text = capsys.readouterr().out
    assert "STATE: finished" in text and "VERDICT: PASS" in text


def test_status_falls_back_to_pid(monkeypatch: pytest.MonkeyPatch) -> None:
    answers = iter([Done(""), Done("4242\n"), Done("alive")])
    monkeypatch.setattr(remote, "_ssh", lambda *a, **k: next(answers))
    assert remote._status_of("r1")["state"] == "running"


def test_fetch_refuses_unfinished_run(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    monkeypatch.setattr(remote, "_status_of", lambda _rid: {"state": "running"})
    monkeypatch.setattr(remote, "_rsync", lambda *a, **k: pytest.fail("must not copy"))
    assert remote.cmd_fetch("r1") == 1
    assert "not finished" in capsys.readouterr().out


def test_fetch_copies_finished_run_without_credential(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    calls: list[tuple[str, str, tuple[str, ...]]] = []

    def fake_rsync(source: str, target: str, exclude: tuple[str, ...] = ()) -> Done:
        calls.append((source, target, exclude))
        folder = Path(target)
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "result.json").write_text(json.dumps({"verdict": "PASS", "checks": []}), encoding="utf-8")
        return Done()

    monkeypatch.setattr(remote, "_status_of", lambda _rid: {
        "state": "finished", "run_id": "r1", "scenario_id": "s07-keep-stderr", "verdict": "PASS",
    })
    monkeypatch.setattr(remote, "_rsync", fake_rsync)
    monkeypatch.setattr(remote.config, "results_dir", lambda stamp, scenario: tmp_path / f"{stamp}-{scenario}")
    assert remote.cmd_fetch("r1") == 0
    assert calls[0][2] == ("auth.json",)
    assert "VERDICT: PASS" in capsys.readouterr().out


def test_remote_run_starts_detached(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    seen: list[str] = []

    def fake_ssh(*command: str, stdin: str | None = None, timeout: int = 300) -> Done:
        seen.append(command[-1])
        return Done(stdout="4242\n")

    monkeypatch.setattr(remote.config, "NOTEBOOK", "ubuntu@notebook.acme.test")
    monkeypatch.setattr(remote, "sync_package", lambda: (True, ""))
    monkeypatch.setattr(remote, "_ssh", fake_ssh)
    monkeypatch.setattr(remote.credentials, "extract", lambda _m: [{"id": "opencode", "value": {}}])
    monkeypatch.setattr(remote, "_wait_for", lambda _rid, _t: {"state": "finished"})
    monkeypatch.setattr(remote, "cmd_fetch", lambda _rid: 0)
    assert remote.remote([
        "run", "s07-keep-stderr", "--model", "opencode-go/hy4-flash-free",
        "--wait", "--wait-timeout", "5",
    ]) == 0
    out = capsys.readouterr().out
    assert "RUN: s07-keep-stderr-" in out
    assert "remote status" in out and "remote fetch" in out
    detached = next(command for command in seen if "nohup" in command)
    assert "--wait" not in detached and "--wait-timeout" not in detached
    assert "--run-id" in detached


def test_remote_refuses_without_notebook(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    monkeypatch.setattr(remote.config, "NOTEBOOK", "")
    monkeypatch.setattr(remote, "sync_package", lambda: pytest.fail("must not sync without a notebook"))
    assert remote.remote(["status", "r1"]) == 2
    assert "AI_SRE_NOTEBOOK" in capsys.readouterr().out


def test_ministack_env_file_defaults_to_gti_home(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.delenv("AI_SRE_MINISTACK_ENV", raising=False)
    monkeypatch.setenv("GTI_HOME", str(tmp_path))
    assert remote.ministack_env_file() == tmp_path / "infra-expert" / "scenarios" / "ministack.env"
    monkeypatch.setenv("AI_SRE_MINISTACK_ENV", str(tmp_path / "other.env"))
    assert remote.ministack_env_file() == tmp_path / "other.env"


def test_vendor_dir_defaults_to_gti_home(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.delenv("AI_SRE_VENDOR_DIR", raising=False)
    monkeypatch.setenv("GTI_HOME", str(tmp_path))
    assert remote.vendor_dir() == tmp_path / "infra-expert" / "scenarios" / "vendor"
    monkeypatch.setenv("AI_SRE_VENDOR_DIR", str(tmp_path / "deps"))
    assert remote.vendor_dir() == tmp_path / "deps"


def test_wait_for_stops_on_finished(monkeypatch: pytest.MonkeyPatch) -> None:
    states = iter([{"state": "running"}, {"state": "finished", "verdict": "PASS"}])
    monkeypatch.setattr(remote, "_status_of", lambda _rid: next(states))
    sleeps: list[int] = []
    monkeypatch.setattr(remote.time, "sleep", lambda seconds: sleeps.append(seconds))
    result = remote._wait_for("r1", 120)
    assert result["verdict"] == "PASS"
    assert sleeps == [30]


def test_cleanup_command_targets_one_or_all_runs(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: list[str] = []
    monkeypatch.setattr(remote, "_env_prefix", lambda: "")
    monkeypatch.setattr(remote, "_ssh", lambda *a, **k: (seen.append(a[-1]), Done("ok"))[1])
    assert remote.cmd_cleanup("r1") == 0
    assert "cleanup r1" in seen[-1]
    assert remote.cmd_cleanup(None) == 0
    assert "cleanup" in seen[-1] and "cleanup r1" not in seen[-1]
