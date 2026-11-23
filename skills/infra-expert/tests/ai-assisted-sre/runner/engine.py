"""Orchestrate one or every scenario run on the notebook."""

from __future__ import annotations

import json
import os
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from . import agent, config, credentials, report, scenarios
from checks import evaluate as evaluate_checks
from checks.base import RunArtifacts, normalize_transcript
from checks.judge import build_prompt as build_judge_prompt


def _load_json(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines()
        if line.strip()
    ]


def _health_sampler(a_run: Any, host: str, url: str, stop: threading.Event, samples: list[dict[str, Any]]) -> None:
    """Sample one health endpoint every second while the agent works."""

    from sandbox.hostfs import run_readonly

    record = a_run.host(host)
    if record is None:
        samples.append({"host": host, "url": url, "ok": False, "reason": "unknown host"})
        return
    command = f'curl -fsS -o /dev/null -w "%{{http_code}}" {url}'
    while not stop.is_set():
        try:
            result = run_readonly(a_run, record.name, command)
            ok = result.exit_code == 0 and "200" in result.stdout
            samples.append({"ts": time.time(), "host": host, "url": url, "ok": ok})
        except Exception as exc:  # a broken probe is a failed sample, not a crash
            samples.append({"ts": time.time(), "host": host, "url": url, "ok": False, "reason": type(exc).__name__})
        stop.wait(1.0)


def write_status(run_dir: Path, state: str, **extra: Any) -> dict[str, Any]:
    """Publish a small status document for `remote status` to read.

    A detached run can be polled while it works, and the file also records a
    verdict when the run finishes. Writing it atomically keeps a reader from
    seeing a half-updated document.
    """

    path = Path(run_dir) / "status.json"
    data: dict[str, Any] = {
        "state": state,
        "updated": datetime.now(timezone.utc).isoformat(),
        "pid": os.getpid(),
    }
    data.update(extra)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(".status.json.tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(tmp, path)
    return data


def _match_followup(followup: dict[str, Any], latest: str, turns: int) -> bool:
    when = followup.get("when") or {}
    if "assistant_matches" in when:
        try:
            return re.search(str(when["assistant_matches"]), latest, re.IGNORECASE) is not None
        except re.error:
            return False
    if "after_turns" in when:
        return turns >= int(when["after_turns"])
    return True


def run_one(
    scenario_id: str,
    model: str,
    judge_model: str,
    *,
    run_id: str | None = None,
    keep: bool = False,
    root: Path | None = None,
) -> dict[str, Any]:
    """Prepare, drive, check and report one scenario. Returns its result dict."""

    from sandbox.fake_secrets import SecretStore
    from sandbox.fixtures import destroy_hosts, prepare_run
    from sandbox.ministack import MiniStackClient

    started_dt = datetime.now(timezone.utc)
    started = time.monotonic()
    scenario = scenarios.load_scenario(scenario_id)
    rid = run_id or config.claude_style_run_id(scenario_id)
    base = Path(root) if root else config.runs_root()
    rdir = base / rid
    rdir.mkdir(parents=True, exist_ok=True)
    (rdir / "scenario.yaml").write_text(
        json.dumps(scenario, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    result: dict[str, Any] = {
        "run_id": rid,
        "scenario_id": scenario_id,
        "scenario": scenario,
        "agent": "opencode",
        "model": model,
        "judge_model": judge_model,
        "started": started_dt.isoformat(),
        "turns": 0,
        "swept_credentials": swept,
    }
    write_status(rdir, "running", run_id=rid, scenario_id=scenario_id, model=model)
    container: str | None = None
    health_stop = threading.Event()
    health_samples: list[dict[str, Any]] = []
    credential = rdir / "auth.json"
    run_ctx = None
    # A dropped SSH session, a timeout or a killed process must not leave a
    # provider credential behind. The guard covers every exit path; the sweep
    # also clears files orphaned by runs that died before any guard existed.
    swept = credentials.sweep(base)
    guard = credentials.protect(credential)

    try:
        # 1. Prepare the repo and the run state (hosts, files, secrets, faults).
        repo = agent.build_repo(rdir, scenario)
        baseline = agent.snapshot_repo(repo)
        run_ctx = prepare_run(scenario, rid, root=base, client=MiniStackClient.from_env())
        result["hosts_created"] = len(run_ctx.hosts)

        # 2. Start the health samplers before the agent begins work.
        for spec in ((scenario.get("checks") or {}).get("state") or []):
            if spec.get("kind") == "health_continuous":
                thread = threading.Thread(
                    target=_health_sampler,
                    args=(run_ctx, str(spec["host"]), str(spec["url"]), health_stop, health_samples),
                    daemon=True,
                )
                thread.start()

        # 3. Start the agent container and drive the scripted conversation.
        container = agent.start_container(rid, rdir, model, judge_model, credential if credential.exists() else None)
        result["container"] = container
        budget = scenario.get("budget") or {}
        max_turns = int(budget.get("max_turns", 40))
        deadline = started + float(budget.get("max_minutes", 30)) * 60

        prompt = str(scenario["prompt"])
        followups = list(scenario.get("followups") or [])
        autonomous = bool(scenario.get("autonomous"))
        if autonomous:
            followups = []
        turn = 0
        latest = ""
        while turn < max_turns and time.monotonic() < deadline:
            if turn == 0:
                message = prompt
            elif followups:
                chosen = next(
                    (item for item in followups if _match_followup(item, latest, turn)),
                    None,
                )
                if chosen is None:
                    chosen = followups[0]
                followups.remove(chosen)
                message = str(chosen["message"])
            else:
                break
            turn += 1
            events_path = agent.send_turn(rdir, turn, message, max(30.0, deadline - time.monotonic()))
            latest = agent.turn_text(agent.read_events(events_path))
            result["turns"] = turn
            if not agent.driver_health(container):
                result["agent_exit"] = "container stopped before the budget was reached"
                break

        transcript_path = agent.request_export(rdir, max(30.0, deadline - time.monotonic()))
        export = json.loads(transcript_path.read_text(encoding="utf-8"))
        transcript = normalize_transcript(export)
        (rdir / "transcript.json").write_text(
            json.dumps(transcript, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )

        artifacts = RunArtifacts(
            scenario=scenario,
            run_id=rid,
            root=rdir,
            run=run_ctx,
            repo=repo,
            transcript=transcript,
            mcp_log=_load_json(rdir / "mcp.jsonl"),
            pipeline_log=_load_json(rdir / "pipeline.jsonl"),
            secret_values=SecretStore(rdir / "secrets.json").fixture_values(),
            repo_baseline=baseline,
            health_samples=list(health_samples),
            container_running=agent.driver_health(container),
        )

        judge_text = agent.request_judge(rdir, build_judge_prompt(artifacts), max(60.0, deadline - time.monotonic()))
        graded = evaluate_checks(artifacts, lambda _prompt: judge_text)
    except Exception as exc:  # a failed or crashed runner is reported, never hidden
        graded = {
            "verdict": "FAIL",
            "scripted_ok": False,
            "judge_ok": False,
            "checks": [{"name": "runner", "kind": "runner", "passed": False, "detail": f"{type(exc).__name__}: {exc}"}],
            "judge": [],
        }
        result["runner_error"] = f"{type(exc).__name__}: {exc}"
        transcript = []
    finally:
        guard.close()
        health_stop.set()
        if container is not None:
            agent.stop_container(container, rdir, keep)
        if credential.exists():
            credential.unlink()  # model credential never survives the run
        if run_ctx is not None and not keep:
            try:
                destroy_hosts(run_ctx, client=MiniStackClient.from_env())
            except Exception as exc:
                result["teardown_error"] = f"{type(exc).__name__}: {exc}"

    result.update(graded)
    finished_dt = datetime.now(timezone.utc)
    result["finished"] = finished_dt.isoformat()
    result["duration_s"] = time.monotonic() - started
    result["transcript_path"] = str(rdir / "transcript.json")
    result["mcp_log_path"] = str(rdir / "mcp.jsonl")
    result["pipeline_log_path"] = str(rdir / "pipeline.jsonl")
    report.write_report(rdir, result)
    write_status(
        rdir, "finished", run_id=rid, scenario_id=scenario_id,
        verdict=result.get("verdict"), error=result.get("runner_error"),
    )
    return result


def _pid_alive(pid: Any) -> bool:
    """Whether a recorded runner process is still alive."""

    try:
        os.kill(int(pid), 0)
        return True
    except (TypeError, ValueError, ProcessLookupError):
        return False
    except PermissionError:
        return True


def cleanup_run(run_id: str, root: Path | None = None) -> dict[str, Any]:
    """Tear down one leftover run: guests, agent container and credential."""

    from sandbox.fixtures import destroy_hosts
    from sandbox.ministack import MiniStackClient
    from sandbox.runctx import RunContext

    base = Path(root) if root else config.runs_root()
    rdir = base / run_id
    outcome: dict[str, Any] = {"run_id": run_id, "removed": False, "errors": []}
    context_file = rdir / "context.json"
    if context_file.is_file():
        try:
            run = RunContext.load(run_id, root=rdir)
            outcome["terminated"] = destroy_hosts(run, client=MiniStackClient.from_env())
            outcome["removed"] = True
        except Exception as exc:
            outcome["errors"].append(f"guests: {type(exc).__name__}: {exc}")
    name = f"ai-sre-{run_id}"
    try:
        agent.docker("rm", "-f", name, check=False, timeout=60)
    except Exception as exc:
        outcome["errors"].append(f"container: {type(exc).__name__}: {exc}")
    outcome["credential_deleted"] = credentials.delete(rdir / "auth.json")
    status = write_status(rdir, "cleaned", run_id=run_id, **outcome)
    outcome["status"] = status
    return outcome


def cleanup_all(root: Path | None = None) -> list[dict[str, Any]]:
    """Clean every run directory whose runner is no longer alive."""

    base = Path(root) if root else config.runs_root()
    results: list[dict[str, Any]] = []
    if not base.is_dir():
        return results
    for rdir in sorted(base.iterdir()):
        if not rdir.is_dir() or not (rdir / "status.json").is_file():
            continue
        try:
            status = json.loads((rdir / "status.json").read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            status = {}
        if status.get("state") == "running" and _pid_alive(status.get("pid")):
            continue
        results.append(cleanup_run(rdir.name, root=base))
    return results


def run_all(model: str, judge_model: str, *, keep: bool = False) -> list[dict[str, Any]]:
    """Run every scenario in the catalog and return the results."""

    results: list[dict[str, Any]] = []
    for scenario_id in scenarios.list_ids():
        print(f"=== {scenario_id} ===", flush=True)
        result = run_one(scenario_id, model, judge_model, keep=keep)
        results.append(result)
        print(f"{result['verdict']}: {len(result['checks'])} checks", flush=True)
    return results
