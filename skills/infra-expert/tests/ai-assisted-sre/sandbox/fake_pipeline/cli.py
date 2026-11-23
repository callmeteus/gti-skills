"""CLI for the fake ACME pipeline.

Only leaves listed in the repository's ``pipeline.yaml`` may be planned or
applied. Runs are logged to the run's pipeline.jsonl; a plan with no diff is
still a successful run. Terraform is invoked against MiniStack through the
ambient AWS variables, never with credentials from this source tree.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Callable, Sequence

from .. import paths
from ..ministack import load_credentials_file

RunResult = tuple[int, str, str]
Runner = Callable[[list[str], Path], RunResult]


def load_pipeline(repo: Path | None = None) -> dict[str, Any]:
    """Read ``pipeline.yaml`` without needing a YAML dependency."""

    root = Path(repo) if repo else paths.repo_root()
    file = root / "pipeline.yaml"
    if not file.exists():
        return {"leaves": [], "terraform_version": "v1.17.0"}
    leaves: list[str] = []
    version = "v1.17.0"
    in_leaves = False
    for raw in file.read_text(encoding="utf-8").splitlines():
        line = raw.split("#", 1)[0].rstrip()
        stripped = line.strip()
        if not stripped:
            continue
        if stripped == "leaves:":
            in_leaves = True
            continue
        if not line.startswith((" ", "\t")):
            in_leaves = False
            if stripped.startswith("terraform_version:"):
                version = stripped.split(":", 1)[1].strip().strip('"\'') or version
            continue
        if in_leaves and stripped.startswith("- "):
            leaves.append(stripped[2:].strip().strip('"\''))
    return {"leaves": leaves, "terraform_version": version}


def leaf_directory(repo: Path, leaf: str) -> Path:
    """Return the Terraform directory for a leaf."""

    return Path(repo) / "infra" / "terraform" / "services" / leaf


def _log(run_id: str, entry: dict[str, Any], file: Path | None = None) -> None:
    """Append one pipeline log line."""

    target = Path(file) if file else paths.pipeline_log(run_id)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=False, sort_keys=True) + "\n")


def run_leaf(
    repo: Path,
    leaf: str,
    action: str,
    run_id: str,
    runner: Runner | None = None,
    log_file: Path | None = None,
) -> int:
    """Init and plan/apply one leaf, log the run and return its exit code."""

    directory = leaf_directory(repo, leaf)
    base = ["terraform", f"-chdir={directory}"]
    commands = [base + ["init", "-input=false"]]
    if action == "apply":
        commands.append(base + ["apply", "-auto-approve", "-input=false"])
    else:
        commands.append(base + ["plan", "-input=false"])

    load_credentials_file()
    exit_code = 0
    outputs: list[str] = []
    errors: list[str] = []
    try:
        for command in commands:
            if runner is not None:
                code, stdout, stderr = runner(command, directory)
            else:  # pragma: no cover - the sandbox never applies for real itself
                completed = subprocess.run(command, cwd=Path(repo), text=True, capture_output=True)
                code, stdout, stderr = completed.returncode, completed.stdout, completed.stderr
            outputs.append(stdout)
            errors.append(stderr)
            if code != 0:
                exit_code = code
                break
    except Exception as exc:  # a broken runner is a failed pipeline run
        exit_code, errors = 1, errors + [str(exc)]

    _log(run_id, {
        "ts": time.time(),
        "run_id": run_id,
        "action": action,
        "leaf": leaf,
        "exit_code": exit_code,
        "stdout": "\n".join(outputs),
        "stderr": "\n".join(errors),
        "commands": commands,
    }, file=log_file)
    return exit_code


def read_status(run_id: str | None = None, file: Path | None = None) -> list[dict[str, Any]]:
    """Return the logged runs, newest last, optionally filtered by run id."""

    target = Path(file) if file else paths.pipeline_log(run_id)
    if not target.exists():
        return []
    rows = [json.loads(line) for line in target.read_text(encoding="utf-8").splitlines() if line.strip()]
    if run_id:
        rows = [row for row in rows if row.get("run_id") == run_id]
    return rows


def build_parser() -> argparse.ArgumentParser:
    """Return the argument parser for the pipeline CLI."""

    parser = argparse.ArgumentParser(prog="pipeline", description="Fake ACME pipeline")
    parser.add_argument("--repo", type=Path, default=None)
    parser.add_argument("--run-id", default=None)
    sub = parser.add_subparsers(dest="action", required=True)
    for action in ("plan", "apply"):
        command = sub.add_parser(action, help=f"{action} one listed leaf")
        command.add_argument("leaf")
    status = sub.add_parser("status", help="show logged pipeline runs")
    status.add_argument("run", nargs="?")
    status.add_argument("--json", action="store_true")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Run the pipeline CLI and return a process exit code."""

    args = build_parser().parse_args(argv)
    rid = args.run_id or paths.current_run_id()
    repo = Path(args.repo) if args.repo else paths.repo_root()
    if args.action == "status":
        rows = read_status(args.run or rid)
        if args.json:
            print(json.dumps(rows, indent=2, ensure_ascii=False))
        else:
            for row in rows:
                print(f"{row['action']:5} {row['leaf']:20} exit={row['exit_code']}")
        return 0

    pipeline = load_pipeline(repo)
    if args.leaf not in pipeline["leaves"]:
        _log(rid, {
            "ts": time.time(), "run_id": rid, "action": args.action,
            "leaf": args.leaf, "exit_code": 2,
            "stderr": "leaf is not listed in pipeline.yaml",
        })
        print(f"refusing unknown leaf: {args.leaf}", file=sys.stderr)
        return 2
    return run_leaf(repo, args.leaf, args.action, rid)


if __name__ == "__main__":  # pragma: no cover - exercised through __main__.py
    raise SystemExit(main())
