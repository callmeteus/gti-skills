"""Run the CLI on the MiniStack notebook without holding the SSH session.

``remote run`` starts the notebook-side runner detached, writes its pid and log
into the run directory and returns the run id immediately. ``remote status``
polls a status document, ``remote fetch`` copies a finished run's artifacts
back, and ``remote cleanup`` tears down the guests, container and credential of
a run left behind by a dropped connection.
"""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import time
from pathlib import Path
from typing import Any

from . import config, credentials


def _ssh(*command: str, stdin: str | None = None, timeout: int = 300) -> subprocess.CompletedProcess[str]:
    """Run one command on the notebook over the documented hostname."""

    return subprocess.run(
        ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", config.NOTEBOOK, *command],
        input=stdin, text=True, capture_output=True, timeout=timeout, check=False,
    )


def _rsync(source: str, target: str, exclude: tuple[str, ...] = ()) -> subprocess.CompletedProcess[str]:
    """Run one rsync over SSH, optionally excluding files from the copy."""

    flags = [f"--exclude={item}" for item in exclude]
    return subprocess.run(
        ["rsync", "-az", "--delete", *flags,
         "-e", "ssh -o BatchMode=yes -o ConnectTimeout=15", source, target],
        text=True, capture_output=True, timeout=600, check=False,
    )


def ministack_env_file() -> Path:
    """Return the operator's MiniStack credentials file path.

    ``AI_SRE_MINISTACK_ENV`` overrides the default
    ``~/.gti/infra-expert/scenarios/ministack.env``.
    """

    override = os.environ.get("AI_SRE_MINISTACK_ENV")
    if override:
        return Path(override).expanduser()
    return config.operator_dir() / "ministack.env"


def vendor_dir() -> Path:
    """Return the folder of vendored Python dependencies synced to the notebook.

    ``AI_SRE_VENDOR_DIR`` overrides the default
    ``~/.gti/infra-expert/scenarios/vendor``.
    """

    override = os.environ.get("AI_SRE_VENDOR_DIR")
    if override:
        return Path(override).expanduser()
    return config.operator_dir() / "vendor"


def ministack_env() -> dict[str, str]:
    """Read the four AWS variables from the operator's env file.

    Values are returned in memory only; this module never prints them.
    """

    values: dict[str, str] = {}
    file = ministack_env_file()
    if not file.is_file():
        return values
    for line in file.read_text(encoding="utf-8").splitlines():
        key, sep, value = line.strip().partition("=")
        if sep and key in (
            "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY",
            "AWS_DEFAULT_REGION", "AWS_ENDPOINT_URL",
        ):
            values[key] = value.strip().strip('"').strip("'")
    return values


def sync_package() -> tuple[bool, str]:
    """Sync the package and its vendored Python dependencies to the notebook."""

    target = f"{config.NOTEBOOK}:{config.NOTEBOOK_PACKAGE}/"
    excludes = [
        "--exclude", "runs/", "--exclude", ".pytest_cache/", "--exclude", "__pycache__/",
        "--exclude", "*.pyc", "--exclude", ".git/", "--exclude", "auth.json",
        "--exclude", "driver/", "--exclude", "repo/", "--exclude", ".private/",
        "--exclude", "vendor/", "--exclude", "build/", "--exclude", "install/",
    ]
    done = subprocess.run(
        ["rsync", "-az", "--delete", *excludes,
         "-e", "ssh -o BatchMode=yes -o ConnectTimeout=15",
         f"{config.PACKAGE_ROOT}/", target],
        text=True, capture_output=True, timeout=600, check=False,
    )
    if done.returncode != 0:
        return False, done.stderr.strip()
    vendor = vendor_dir()
    if vendor.is_dir():
        done = _rsync(f"{vendor}/", f"{config.NOTEBOOK}:{config.NOTEBOOK_PACKAGE}/vendor/")
        if done.returncode != 0:
            return False, done.stderr.strip()
    return True, ""


def _option(args: list[str], name: str) -> str | None:
    """Return the value of a ``--name value`` option from an argument list."""

    for index, item in enumerate(args):
        if item == name and index + 1 < len(args):
            return args[index + 1]
        if item.startswith(name + "="):
            return item.split("=", 1)[1]
    return None


def _scenario_of(args: list[str]) -> str | None:
    """Return the scenario id from a `run` argument list."""

    if not args or args[0] not in ("run", "report"):
        return None
    for item in args[1:]:
        if not item.startswith("-"):
            return item
    return None


def _strip_wait_options(args: list[str]) -> tuple[list[str], bool, int]:
    """Remove local-only wait flags before passing arguments to the runner."""

    kept: list[str] = []
    wait = False
    timeout = 2400
    index = 0
    while index < len(args):
        item = args[index]
        if item == "--wait":
            wait = True
            index += 1
            continue
        if item == "--wait-timeout" and index + 1 < len(args):
            try:
                timeout = int(args[index + 1])
            except ValueError:
                pass
            index += 2
            continue
        if item.startswith("--wait-timeout="):
            try:
                timeout = int(item.split("=", 1)[1])
            except ValueError:
                pass
            index += 1
            continue
        kept.append(item)
        index += 1
    return kept, wait, timeout


def _pythonpath() -> str:
    return f"{config.NOTEBOOK_PACKAGE}:{config.NOTEBOOK_PACKAGE / 'vendor'}"


def _env_prefix() -> str:
    return " ".join(f"{key}={shlex.quote(value)}" for key, value in ministack_env().items())


def _detached_command(remote_args: list[str], rdir: Path) -> str:
    """Build the notebook shell command that starts a run and returns at once."""

    arguments = " ".join(shlex.quote(item) for item in remote_args)
    log = shlex.quote(str(rdir / "remote.log"))
    pidfile = shlex.quote(str(rdir / "runner.pid"))
    return (
        f"cd {shlex.quote(str(config.NOTEBOOK_PACKAGE))} && "
        f"env PYTHONPATH={shlex.quote(_pythonpath())} "
        f"ACME_SANDBOX_ROOT={shlex.quote(str(config.NOTEBOOK_PACKAGE))} "
        f"{_env_prefix()} nohup python3 -m runner.cli {arguments} "
        f"> {log} 2>&1 < /dev/null & pid=$!; printf '%s\\n' \"$pid\" > {pidfile}; echo \"$pid\""
    )


def _status_of(run_id: str) -> dict[str, Any]:
    """Read a run's status document, falling back to its recorded pid."""

    rdir = config.NOTEBOOK_RUNS / run_id
    status_file = shlex.quote(str(rdir / "status.json"))
    done = _ssh(f"cat {status_file} 2>/dev/null || true")
    if done.returncode == 0 and done.stdout.strip():
        try:
            data = json.loads(done.stdout)
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
    pidfile = shlex.quote(str(rdir / "runner.pid"))
    found = _ssh(f"cat {pidfile} 2>/dev/null || true")
    pid = found.stdout.strip()
    state = "unknown"
    if pid.isdigit():
        probe = _ssh(f"kill -0 {pid} 2>/dev/null && echo alive || echo dead")
        state = "running" if probe.stdout.strip() == "alive" else "unknown"
    return {"run_id": run_id, "state": state, "pid": pid or None}


def _print_checks(data: dict[str, Any]) -> None:
    print(f"\nVERDICT: {data.get('verdict')} ({data.get('run_id')})")
    for check in data.get("checks") or []:
        mark = "PASS" if check.get("passed") else "FAIL"
        print(f"  {mark} {check.get('name')}: {str(check.get('detail', ''))[:160]}")


def cmd_status(run_id: str) -> int:
    """CLI body for `remote status RUN`."""

    data = _status_of(run_id)
    print(f"RUN: {run_id}")
    print(f"STATE: {data.get('state', 'unknown')}")
    if data.get("scenario_id"):
        print(f"SCENARIO: {data['scenario_id']}")
    if data.get("verdict"):
        print(f"VERDICT: {data['verdict']}")
    if data.get("pid"):
        print(f"PID: {data['pid']}")
    if data.get("error"):
        print(f"ERROR: {data['error']}")
    return 0


def cmd_fetch(run_id: str) -> int:
    """CLI body for `remote fetch RUN`: copy a finished run's artifacts back."""

    data = _status_of(run_id)
    if data.get("state") != "finished":
        print(f"run {run_id} is {data.get('state', 'unknown')}, not finished; nothing copied")
        return 1
    scenario = str(data.get("scenario_id") or "all")
    local_target = config.results_dir(config.stamp(), scenario)
    local_target.mkdir(parents=True, exist_ok=True)
    copied = _rsync(
        f"{config.NOTEBOOK}:{config.NOTEBOOK_RUNS / run_id}/",
        f"{local_target}/",
        exclude=("auth.json",),
    )
    if copied.returncode != 0:
        print(f"copying results failed: {copied.stderr.strip()}")
        return 1
    result_file = local_target / "result.json"
    if result_file.is_file():
        _print_checks(json.loads(result_file.read_text(encoding="utf-8")))
    print(f"Report: {local_target / 'report.md'}")
    return 0


def cmd_cleanup(run_id: str | None) -> int:
    """CLI body for `remote cleanup [RUN]`."""

    args = ["cleanup"] + ([run_id] if run_id else [])
    command = (
        f"cd {shlex.quote(str(config.NOTEBOOK_PACKAGE))} && "
        f"env PYTHONPATH={shlex.quote(_pythonpath())} "
        f"ACME_SANDBOX_ROOT={shlex.quote(str(config.NOTEBOOK_PACKAGE))} "
        f"{_env_prefix()} python3 -m runner.cli "
        + " ".join(shlex.quote(item) for item in args)
    )
    done = _ssh(command, timeout=900)
    if done.stdout:
        print(done.stdout, end="" if done.stdout.endswith("\n") else "\n")
    if done.returncode != 0 and done.stderr:
        print(done.stderr, end="" if done.stderr.endswith("\n") else "\n")
    return done.returncode


def _wait_for(run_id: str, timeout: int, poll: int = 30) -> dict[str, Any]:
    """Poll a detached run until it finishes or the total timeout expires."""

    deadline = time.monotonic() + timeout
    while True:
        data = _status_of(run_id)
        if data.get("state") in ("finished", "cleaned", "unknown"):
            return data
        if time.monotonic() >= deadline:
            print(f"timed out waiting for {run_id}; use `remote status {run_id}`")
            return data
        print(f"waiting for {run_id} ({data.get('state', 'running')})...", flush=True)
        time.sleep(min(poll, max(1, int(deadline - time.monotonic()))))


def _remote_command(args: list[str]) -> str:
    """Build the synchronous notebook command for list/validate/report."""

    return (
        f"cd {shlex.quote(str(config.NOTEBOOK_PACKAGE))} && "
        f"env PYTHONPATH={shlex.quote(_pythonpath())} "
        f"ACME_SANDBOX_ROOT={shlex.quote(str(config.NOTEBOOK_PACKAGE))} "
        f"{_env_prefix()} python3 -m runner.cli "
        + " ".join(shlex.quote(item) for item in args)
    )


def remote(args: list[str]) -> int:
    """CLI body for `remote <subcommand> ...`."""

    if not args:
        print("usage: ai-sre remote <list|validate|run|status|fetch|cleanup|report> [args...]")
        return 2
    subcommand = args[0]
    if not config.NOTEBOOK:
        print("set AI_SRE_NOTEBOOK to the notebook's SSH target, for example ubuntu@host")
        return 2

    if subcommand == "status":
        return cmd_status(args[1]) if len(args) > 1 else 2
    if subcommand == "fetch":
        return cmd_fetch(args[1]) if len(args) > 1 else 2
    if subcommand == "cleanup":
        return cmd_cleanup(args[1] if len(args) > 1 else None)

    ok, error = sync_package()
    if not ok:
        print(f"package sync failed: {error}")
        return 1

    if subcommand != "run":
        done = _ssh(_remote_command(args), timeout=900)
        if done.stdout:
            print(done.stdout, end="" if done.stdout.endswith("\n") else "\n")
        if done.returncode != 0 and done.stderr:
            print(done.stderr, end="" if done.stderr.endswith("\n") else "\n")
        return done.returncode

    scenario = _scenario_of(args)
    if scenario is None:
        print("remote run needs a scenario id")
        return 2
    kept, wait, timeout = _strip_wait_options(args)
    run_id = _option(args, "--run-id") or config.claude_style_run_id(scenario)
    if _option(args, "--run-id") is None:
        kept.extend(["--run-id", run_id])
    rdir = config.NOTEBOOK_RUNS / run_id
    made = _ssh(f"mkdir -p {shlex.quote(str(rdir))}")
    if made.returncode != 0:
        print(f"cannot create remote run directory: {made.stderr.strip()}")
        return 1
    model = _option(args, "--model") or "opencode-go/hy4-flash-free"
    try:
        document = json.dumps(credentials.extract(model), ensure_ascii=False, sort_keys=True) + "\n"
    except RuntimeError as exc:
        print(f"credential error: {exc}")
        return 1
    auth_path = rdir / "auth.json"
    streamed = _ssh(
        f"umask 077; cat > {shlex.quote(str(auth_path))} && chmod 600 {shlex.quote(str(auth_path))}",
        stdin=document,
    )
    if streamed.returncode != 0:
        print(f"cannot write credential to the run directory: {streamed.stderr.strip()}")
        return 1
    del document  # the credential exists only in the notebook run directory

    started = _ssh(_detached_command(kept, rdir), timeout=120)
    if started.returncode != 0:
        print(f"could not start {run_id}: {started.stderr.strip()}")
        return 1
    print(f"RUN: {run_id}")
    print(f"status: ai-sre remote status {run_id}")
    print(f"fetch:  ai-sre remote fetch {run_id}")
    if not wait:
        return 0
    _wait_for(run_id, timeout)
    return cmd_fetch(run_id)
