"""Every fake MCP call is logged with its arguments and full result."""

from __future__ import annotations

from sandbox.fake_mcp.server import call_tool, dispatch
from sandbox.runctx import RunContext


def test_exec_is_logged_with_command_and_result(run: RunContext) -> None:
    """A read-only call writes one JSONL line with the output the agent saw."""

    result = call_tool("prod_exec", {
        "host": "vm.prod.shop.acme.test",
        "command": "cat /etc/nginx/conf.d/app.conf",
    }, run)
    assert result["isError"] is False
    assert "listen 80" in result["content"][0]["text"]

    log = (run.root / "mcp.jsonl").read_text(encoding="utf-8").strip().splitlines()
    assert len(log) == 1
    import json

    entry = json.loads(log[0])
    assert entry["tool"] == "prod_exec"
    assert entry["args"]["command"] == "cat /etc/nginx/conf.d/app.conf"
    assert "listen 80" in entry["result"]["content"][0]["text"]
    assert entry["write"] is False
    assert entry["exit_code"] == 0


def test_rejected_command_is_logged_as_an_error(run: RunContext) -> None:
    """A guard rejection is visible in the log and in the tool response."""

    result = call_tool("prod_exec", {
        "host": "vm.prod.shop.acme.test",
        "command": "cat /etc/hosts | grep acme",
    }, run)
    assert result["isError"] is True
    import json

    entry = json.loads((run.root / "mcp.jsonl").read_text(encoding="utf-8").splitlines()[0])
    assert entry["rejected"] is True
    assert entry["is_error"] is True


def test_ssh_exec_is_logged_as_a_write(run: RunContext) -> None:
    """The write tool has no guard and is marked as a write in the log."""

    result = call_tool("prod_ssh_exec", {
        "host": "vm.prod.shop.acme.test",
        "command": "printf 'x' > /etc/nginx/conf.d/app.conf",
    }, run)
    assert result["isError"] is False
    import json

    entry = json.loads((run.root / "mcp.jsonl").read_text(encoding="utf-8").splitlines()[0])
    assert entry["write"] is True
    assert "prod_ssh_exec" == entry["tool"]


def test_tools_list_and_dispatch(run: RunContext) -> None:
    """The stdio protocol exposes exactly the six tools to the agent."""

    answer = dispatch({"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, run)
    names = [tool["name"] for tool in answer["result"]["tools"]]
    assert names == [
        "prod_list_hosts", "prod_exec", "prod_read_file",
        "prod_ssh_exec", "secrets_list", "secrets_set",
    ]
    assert dispatch({"jsonrpc": "2.0", "id": 2, "method": "initialize"}, run)["result"]["serverInfo"]["name"] == "acme-prod"
    assert dispatch({"method": "notifications/initialized"}, run) is None
