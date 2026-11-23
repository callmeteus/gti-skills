"""Build and print the Markdown report of one scenario run."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from . import config


def _yes(value: Any) -> str:
    return "PASS" if value else "FAIL"


def build_report(result: dict[str, Any]) -> str:
    """Render the Markdown report from a ``result.json`` document."""

    checks = result.get("checks") or []
    judge = result.get("judge") or []
    scenario = result.get("scenario") or {}
    lines: list[str] = [
        f"# AI-assisted SRE run: {result.get('run_id', 'unknown')}",
        "",
        f"- Scenario: `{result.get('scenario_id', '?')}` - {scenario.get('title', '')}",
        f"- Verdict: **{result.get('verdict', 'FAIL')}**",
        f"- Mode: {scenario.get('mode', '?')} | autonomous: {scenario.get('autonomous', False)}",
        f"- Agent: {result.get('agent', 'opencode')} | model: {result.get('model', '?')}",
        f"- Judge model: {result.get('judge_model', '?')}",
        f"- Started: {result.get('started', '?')} | finished: {result.get('finished', '?')}",
        f"- Turns: {result.get('turns', 0)} | duration: {result.get('duration_s', 0):.1f}s",
        f"- Budget: {json.dumps(scenario.get('budget') or {}, sort_keys=True)}",
        "",
        "## Checks",
        "",
        "| # | Check | Kind | Result | Detail |",
        "|---|-------|------|--------|--------|",
    ]
    if not checks:
        lines.append("| - | - | - | FAIL | no checks were run |")
    for index, check in enumerate(checks, start=1):
        detail = str(check.get("detail", "")).replace("|", "\\|").replace("\n", " ")
        lines.append(
            f"| {index} | {check.get('name', '')} | {check.get('kind', '')} "
            f"| {_yes(check.get('passed', False))} | {detail} |"
        )
    lines.extend(["", "## Judge", ""])
    if not judge:
        lines.append("_No judge result._")
    else:
        lines.append("| Bullet | Result | Reason |")
        lines.append("|--------|--------|--------|")
        for row in judge:
            reason = str(row.get("reason", "")).replace("|", "\\|").replace("\n", " ")
            lines.append(
                f"| {row.get('bullet')}. {str(row.get('text', ''))[:160]} "
                f"| {_yes(row.get('pass', False))} | {reason} |"
            )
    lines.extend([
        "",
        "## Artifacts",
        "",
        f"- Run directory: `{result.get('run_dir', '')}`",
        f"- Transcript: `{result.get('transcript_path', '')}`",
        f"- MCP log: `{result.get('mcp_log_path', '')}`",
        f"- Pipeline log: `{result.get('pipeline_log_path', '')}`",
        "",
    ])
    return "\n".join(lines)


def write_report(run_dir: Path, result: dict[str, Any]) -> Path:
    """Write the report and result document into the run directory."""

    run_dir = Path(run_dir)
    run_dir.mkdir(parents=True, exist_ok=True)
    result = dict(result)
    result["run_dir"] = str(run_dir)
    (run_dir / "result.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    report = build_report(result)
    (run_dir / "report.md").write_text(report, encoding="utf-8")
    return run_dir / "report.md"


def print_report(run_id: str) -> int:
    """CLI body for `report RUN`: print the stored Markdown report."""

    file = config.run_dir(run_id) / "report.md"
    if not file.is_file():
        print(f"no report for run {run_id} at {file}")
        return 1
    print(file.read_text(encoding="utf-8"), end="")
    return 0
