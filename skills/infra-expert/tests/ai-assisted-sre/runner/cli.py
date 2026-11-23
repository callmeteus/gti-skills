"""The ``ai-sre`` command line interface."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Running `python3 -m runner.cli` from the package root must import the
# sandbox and checks packages without an install step.
PACKAGE_ROOT = Path(__file__).resolve().parents[1]
if str(PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(PACKAGE_ROOT))

from . import config, engine, remote, report, scenarios  # noqa: E402


def build_parser() -> argparse.ArgumentParser:
    """Return the argument parser for the CLI."""

    parser = argparse.ArgumentParser(
        prog="ai-sre",
        description="Run AI-assisted SRE scenarios in the MiniStack sandbox",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list", help="list all scenario ids")

    validate = sub.add_parser("validate", help="check scenario schemas and host commands")
    validate.add_argument("target", nargs="?", help="scenario id, or --all")
    validate.add_argument("--all", action="store_true", dest="all_scenarios")

    run = sub.add_parser("run", help="run one scenario or all of them")
    run.add_argument("scenario", nargs="?", help="scenario id, or --all")
    run.add_argument("--all", action="store_true", dest="all_scenarios")
    run.add_argument("--agent", default="opencode", choices=["opencode"])
    run.add_argument("--model", required=True, help="provider/model id for the agent")
    run.add_argument("--judge-model", default=None, help="provider/model id for the judge")
    run.add_argument("--keep", action="store_true", help="keep the agent container and guests")
    run.add_argument("--run-id", default=None, help="reuse a prepared run directory id")

    show = sub.add_parser("report", help="print the Markdown report of a run")
    show.add_argument("run_id")

    cleanup = sub.add_parser("cleanup", help="tear down a leftover run (notebook side)")
    cleanup.add_argument("run_id", nargs="?", help="run id, or omit for all finished runs")

    remote_parser = sub.add_parser(
        "remote", help="sync the package to the notebook, run there, copy results back"
    )
    remote_parser.add_argument("args", nargs=argparse.REMAINDER)
    return parser


def main(argv: list[str] | None = None) -> int:
    """Run the CLI and return a process exit code."""

    args = build_parser().parse_args(argv)
    if args.command == "list":
        return scenarios.main_list()
    if args.command == "validate":
        target = "all" if args.all_scenarios else args.target
        return scenarios.main_validate(target)
    if args.command == "report":
        return report.print_report(args.run_id)
    if args.command == "cleanup":
        if args.run_id:
            outcome = engine.cleanup_run(args.run_id)
            print(json.dumps(outcome, indent=2, ensure_ascii=False, sort_keys=True))
        else:
            results = engine.cleanup_all()
            print(json.dumps(results, indent=2, ensure_ascii=False, sort_keys=True))
        return 0
    if args.command == "remote":
        return remote.remote(args.args)
    if args.command == "run":
        judge_model = args.judge_model or args.model
        if args.all_scenarios or args.scenario in (None, "--all", "all"):
            results = engine.run_all(args.model, judge_model, keep=args.keep)
        else:
            results = [engine.run_one(
                args.scenario, args.model, judge_model,
                run_id=args.run_id, keep=args.keep,
            )]
        failing = [row for row in results if row.get("verdict") != "PASS"]
        return 1 if failing else 0
    return 2


if __name__ == "__main__":  # pragma: no cover - entry point
    raise SystemExit(main())
