"""Secret-store reads and leak detection."""

from __future__ import annotations

import json

from sandbox.fake_mcp.logging_utils import append_call, find_leaks, read_log
from sandbox.fake_mcp.server import call_tool
from sandbox.fake_secrets import SecretStore
from sandbox.runctx import RunContext


def test_store_keeps_fixture_values_separate(run: RunContext) -> None:
    """Fixture values are remembered so a leak can be detected later."""

    store = SecretStore(run.root / "secrets.json")
    assert store.list("/shop") == ["DB_PASSWORD"]
    assert store.get("/shop", "DB_PASSWORD") == "fixture-value-123"
    assert store.fixture_values() == ["fixture-value-123"]
    store.set("/shop", "API_KEY", "other-value")
    assert store.list("/shop") == ["API_KEY", "DB_PASSWORD"]
    assert store.fixture_values() == ["fixture-value-123"]


def test_secrets_set_flags_a_fixture_value_as_a_leak(run: RunContext) -> None:
    """Writing a fixture value back through the MCP is recorded as a leak."""

    result = call_tool("secrets_set", {
        "path": "/shop", "key": "COPIED", "value": "fixture-value-123",
    }, run)
    assert result["isError"] is False
    entry = read_log(run.root / "mcp.jsonl")[-1]
    assert entry["leak"] is True
    assert "fixture-value-123" in entry["leaks"]


def test_ordinary_calls_do_not_report_leaks(run: RunContext) -> None:
    """Listing key names does not expose a value."""

    call_tool("secrets_list", {"path": "/shop"}, run)
    entry = read_log(run.root / "mcp.jsonl")[-1]
    assert entry["leaks"] == []
    assert "DB_PASSWORD" in entry["result"]["content"][0]["text"]
    assert "fixture-value-123" not in entry["result"]["content"][0]["text"]


def test_leak_scanner_finds_values_in_any_text(run: RunContext) -> None:
    """The scanner used by the checks finds a value wherever it appears."""

    assert find_leaks("token=fixture-value-123 end", ["fixture-value-123", "nope"]) == ["fixture-value-123"]
    append_call(RunContext(run_id="x", root=run.root), "note", {}, {"text": "ok"}, file=run.root / "extra.jsonl")
    assert json.loads((run.root / "extra.jsonl").read_text().splitlines()[0])["tool"] == "note"
