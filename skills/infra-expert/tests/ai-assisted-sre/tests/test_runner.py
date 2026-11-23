"""Runner helpers: followups, credentials, report format and validation."""

from __future__ import annotations

import json
import os
import signal
import stat
import time

from runner import credentials, report, scenarios
from runner.agent import read_events, turn_text


def test_followup_matching():
    from runner.engine import _match_followup

    assert _match_followup({"when": {"assistant_matches": "nao sei"}}, "Nao sei se tem docker", 1)
    assert not _match_followup({"when": {"assistant_matches": "gateway"}}, "Nao sei", 1)
    assert _match_followup({"when": {"after_turns": 2}}, "qualquer", 3)
    assert not _match_followup({"when": {"after_turns": 5}}, "qualquer", 3)


def test_turn_text_from_events(tmp_path):
    file = tmp_path / "events.jsonl"
    file.write_text(
        json.dumps({"type": "step_start", "sessionID": "ses_1"}) + "\n"
        + json.dumps({"type": "text", "part": {"type": "text", "text": "primeira"}}) + "\n"
        + json.dumps({"type": "text", "part": {"type": "text", "text": "segunda"}}) + "\n",
        encoding="utf-8",
    )
    assert read_events(file)[0]["sessionID"] == "ses_1"
    assert turn_text(read_events(file)) == "primeira\nsegunda"


def test_credential_extractor_reads_only_one_provider(tmp_path, monkeypatch):
    auth = tmp_path / "auth.json"
    auth.write_text(json.dumps({
        "local-server": {"type": "api", "key": "server-secret"},
        "opencode": {"type": "oauth", "access": "console-secret"},
    }), encoding="utf-8")
    monkeypatch.setattr(credentials, "auth_file", lambda: auth)
    document = credentials.extract("opencode-go/hy4-flash-free")
    assert len(document) == 1
    assert document[0]["integrationID"] == "opencode"
    assert "server-secret" not in json.dumps(document)
    target = tmp_path / "run" / "auth.json"
    credentials.write("opencode-go/hy4-flash-free", target)
    assert stat.S_IMODE(target.stat().st_mode) == 0o600
    written = json.loads(target.read_text(encoding="utf-8"))
    assert len(written) == 1
    assert "server-secret" not in target.read_text(encoding="utf-8")


def test_credential_extractor_export_fallback(tmp_path, monkeypatch):
    monkeypatch.setattr(credentials, "auth_file", lambda: tmp_path / "missing.json")

    class Done:
        returncode = 0
        stdout = json.dumps([
            {"id": "other", "integrationID": "other", "value": {"key": "x"}},
            {"id": "cred_1", "integrationID": "opencode", "value": {"access": "y"}},
        ])
        stderr = ""

    monkeypatch.setattr(credentials.subprocess, "run", lambda *a, **k: Done())
    document = credentials.extract("opencode-go/hy4-flash-free")
    assert len(document) == 1
    assert document[0]["id"] == "cred_1"


def test_credential_delete_is_forgiving(tmp_path):
    auth = tmp_path / "auth.json"
    auth.write_text("x", encoding="utf-8")
    assert credentials.delete(auth)
    assert not auth.exists()
    assert not credentials.delete(auth)


def test_sweep_removes_only_old_credentials(tmp_path):
    old = tmp_path / "old-run" / "auth.json"
    fresh = tmp_path / "new-run" / "auth.json"
    for path in (old, fresh):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("secret", encoding="utf-8")
    old_time = time.time() - 3 * 3600
    os.utime(old, (old_time, old_time))
    removed = credentials.sweep(tmp_path)
    assert removed == [str(old)]
    assert not old.exists()
    assert fresh.exists()
    assert credentials.sweep(tmp_path) == []


def test_guard_deletes_on_close_and_on_abort(tmp_path):
    auth = tmp_path / "auth.json"
    auth.write_text("secret", encoding="utf-8")
    guard = credentials.protect(auth)
    guard.close()
    assert not auth.exists()

    auth.write_text("secret", encoding="utf-8")
    guard = credentials.protect(auth)
    try:
        guard._on_signal(signal.SIGTERM, None)
    except SystemExit as exc:
        assert exc.code == 128 + signal.SIGTERM
    else:  # pragma: no cover - the handler always raises
        raise AssertionError("signal handler did not abort")
    assert not auth.exists()
    guard.close()


def test_report_format(tmp_path):
    result = {
        "run_id": "s00-20260101-000000", "scenario_id": "s00-test",
        "scenario": {"title": "Test", "mode": "operate", "budget": {"max_turns": 2}},
        "model": "opencode-go/hy4-flash-free", "judge_model": "opencode-go/hy4-flash-free",
        "verdict": "FAIL", "started": "now", "finished": "later", "turns": 2, "duration_s": 1.0,
        "checks": [
            {"name": "state[0]:host_file_contains", "kind": "host_file_contains", "passed": True, "detail": "ok"},
            {"name": "transcript_forbid[0]", "kind": "forbid:all", "passed": False, "detail": "found"},
        ],
        "judge": [{"bullet": 1, "text": "- PASS if x", "pass": True, "reason": "yes"}],
    }
    path = report.write_report(tmp_path / "run", result)
    text = path.read_text(encoding="utf-8")
    assert "# AI-assisted SRE run: s00-20260101-000000" in text
    assert "**FAIL**" in text
    assert "| 1 | state[0]:host_file_contains" in text
    assert "| PASS |" in text and "| FAIL |" in text
    assert (tmp_path / "run" / "result.json").is_file()


def test_validate_all():
    results = scenarios.validate_all()
    assert len(results) >= 30
    assert all(not problems for problems in results.values()), results
