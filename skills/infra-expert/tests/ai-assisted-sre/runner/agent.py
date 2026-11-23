"""Build the run repo and drive the OpenCode agent container.

The runner and the container exchange small marker files inside the mounted
run directory. That keeps the agent's turns interruptible (the runner enforces
the budget), lets followups react to the assistant's latest output, and avoids
opening a second port or baking any credential into the image.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any

from . import config


def docker(*args: str, check: bool = True, timeout: int = 120) -> subprocess.CompletedProcess[str]:
    """Run one docker command and return its completed process."""

    return subprocess.run(
        ["docker", *args], capture_output=True, text=True, check=check, timeout=timeout
    )


def driver_dir(run_dir: Path) -> Path:
    """Return the handshake directory inside a run."""

    path = Path(run_dir) / "driver"
    path.mkdir(parents=True, exist_ok=True)
    return path


def build_repo(run_dir: Path, scenario: dict[str, Any]) -> Path:
    """Clone the base template into the run, apply overlays and commit it."""

    target = Path(run_dir) / "repo"
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(config.DEFAULT_TEMPLATE, target)

    setup = scenario.get("setup") or {}
    overlays = [
        ((setup.get("repo") or {}).get("overlay") or {}),
        {
            str(path): content
            for path, content in ((setup.get("knowledge") or {}).get("overlay") or {}).items()
        },
    ]
    for block in overlays:
        for path, content in block.items():
            destination = target / str(path).lstrip("/")
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(str(content), encoding="utf-8")

    subprocess.run(["git", "init", "-q"], cwd=target, check=True, capture_output=True)
    subprocess.run(["git", "add", "-A"], cwd=target, check=True, capture_output=True)
    subprocess.run(
        ["git", "-c", "user.name=AI SRE Sandbox", "-c", "user.email=sandbox@acme.test",
         "commit", "-qm", "initial ACME infrastructure"],
        cwd=target, check=True, capture_output=True,
    )
    return target


def snapshot_repo(repo: Path) -> dict[str, float]:
    """Record the mtime of every file in the repo before the agent starts."""

    base = Path(repo)
    return {
        str(path.relative_to(base)): path.stat().st_mtime
        for path in base.rglob("*")
        if path.is_file() and ".git" not in path.parts
    }


def start_container(
    run_id: str,
    run_dir: Path,
    model: str,
    judge_model: str,
    credential: Path | None,
) -> str:
    """Start one agent container on the isolated network."""

    name = f"ai-sre-{run_id}"
    ddir = driver_dir(run_dir)
    mount_run = f"{run_dir}:{config.CONTAINER_MOUNT}/{run_id}"
    mount_repo = f"{run_dir / 'repo'}:{config.CONTAINER_REPO}"
    command = [
        "run", "-d", "--name", name,
        "--network", config.CONTAINER_NETWORK,
        "--env", f"ACME_SANDBOX_RUN_ID={run_id}",
        "--env", f"ACME_SANDBOX_ROOT={config.CONTAINER_ROOT}",
        "--env", f"ACME_SANDBOX_MODEL={model}",
        "--env", f"ACME_SANDBOX_JUDGE_MODEL={judge_model}",
        "--env", "ACME_SANDBOX_DRIVER=1",
        "--env", f"ACME_SANDBOX_DRIVER_DIR={config.CONTAINER_MOUNT}/{run_id}/driver",
        "--volume", mount_run,
        "--volume", mount_repo,
    ]
    if credential is not None:
        command.extend(["--volume", f"{credential}:{config.CONTAINER_AUTH}:ro"])
    command.append(config.CONTAINER_IMAGE)
    result = docker(*command)
    return name


def _write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _wait_for(path: Path, timeout: float, interval: float = 0.25) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if path.exists():
            return True
        time.sleep(interval)
    return False


def send_turn(run_dir: Path, turn: int, prompt: str, timeout: float) -> Path:
    """Write one user message and wait for the agent's response."""

    ddir = driver_dir(run_dir)
    _write_text(ddir / f"turn-{turn}.prompt", prompt)
    (ddir / f"turn-{turn}.go").touch()
    done = ddir / f"turn-{turn}.done"
    if not _wait_for(done, timeout):
        raise TimeoutError(f"agent turn {turn} did not finish within {timeout:.0f}s")
    events = ddir / f"turn-{turn}.events.jsonl"
    if not events.exists():
        raise RuntimeError(f"agent turn {turn} wrote no transcript")
    return events


def request_export(run_dir: Path, timeout: float) -> Path:
    """Ask the driver to export the complete OpenCode session."""

    ddir = driver_dir(run_dir)
    (ddir / "export.go").touch()
    done = ddir / "export.done"
    if not _wait_for(done, timeout):
        raise TimeoutError("agent did not export its transcript")
    file = ddir / "transcript.json"
    if not file.exists():
        raise RuntimeError("transcript export is missing")
    return file


def request_judge(run_dir: Path, prompt: str, timeout: float) -> str:
    """Ask the driver to grade the rubric in a separate judge session."""

    ddir = driver_dir(run_dir)
    _write_text(ddir / "judge.prompt", prompt)
    (ddir / "judge.go").touch()
    done = ddir / "judge.done"
    if not _wait_for(done, timeout):
        raise TimeoutError("judge call did not finish within the budget")
    events = ddir / "judge.events.jsonl"
    texts: list[str] = []
    if events.exists():
        for line in events.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if event.get("type") == "text":
                part = event.get("part") or {}
                if part.get("type") == "text":
                    texts.append(str(part.get("text", "")))
    return "\n".join(texts)


def stop_container(name: str, run_dir: Path, keep: bool) -> None:
    """Signal the driver, wait for it to exit, and remove the container."""

    ddir = driver_dir(run_dir)
    (ddir / "stop").touch()
    try:
        docker("wait", name, check=False, timeout=30)
    except (subprocess.SubprocessError, OSError):
        pass
    if not keep:
        docker("rm", "-f", name, check=False)


def read_events(path: Path) -> list[dict[str, Any]]:
    """Read OpenCode's JSONL event stream."""

    result: list[dict[str, Any]] = []
    for line in Path(path).read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.strip():
            continue
        try:
            result.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return result


def turn_text(events: list[dict[str, Any]]) -> str:
    """Return the assistant text produced by one turn."""

    chunks: list[str] = []
    for event in events:
        if event.get("type") != "text":
            continue
        part = event.get("part") or {}
        if part.get("type") == "text":
            chunks.append(str(part.get("text", "")))
    return "\n".join(chunks)


def driver_health(name: str) -> bool:
    """Whether a named container is still running."""

    try:
        result = docker("inspect", "-f", "{{.State.Running}}", name, check=False)
    except (subprocess.SubprocessError, OSError):
        return False
    return result.stdout.strip() == "true"


def cleanup_markers(run_dir: Path) -> None:
    """Remove the handshake markers that have no evidentiary value."""

    ddir = driver_dir(run_dir)
    for file in ddir.glob("*.go"):
        file.unlink()
    for file in ddir.glob("*.done"):
        file.unlink()
