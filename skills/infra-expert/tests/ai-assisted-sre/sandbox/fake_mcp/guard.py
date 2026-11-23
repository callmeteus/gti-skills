"""Read-only command guard, modelled on the real production MCP guard.

The guard rejects shell metacharacters outside quoted literals, a set of
interpreter and wrapper binaries, environment dumps and secret key paths. The
write tool (``prod_ssh_exec``) deliberately has no guard; it is auto-approved
in the sandbox and every call is logged instead.
"""

from __future__ import annotations

import re

SHELL_META = re.compile(r"[|&;<>()$`\\\n\r\u0000-\u0008\u000B\u000C\u000E-\u001F]")

EXEC_FIRST_WORDS = {
    "bash", "sh", "zsh", "eval", "exec", "source", "xargs", "env", "nohup",
    "timeout", "watch", "nice", "setsid", "su", "sudoedit", "perl", "ruby",
    "node", "php", "sed", "curl", "wget", "nc", "socat", "ssh",
}

SQL_CLIENTS = {"mysql", "mariadb", "mysqldump", "mysqlsh", "mysqladmin", "mysqlbinlog"}

BLOCKED_SECRET_PATH_FRAGMENTS = (".pem", ".p12", ".key", ".acme.credentials")


def strip_quoted_string_literals(command: str) -> str:
    """Remove quoted literals so SQL and paths inside quotes do not trip the meta check."""

    without_single = re.sub(r"'[^']*'", "''", command)
    return re.sub(r'"(?:[^"\\]|\\.)*"', '""', without_single)


def command_words(command: str) -> list[str]:
    """Return non-flag command words after dropping env assignments and sudo.

    Leading NAME=value tokens are not the command. sudo and its flags are
    skipped, including the argument of -u and -g, so the guarded word is the
    program after sudo. sudo itself is not in the blocked first-word set.
    """

    raw = [token for token in command.split() if token]
    tokens: list[str] = []
    for token in raw:
        if not tokens and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", token):
            continue
        tokens.append(token)

    index = 0
    while index < len(tokens) and tokens[index] == "sudo":
        index += 1
        while index < len(tokens):
            flag = tokens[index]
            if flag == "--":
                index += 1
                break
            if flag.startswith("-"):
                if flag in ("-u", "--user", "-g", "--group"):
                    index += 2
                else:
                    index += 1
                continue
            break

    words: list[str] = []
    rest = tokens[index:]
    position = 0
    while position < len(rest):
        token = rest[position]
        if token.startswith("-"):
            position += 1
            continue
        words.append(token)
        position += 1
    return words


def rejection_reason(command: str, *, strict_pipe: bool = False) -> str | None:
    """Return why a read-only command must be rejected, or None when allowed."""

    trimmed = command.strip()
    if not trimmed:
        return "remote command is empty"

    without_quotes = strip_quoted_string_literals(trimmed)
    # The fault is stricter than the base guard: a pipe inside quotes counts too.
    if strict_pipe and "|" in trimmed:
        return "shell metacharacters are not allowed in remote commands"
    if SHELL_META.search(without_quotes):
        return "shell metacharacters are not allowed in remote commands"

    # Check the raw sudo flags before command_words drops them.
    raw_tokens = trimmed.split()
    if raw_tokens and raw_tokens[0].lower() == "sudo" and any(
        token in ("-e", "--edit") for token in raw_tokens[1:]
    ):
        return "sudo -e is not allowed in remote commands"

    words = command_words(trimmed)
    first = words[0].lower() if words else ""
    if not first:
        return "remote command is empty"
    if first.startswith("python"):
        return "python is not allowed in remote commands"
    if first in EXEC_FIRST_WORDS:
        return f"{first} is not allowed in remote commands"
    if first == "sudo" and any(word in ("-e", "--edit") for word in trimmed.split()):
        return "sudo -e is not allowed in remote commands"
    if first == "find":
        lower = trimmed.lower()
        if re.search(r"\s-fprint\S*", lower) or re.search(r"\s-fls\b", lower) or re.search(r"\s-ok(dir)?\b", lower):
            return "find -fprint/-fls/-ok is not allowed in remote commands"
    if first == "printenv" or (first == "pm2" and len(words) > 1 and words[1].lower() == "env"):
        return "environment dumps are not allowed"
    for fragment in BLOCKED_SECRET_PATH_FRAGMENTS:
        if fragment in trimmed:
            return f"paths containing {fragment} are not allowed"
    if first in SQL_CLIENTS:
        return "use a SQL tool; mysql client is not allowed in a read-only command"
    return None


def format_rejection_message(reason: str) -> str:
    """Explain a rejection and point at the write tool when it could help."""

    if "metacharacters" in reason:
        return (
            f"{reason} Use prod_ssh_exec for commands with parentheses, pipes, "
            "redirects or $(...). Use the grep and tailLines inputs instead of a pipe."
        )
    return reason
