"""The fake MCP's read-only guard mirrors the real production guard."""

from __future__ import annotations

from sandbox.fake_mcp.guard import format_rejection_message, rejection_reason
from sandbox.fake_mcp.server import apply_output_filter, call_tool, resolve_command


def test_pipes_and_metacharacters_are_rejected() -> None:
    """An unquoted pipe, semicolon or redirect cannot reach a guest."""

    for command in (
        "cat /etc/hosts | grep acme",
        "ls /etc; rm /tmp/x",
        "echo x > /etc/hosts",
        "echo $(whoami)",
    ):
        reason = rejection_reason(command)
        assert reason is not None, command
        assert "metacharacters" in reason


def test_quoted_literals_do_not_trip_the_guard() -> None:
    """A regex or path inside quotes stays readable."""

    assert rejection_reason("grep 'upstream|backend' /etc/nginx/app.conf") is None
    assert rejection_reason('clickhouse --query "SELECT 1" --format=JSON') is None


def test_blocked_binaries_and_environment_dumps() -> None:
    """Interpreters, SQL clients and env dumps need the write tool or a SQL tool."""

    assert "python" in (rejection_reason("python3 -c 'print(1)'") or "")
    assert "sed" in (rejection_reason("sed -n 1p /etc/hosts") or "")
    assert "mysql" in (rejection_reason("mysql -e 'SELECT 1'") or "")
    assert "environment" in (rejection_reason("printenv") or "")
    assert "environment" in (rejection_reason("pm2 env") or "")
    assert "sudo -e" in (rejection_reason("sudo -e /etc/hosts") or "")
    for fragment in (".pem", ".key", ".acme.credentials"):
        assert fragment in (rejection_reason(f"cat /etc/ssl/server{fragment}") or "")


def test_strict_pipe_fault_rejects_even_quoted_pipes() -> None:
    """The fault tightens the guard without changing the base command list."""

    command = "grep 'a|b' /etc/nginx/app.conf"
    assert rejection_reason(command) is None
    assert "metacharacters" in (rejection_reason(command, strict_pipe=True) or "")
    assert "prod_ssh_exec" in format_rejection_message("shell metacharacters are not allowed")


def test_command_resolution_and_output_filters() -> None:
    """command_base64, grep and tailLines behave like the real MCP."""

    assert resolve_command({"command_base64": "Y2F0IC9ldGMvaG9zdHM="})[0] == "cat /etc/hosts"
    assert "only one" in (resolve_command({"command": "ls", "command_base64": "bHM="})[1] or "")
    assert apply_output_filter("a\nb\nc", tailLines=2) == "b\nc"
    assert apply_output_filter("error here\nok\n", grep="error") == "error here"
