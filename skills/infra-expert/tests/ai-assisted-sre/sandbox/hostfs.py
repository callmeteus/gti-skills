"""Local mirror of guest filesystems and a small command simulator.

The fake MCP never talks to a real guest. It reads and changes the mirror that
``fixtures.py`` also pushes to the MiniStack guest through SSM, which means a
scenario can inspect state without Docker while the guest stays faithful in a
real run. Only the commands the scenarios need are simulated; an unknown
command is answered with a short note instead of failing the agent's turn.
"""

from __future__ import annotations

import base64
import fnmatch
import re
import shlex
import time
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover - only for type checkers
    from .runctx import RunContext


@dataclass
class CommandResult:
    """The shape a real remote command runner returns."""

    stdout: str = ""
    stderr: str = ""
    exit_code: int = 0


class HostFileStore:
    """Files of one guest, mirrored below ``root/<host>/<absolute path>``."""

    def __init__(self, root: Path) -> None:
        self.root = Path(root)

    def host_root(self, host: str) -> Path:
        """Return the directory that mirrors one guest."""

        from .runctx import safe_name

        return self.root / safe_name(host)

    def path(self, host: str, path: str) -> Path:
        """Map an absolute guest path to the local mirror path."""

        rel = str(path).lstrip("/")
        return self.host_root(host) / rel

    def write(self, host: str, path: str, content: str) -> Path:
        """Write a guest file, creating parent directories."""

        target = self.path(host, path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return target

    def append(self, host: str, path: str, content: str) -> None:
        """Append to a guest file."""

        target = self.path(host, path)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("a", encoding="utf-8") as handle:
            handle.write(content)

    def read_bytes(self, host: str, path: str) -> bytes:
        """Read a guest file as bytes, or raise FileNotFoundError."""

        return self.path(host, path).read_bytes()

    def read_text(self, host: str, path: str) -> str:
        """Read a guest file as UTF-8 text."""

        return self.path(host, path).read_text(encoding="utf-8")

    def exists(self, host: str, path: str) -> bool:
        """Whether a guest file exists in the mirror."""

        return self.path(host, path).exists()

    def delete(self, host: str, path: str) -> None:
        """Remove a guest file if it is there."""

        target = self.path(host, path)
        if target.exists():
            target.unlink()

    def copy(self, host: str, src: str, dst: str) -> None:
        """Copy one guest file inside the mirror."""

        source, target = self.path(host, src), self.path(host, dst)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(source.read_bytes())

    def move(self, host: str, src: str, dst: str) -> None:
        """Move one guest file inside the mirror."""

        self.copy(host, src, dst)
        self.delete(host, src)

    def list(self, host: str, path: str) -> list[str]:
        """Return the names inside a guest directory."""

        target = self.path(host, path)
        if target.is_file():
            return [path]
        if not target.exists():
            return []
        return sorted(item.name for item in target.iterdir())

    def reset(self) -> None:
        """Remove the whole mirror (used by teardown)."""

        import shutil

        if self.root.exists():
            shutil.rmtree(self.root)


def _store(run: "RunContext") -> HostFileStore:
    """Return the mirror store for a run."""

    return HostFileStore(run.root / "hosts")


def _command_words(command: str) -> list[str]:
    """Return command words, dropping a leading ``sudo`` and its flags."""

    try:
        tokens = shlex.split(command)
    except ValueError:
        tokens = command.split()
    index = 0
    while index < len(tokens) and tokens[index] == "sudo":
        index += 1
        while index < len(tokens) and tokens[index].startswith("-"):
            if tokens[index] in ("-u", "--user", "-g", "--group") and index + 1 < len(tokens):
                index += 2
            else:
                index += 1
    return tokens[index:]


def _first(command: str) -> str:
    """Return the lowercased first word of a command."""

    words = _command_words(command)
    return words[0].lower() if words else ""


def _base(name: str) -> str:
    """Strip a directory from a command name."""

    return name.rsplit("/", 1)[-1]


def _flag_number(words: list[str], short: str, long: str, default: int) -> int:
    """Read -n N / --lines=N from a word list."""

    for index, word in enumerate(words):
        if word in (short, long) and index + 1 < len(words):
            try:
                return int(words[index + 1])
            except ValueError:
                continue
        if word.startswith(long + "="):
            try:
                return int(word.split("=", 1)[1])
            except ValueError:
                continue
    return default


def _health_for(run: "RunContext", command: str) -> CommandResult:
    """Simulate curl/health probes, including the backend faults."""

    no_egress = bool(run.flags.get("no_egress_on_host"))
    url = ""
    for word in shlex.split(command):
        if word.startswith("http://") or word.startswith("https://"):
            url = word
            break
    if no_egress and url and "acme.test" not in url:
        return CommandResult(stderr="curl: (6) Could not resolve host: external endpoint", exit_code=6)

    mock = run.flags.get("mock_backend_error") or {}
    if mock:
        pattern = str(mock.get("url_pattern", ""))
        if not pattern or (pattern in command):
            left = int(mock.get("calls", 1))
            if left > 0:
                mock["calls"] = left - 1
                run.flags["mock_backend_error"] = mock
                status = int(mock.get("status", 500))
                return CommandResult(
                    stdout=f"HTTP/1.1 {status} Internal Server Error\nbackend unavailable",
                    exit_code=22,
                )
    return CommandResult(stdout="HTTP/1.1 200 OK\nok", exit_code=0)


def _systemctl_status(run: "RunContext", host: str, words: list[str]) -> CommandResult:
    """Report service state, honouring the slow-start fault."""

    unit = next((w for w in words[2:] if not w.startswith("-")), "")
    record = run.host(host)
    services = record.services if record else []
    slow = run.flags.get("slow_start") or {}
    if slow and (not slow.get("services") or unit in slow.get("services", [])):
        until = float(slow.get("until", 0))
        if time.time() < until:
            return CommandResult(stdout=f"{unit} - activating (auto-restart) since start")
    if unit and unit not in services:
        return CommandResult(stdout=f"Unit {unit} could not be found.", exit_code=4)
    return CommandResult(stdout=f"{unit or 'service'} - active (running) since today")


def _sed_expression(words: list[str]) -> str:
    """Find the sed script in a simple sed command."""

    for word in words[1:]:
        if word.startswith("-"):
            continue
        return word
    return ""


def _apply_sed(content: str, expression: str) -> str:
    """Apply the small subset of sed used by the scenarios (s/a/b/)."""

    match = re.match(r"^s/([^/]*)/([^/]*)/(g?)$", expression)
    if not match:
        return content
    old, new, flags = match.groups()
    return content.replace(old, new) if flags == "g" else content.replace(old, new, 1)


def run_readonly(run: "RunContext", host: str, command: str) -> CommandResult:
    """Simulate one read-only remote command."""

    words = _command_words(command)
    if not words:
        return CommandResult(stderr="remote command is empty", exit_code=1)
    name = _base(words[0])
    store = _store(run)
    args = [w for w in words[1:] if not w.startswith("-")]

    if name == "cat":
        texts = []
        for item in args:
            if not store.exists(host, item):
                return CommandResult(stderr=f"cat: {item}: No such file or directory", exit_code=1)
            texts.append(store.read_text(host, item))
        return CommandResult(stdout="".join(texts))

    if name in ("head", "tail"):
        count = _flag_number(words, "-n", "--lines", 10)
        if not args:
            return CommandResult(stderr=f"{name}: missing file operand", exit_code=1)
        lines = store.read_text(host, args[0]).splitlines()
        chosen = lines[:count] if name == "head" else lines[-count:]
        return CommandResult(stdout="\n".join(chosen) + ("\n" if chosen else ""))

    if name == "ls":
        target = args[0] if args else "/"
        return CommandResult(stdout="\n".join(store.list(host, target)))

    if name == "test" and "&&" in command:
        # Scenario checks use `test -s <path> && echo ok` as one read-only
        # command. It is a single simulator call, not a shell, so handle the
        # one supported conjunction explicitly.
        left, right = command.split("&&", 1)
        tokens = left.split()
        if tokens and tokens[0] == "test":
            tokens = tokens[1:]
        flags = [token for token in tokens if token.startswith("-")]
        operands = [token for token in tokens if not token.startswith("-")]
        path = operands[0] if operands else ""
        present = bool(path) and store.exists(host, path)
        if "-s" in flags:
            present = present and bool(store.read_bytes(host, path))
        payload = ""
        if "echo" in right:
            payload = right.split("echo", 1)[1].strip().strip("'\"")
        if present:
            return CommandResult(stdout=(payload + "\n") if payload else "")
        return CommandResult(exit_code=1)

    if name == "grep":
        ignore_case = any(w in ("-i", "--ignore-case") for w in words)
        count_only = any(w in ("-c", "--count") for w in words)
        number_lines = any(w in ("-n", "--line-number") for w in words)
        positional = [w for w in words[1:] if not w.startswith("-")]
        if len(positional) < 2:
            return CommandResult(stderr="grep: missing operand", exit_code=2)
        pattern, path = positional[0], positional[1]
        try:
            regex = re.compile(pattern, re.IGNORECASE if ignore_case else 0)
        except re.error as exc:
            return CommandResult(stderr=f"grep: {exc}", exit_code=2)
        try:
            all_lines = store.read_text(host, path).splitlines()
        except FileNotFoundError:
            return CommandResult(stderr=f"grep: {path}: No such file or directory", exit_code=2)
        lines = [line for line in all_lines if regex.search(line)]
        if count_only:
            return CommandResult(stdout=f"{len(lines)}\n", exit_code=0 if lines else 1)
        if number_lines:
            numbered = [
                f"{index}:{line}"
                for index, line in enumerate(all_lines, start=1)
                if regex.search(line)
            ]
            return CommandResult(stdout="\n".join(numbered) + ("\n" if numbered else ""), exit_code=0 if numbered else 1)
        return CommandResult(stdout="\n".join(lines) + ("\n" if lines else ""), exit_code=0 if lines else 1)

    if name == "sed" and "-n" in words:
        positional = [w for w in words[1:] if not w.startswith("-")]
        if len(positional) < 2:
            return CommandResult(stderr="sed: missing operand", exit_code=1)
        expression, path = positional[0], positional[1]
        lines = store.read_text(host, path).splitlines()
        match = re.match(r"^(\d+)?(?:,(\d+))?p$", expression)
        if not match:
            return CommandResult(stdout="")
        start = int(match.group(1) or 1)
        end = int(match.group(2) or start)
        return CommandResult(stdout="\n".join(lines[start - 1:end]))

    if name == "systemctl":
        sub = words[1] if len(words) > 1 else ""
        record = run.host(host)
        services = record.services if record else []
        unit = next((w for w in words[2:] if not w.startswith("-")), "")
        if sub == "is-enabled":
            if unit and unit in services:
                return CommandResult(stdout="enabled\n")
            return CommandResult(stdout="disabled\n", exit_code=1)
        if sub == "is-active":
            if unit and unit in services:
                return CommandResult(stdout="active\n")
            return CommandResult(stdout="inactive\n", exit_code=3)
        if sub == "show" and "-p" in words:
            prop = words[words.index("-p") + 1] if words.index("-p") + 1 < len(words) else ""
            if prop == "NRestarts":
                return CommandResult(stdout=f"NRestarts={int(bool(run.flags.get('single_instance_service')))}\n")
            return CommandResult(stdout=f"{prop}=0\n")
        if sub in ("status", "show", "list-units"):
            return _systemctl_status(run, host, words)
        return CommandResult(stdout=f"systemctl {sub}: ok")

    if name == "docker" and words[1:2] == ["ps"]:
        return CommandResult(stdout="CONTAINER ID   IMAGE   STATUS\nabc123         acme-app   Up 2 minutes")

    if name == "journalctl":
        unit = ""
        if "-u" in words and words.index("-u") + 1 < len(words):
            unit = words[words.index("-u") + 1]
        path = f"/var/log/{unit or 'system'}.log"
        content = store.read_text(host, path) if store.exists(host, path) else f"[{unit or 'system'}] started\n"
        count = _flag_number(words, "-n", "--lines", 20)
        return CommandResult(stdout="\n".join(content.splitlines()[-count:]))

    if name in ("curl", "wget"):
        return _health_for(run, command)

    if name == "stat":
        target = args[-1] if args else "/"
        if "-c" in words or "--format" in words:
            flag = "-c" if "-c" in words else "--format"
            fmt = words[words.index(flag) + 1] if words.index(flag) + 1 < len(words) else "%n"
            exists = store.exists(host, target)
            size = len(store.read_bytes(host, target)) if exists else 0
            rendered = fmt.replace("%s", str(size)).replace("%n", target)
            rendered = rendered.replace("%F", "regular file" if exists else "not found")
            if not exists:
                return CommandResult(stderr=f"stat: cannot stat '{target}': No such file or directory", exit_code=1)
            return CommandResult(stdout=rendered + "\n")
        status = "regular file" if store.exists(host, target) else "not found"
        return CommandResult(stdout=f"  File: {target}\n  Type: {status}")

    if name in ("ps", "df", "pm2", "uptime", "hostname"):
        return CommandResult(stdout=f"(sandbox) {name}: ok")

    return CommandResult(stdout=f"(sandbox) simulated read-only command: {command}")


def _stdout_redirect(command: str) -> tuple[str, str, bool] | None:
    """Split a plain ``> path`` or ``>> path`` redirect from a command."""

    match = re.search(r'>>\s*([^\s;]+)\s*$', command)
    if match:
        return command[:match.start()].strip(), match.group(1).strip(), True
    match = re.search(r'>\s*([^\s;]+)\s*$', command)
    if match:
        return command[:match.start()].strip(), match.group(1).strip(), False
    return None


def run_write(run: "RunContext", host: str, command: str) -> CommandResult:
    """Simulate one state-changing remote command and apply fault hooks."""

    words = _command_words(command)
    if not words:
        return CommandResult(stderr="remote command is empty", exit_code=1)
    name = _base(words[0])
    store = _store(run)
    docker_cmd = name == "docker"
    has_sudo = shlex.split(command)[:1] == ["sudo"]
    if docker_cmd and run.flags.get("sudo_required_for_docker") and not has_sudo:
        return CommandResult(stderr="docker: permission denied while not running as root", exit_code=1)

    stderr_fault = run.flags.get("stderr_only_error") or {}
    if stderr_fault and fnmatch.fnmatch(command, str(stderr_fault.get("command_pattern", ""))):
        return CommandResult(stdout="ok\n", stderr=str(stderr_fault.get("stderr", "")))

    touched: list[str] = []
    result = CommandResult(stdout="ok\n")

    if name == "cp" or name == "mv":
        positional = [w for w in words[1:] if not w.startswith("-")]
        if len(positional) >= 2:
            src, dst = positional[0], positional[-1]
            if "-b" in words or "--backup" in words:
                store.copy(host, src, dst + ".bak")
                touched.append(dst + ".bak")
            (store.move if name == "mv" else store.copy)(host, src, dst)
            touched.append(dst)

    elif name == "mkdir":
        target = next((w for w in words[1:] if not w.startswith("-")), "")
        if target:
            store.path(host, target).mkdir(parents=True, exist_ok=True)

    elif name == "rm":
        for target in [w for w in words[1:] if not w.startswith("-")]:
            store.delete(host, target)
            touched.append(target)

    elif name in ("sed",) and "-i" in words:
        positional = [w for w in words[1:] if not w.startswith("-")]
        if len(positional) >= 2:
            expression, path = positional[0], positional[-1]
            if store.exists(host, path):
                content = store.read_text(host, path)
                store.write(host, path, _apply_sed(content, expression))
                touched.append(path)

    elif name == "tee":
        target = next((w for w in words[1:] if not w.startswith("-")), "")
        if target:
            store.write(host, target, "")
            touched.append(target)

    else:
        redirect = _stdout_redirect(command)
        if redirect:
            before, target, append = redirect
            payload = before.split(None, 1)[1] if len(before.split(None, 1)) > 1 else ""
            if payload.startswith(("'", '"')) and payload[-1:] == payload[:1]:
                payload = payload[1:-1]
            if append:
                store.append(host, target, payload + "\n")
            else:
                store.write(host, target, payload + "\n")
            touched.append(target)
        elif name == "systemctl":
            sub = words[1] if len(words) > 1 else ""
            unit = words[2] if len(words) > 2 else ""
            record = run.host(host)
            single = run.flags.get("single_instance_service") or {}
            if (
                sub == "restart"
                and (not single.get("services") or unit in single.get("services", []))
            ):
                result.stderr = "warning: single instance service; restart causes a short outage\n"
        elif name == "docker" and words[1:2] == ["run"]:
            # A guest-side container start is observable by the
            # ``container_running`` check. Record the name against the host.
            container = ""
            if "--name" in words and words.index("--name") + 1 < len(words):
                container = words[words.index("--name") + 1]
            else:
                for word in words[2:]:
                    if not word.startswith("-") and "/" not in word:
                        container = _base(word)
                        break
            if container:
                running = dict(run.flags.get("containers_running") or {})
                names = list(running.get(host) or [])
                if container not in names:
                    names.append(container)
                running[host] = names
                run.flags["containers_running"] = running
            result.stdout = f"container {container or 'unknown'} started\n"
        elif name in ("python3", "python"):
            result.stdout = "(sandbox) python command accepted by prod_ssh_exec\n"

    for path in touched:
        revert = run.flags.get("reconciler_reverts") or {}
        targets = revert.get("paths") or []
        if targets and (path in targets or any(fnmatch.fnmatch(path, pat) for pat in targets)):
            content = str(revert.get("content", ""))
            for record in run.hosts.values():
                if store.exists(record.name, path):
                    store.write(record.name, path, content)
    return result


def apply_env_file(run: "RunContext", host: str, path: str, values: dict[str, str]) -> None:
    """Write a guest env file with one ``KEY=value`` line per secret."""

    content = "".join(f"{key}={value}\n" for key, value in values.items())
    _store(run).write(host, path, content)
