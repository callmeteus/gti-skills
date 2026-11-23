"""Load, list and validate scenario definitions.

Validation is deliberately strict: a scenario that cannot be driven by the
runner should be reported before a run is started. ``host_commands`` also
checks that the command simulator knows every read-only command a scenario
asks it to evaluate.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

import yaml

from . import config

STATE_KINDS: dict[str, tuple[str, ...]] = {
    "host_file_contains": ("host", "path", "pattern"),
    "host_file_absent": ("host", "path"),
    "host_cmd": ("host", "cmd", "expect_exit", "output_pattern"),
    "container_running": ("host", "container"),
    "repo_file_contains": ("path", "pattern"),
    "repo_file_absent": ("path",),
    "git_committed": ("path",),
    "pipeline_applied": ("leaf",),
    "pipeline_not_applied": ("leaf",),
    "secret_in_store": ("path", "key"),
    "ec2_tag": ("name", "key", "value"),
    "health_continuous": ("host", "url"),
    "run_folder_used": (),
    "backup_kept": ("glob",),
    "backup_deleted": ("glob",),
    "knowledge_entry": ("file", "pattern"),
}
SCOPES = {"all", "diagnostic_commands", "final_answer"}
MODES = {"operate", "review", "cve"}


def list_ids() -> list[str]:
    """Return all scenario ids, sorted, from the scenario folders."""

    return sorted(
        path.parent.name
        for path in config.SCENARIOS_DIR.glob("s*/scenario.yaml")
    )


def load_scenario(scenario_id: str) -> dict[str, Any]:
    """Load one scenario by id."""

    file = config.SCENARIOS_DIR / scenario_id / "scenario.yaml"
    if not file.is_file():
        raise ValueError(f"unknown scenario: {scenario_id}")
    data = yaml.safe_load(file.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"scenario is not a mapping: {scenario_id}")
    return data


def _checks(data: dict[str, Any]) -> dict[str, Any]:
    return data.get("checks") or {}


def validate(data: dict[str, Any]) -> list[str]:
    """Return a list of problems; an empty list means the scenario is runnable."""

    problems: list[str] = []

    def need(value: Any, label: str) -> None:
        if value is None or value == "" or value == [] or value == {}:
            problems.append(f"missing {label}")

    need(data.get("id"), "id")
    if data.get("id") and not re.fullmatch(r"s\d\d-[a-z0-9-]+", str(data["id"])):
        problems.append(f"bad id: {data.get('id')}")
    need(data.get("title"), "title")
    topics = data.get("topics")
    need(topics, "topics")
    if topics is not None and not isinstance(topics, list):
        problems.append("topics must be a list")
    if data.get("mode") not in MODES:
        problems.append(f"bad mode: {data.get('mode')}")
    if not isinstance(data.get("autonomous"), bool):
        problems.append("autonomous must be a boolean")
    need(data.get("prompt"), "prompt")

    followups = data.get("followups") or []
    for index, item in enumerate(followups):
        when = item.get("when") if isinstance(item, dict) else None
        if not isinstance(item, dict) or "message" not in item:
            problems.append(f"followups[{index}] needs message")
        if not isinstance(when, dict) or not (
            "assistant_matches" in when or "after_turns" in when
        ):
            problems.append(f"followups[{index}].when needs assistant_matches or after_turns")
        if "assistant_matches" in when:
            try:
                re.compile(str(when["assistant_matches"]))
            except re.error as exc:
                problems.append(f"followups[{index}] bad regex: {exc}")
        if "after_turns" in when and not isinstance(when["after_turns"], int):
            problems.append(f"followups[{index}].after_turns must be an integer")

    setup = data.get("setup") or {}
    faults = (setup.get("faults") or [])
    try:
        from sandbox.faults import NAMES as FAULT_NAMES
    except ImportError:  # pragma: no cover - only when imported outside the package
        FAULT_NAMES = ()
    for fault in faults:
        name = fault["name"] if isinstance(fault, dict) else fault
        if name not in FAULT_NAMES:
            problems.append(f"unknown fault: {name}")

    checks = _checks(data)
    state = checks.get("state") or []
    scripted = len(state) + len(checks.get("transcript_forbid") or []) + len(
        checks.get("transcript_require") or []
    )
    for name in ("must_ask", "must_not_ask"):
        for pattern in ((checks.get("questions") or {}).get(name) or []):
            scripted += 1
            try:
                re.compile(str(pattern))
            except re.error as exc:
                problems.append(f"questions.{name} bad regex: {exc}")
    if scripted < 2:
        problems.append("fewer than two script-decidable checks")

    for index, spec in enumerate(state):
        kind = spec.get("kind")
        if kind not in STATE_KINDS:
            problems.append(f"state[{index}] unknown kind: {kind}")
            continue
        for field in STATE_KINDS[kind]:
            if field not in spec:
                problems.append(f"state[{index}] {kind} missing {field}")
        for field in ("pattern", "output_pattern"):
            if field in spec:
                try:
                    re.compile(str(spec[field]))
                except re.error as exc:
                    problems.append(f"state[{index}] bad {field} regex: {exc}")

    for group in ("transcript_forbid", "transcript_require"):
        for index, spec in enumerate(checks.get(group) or []):
            if "pattern" not in spec:
                problems.append(f"{group}[{index}] missing pattern")
            if spec.get("scope", "all") not in SCOPES:
                problems.append(f"{group}[{index}] bad scope: {spec.get('scope')}")
            try:
                re.compile(str(spec["pattern"]))
            except re.error as exc:
                problems.append(f"{group}[{index}] bad regex: {exc}")

    judge = str(checks.get("judge") or "")
    bullets = [line for line in judge.splitlines() if line.strip()]
    if not 3 <= len(bullets) <= 6:
        problems.append(f"judge needs 3 to 6 bullets, got {len(bullets)}")

    budget = data.get("budget") or {}
    if not isinstance(budget.get("max_turns"), int) or budget["max_turns"] < 1:
        problems.append("budget.max_turns must be a positive integer")
    if not isinstance(budget.get("max_minutes"), (int, float)) or budget["max_minutes"] < 1:
        problems.append("budget.max_minutes must be positive")
    return problems


def host_commands(data: dict[str, Any]) -> list[str]:
    """Return the read-only host commands a scenario asks the simulator to run."""

    return [
        str(spec["cmd"])
        for spec in _checks(data).get("state") or []
        if spec.get("kind") == "host_cmd"
    ]


def unsupported_commands(commands: list[str]) -> list[str]:
    """Return commands the host simulator cannot answer beyond its fallback."""

    import tempfile

    from sandbox.hostfs import HostFileStore, run_readonly
    from sandbox.runctx import HostRecord, RunContext

    if not commands:
        return []
    base = Path(tempfile.mkdtemp(prefix="aisre-probe-"))
    run = RunContext(run_id="probe", root=base)
    run.add_host(HostRecord(name="probe", ec2_name="probe", instance_id="i-probe", image="systemd", services=["probe"]))
    store = HostFileStore(base / "hosts")
    store.write("probe", "/probe/file", "alpha\nbeta\ngamma=1\n")
    unsupported: list[str] = []
    for command in commands:
        result = run_readonly(run, "probe", command)
        if result.stdout.startswith("(sandbox) simulated read-only command:"):
            unsupported.append(command)
    return unsupported


def validate_all() -> dict[str, list[str]]:
    """Validate every scenario and return id -> problems."""

    result: dict[str, list[str]] = {}
    for scenario_id in list_ids():
        try:
            result[scenario_id] = validate(load_scenario(scenario_id))
        except (ValueError, yaml.YAMLError) as exc:
            result[scenario_id] = [f"cannot load: {exc}"]
    return result


def main_list() -> int:
    """CLI body for `list`."""

    for scenario_id in list_ids():
        data = load_scenario(scenario_id)
        print(f"{scenario_id:32} {data.get('mode', '?'):8} {data.get('title', '')}")
    return 0


def main_validate(target: str | None) -> int:
    """CLI body for `validate [--all|ID]`."""

    if target in (None, "--all", "all"):
        results = validate_all()
    else:
        results = {target: validate(load_scenario(target))}
    unsupported_total: set[str] = set()
    failed = 0
    for scenario_id, problems in results.items():
        data = load_scenario(scenario_id)
        unsupported = unsupported_commands(host_commands(data))
        unsupported_total.update(unsupported)
        all_problems = list(problems)
        for command in unsupported:
            all_problems.append(f"unsupported host command: {command}")
        if all_problems:
            failed += 1
            print(f"FAIL {scenario_id}")
            for problem in all_problems:
                print(f"     - {problem}")
        else:
            print(f"OK   {scenario_id}")
    if unsupported_total:
        print(f"\n{len(unsupported_total)} unsupported host command(s) across the catalog")
    print(f"\n{len(results) - failed}/{len(results)} scenarios runnable")
    return 1 if failed else 0
