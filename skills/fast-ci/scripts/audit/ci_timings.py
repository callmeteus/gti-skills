#!/usr/bin/env python3
"""Collect and analyze CI timings from any CI system, standard library only.

Every collector writes the same normalized rows (one JSON object per job per run)
so the analysis does not care where the numbers came from:

    platform, run_id, job, event, ref, status, attempt,
    run_created (epoch s), queued (epoch s), started (epoch s), finished (epoch s),
    setup_s (seconds or null), approx (true when the source has no step detail)

Subcommands:

    collect github     --repo owner/name                     (uses the gh CLI and its login)
    collect gitea      --server URL --repo owner/name        (Gitea and Forgejo; token in GITEA_TOKEN or FORGEJO_TOKEN)
    collect woodpecker --server URL --repo-id N              (token in WOODPECKER_TOKEN)
    collect gitlab     --server URL --gitlab-project ID     (token in GITLAB_TOKEN)
    collect jenkins    --server URL --job path/to/job        (JENKINS_USER and JENKINS_TOKEN)
    collect k8s        --namespace NS --selector LABELS      (kubectl; Tekton, Argo, ARC, act_runner, any CI pod)
    record  --job NAME [--run ID] -- <command ...>           (manual CI: time a command and append a row)
    analyze <rows.jsonl|rows.csv ...> [--budgets file.json] [--price-per-minute X]

Rows go to ~/.gti/fast-ci/<project>/timings/, analyses to ~/.gti/fast-ci/<project>/audits/.
GTI_HOME replaces ~/.gti.
"""

from __future__ import annotations

import argparse
import base64
import csv
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.gti import gti_dir, project_name, stamp  # noqa: E402

FIELDS = ["platform", "run_id", "job", "event", "ref", "status", "attempt",
          "run_created", "queued", "started", "finished", "setup_s", "approx"]

DEFAULT_SETUP_PATTERN = (
    r"set ?up|checkout|clone|fetch|cache|restore|install|download|pull|prepare|"
    r"init|login|toolchain|dependencies|deps|^post |complete job|declarative: (agent|checkout)|"
    r"checkout scm|git"
)

DEFAULT_BUDGETS = {
    "time_to_result_p50": 60,
    "time_to_result_p95": 120,
    "waiting": 5,
    "setup": 15,
    "job": 35,
}


# ---------------------------------------------------------------- time helpers

def ts(value):
    """ISO 8601 string, epoch seconds, or epoch milliseconds to epoch seconds (float) or None."""
    if value is None or value == "" or value == 0:
        return None
    if isinstance(value, (int, float)):
        return float(value) / 1000.0 if value > 1e11 else float(value)
    text = str(value).strip()
    if re.fullmatch(r"\d+(\.\d+)?", text):
        return ts(float(text))
    if text.startswith("0001-01-01"):
        return None
    text = text.replace("Z", "+00:00")
    text = re.sub(r"\.(\d{6})\d+", r".\1", text)
    try:
        moment = datetime.fromisoformat(text)
    except ValueError:
        return None
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.timestamp()


def span(start, end):
    if start is None or end is None:
        return None
    return max(0.0, end - start)


def row(**values):
    out = {key: values.get(key) for key in FIELDS}
    out["approx"] = bool(values.get("approx", False))
    return out


def setup_seconds(steps, pattern):
    """Sum the steps whose name matches the setup pattern. steps: [(name, start, end)]."""
    if not steps:
        return None
    regex = re.compile(pattern, re.IGNORECASE)
    total = 0.0
    for name, start, end in steps:
        if regex.search(name or "") and start is not None and end is not None:
            total += max(0.0, end - start)
    return total


# ---------------------------------------------------------------- parsers (pure, tested)

def parse_github(runs, jobs_by_run, setup_pattern=DEFAULT_SETUP_PATTERN, platform="github"):
    """runs: workflow run objects; jobs_by_run: {run_id: [job objects]} (GitHub and Gitea share this shape)."""
    rows = []
    for run in runs:
        run_id = run.get("id")
        for job in jobs_by_run.get(run_id, jobs_by_run.get(str(run_id), [])):
            steps = [(s.get("name"), ts(s.get("started_at")), ts(s.get("completed_at")))
                     for s in job.get("steps") or []]
            rows.append(row(
                platform=platform, run_id=str(run_id), job=job.get("name"),
                event=run.get("event"), ref=run.get("head_branch"),
                status=job.get("conclusion") or job.get("status"),
                attempt=run.get("run_attempt") or job.get("run_attempt") or 1,
                run_created=ts(run.get("created_at")),
                queued=ts(job.get("created_at")) or ts(run.get("created_at")),
                started=ts(job.get("started_at")), finished=ts(job.get("completed_at")),
                setup_s=setup_seconds(steps, setup_pattern), approx=not steps,
            ))
    return rows


def parse_gitea_tasks(tasks, platform="forgejo"):
    """Forgejo and older Gitea expose only /actions/tasks: no steps, finish time approximated by updated_at."""
    rows = []
    for task in tasks:
        rows.append(row(
            platform=platform, run_id=str(task.get("run_number") or task.get("id")),
            job=task.get("name"), event=task.get("event"), ref=task.get("head_branch"),
            status=task.get("status"), attempt=1,
            run_created=ts(task.get("created_at")), queued=ts(task.get("created_at")),
            started=ts(task.get("run_started_at")), finished=ts(task.get("updated_at")),
            setup_s=None, approx=True,
        ))
    return rows


def parse_woodpecker(pipelines, setup_pattern=DEFAULT_SETUP_PATTERN):
    """pipelines: full pipeline objects from /api/repos/{id}/pipelines/{number} (workflows or legacy procs)."""
    rows = []
    for pipe in pipelines:
        created = ts(pipe.get("created"))
        workflows = pipe.get("workflows") or pipe.get("procs") or []
        for flow in workflows:
            children = flow.get("children") or []
            steps = [(c.get("name"), ts(c.get("started")), ts(c.get("finished") or c.get("stopped")))
                     for c in children]
            rows.append(row(
                platform="woodpecker", run_id=str(pipe.get("number") or pipe.get("id")),
                job=flow.get("name"), event=pipe.get("event"), ref=pipe.get("branch"),
                status=flow.get("state") or pipe.get("status"), attempt=1,
                run_created=created, queued=created,
                started=ts(flow.get("started") or flow.get("start_time")),
                finished=ts(flow.get("finished") or flow.get("end_time")),
                setup_s=setup_seconds(steps, setup_pattern), approx=not steps,
            ))
    return rows


def parse_gitlab(pipelines, jobs_by_pipeline):
    rows = []
    for pipe in pipelines:
        pid = pipe.get("id")
        for job in jobs_by_pipeline.get(pid, jobs_by_pipeline.get(str(pid), [])):
            created = ts(job.get("created_at"))
            started = ts(job.get("started_at"))
            queued = created
            if started is not None and job.get("queued_duration") is not None:
                queued = started - float(job["queued_duration"])
            rows.append(row(
                platform="gitlab", run_id=str(pid), job=job.get("name"),
                event=pipe.get("source"), ref=pipe.get("ref"), status=job.get("status"),
                attempt=2 if job.get("retried") else 1,
                run_created=ts(pipe.get("created_at")), queued=queued,
                started=started, finished=ts(job.get("finished_at")),
                setup_s=None, approx=True,
            ))
    return rows


def parse_jenkins(builds, job_name, setup_pattern=DEFAULT_SETUP_PATTERN):
    """builds: wfapi/describe objects. One row per build; setup is the stages that match the pattern."""
    rows = []
    for build in builds:
        start = ts(build.get("startTimeMillis"))
        queue = (build.get("queueDurationMillis") or 0) / 1000.0
        duration = (build.get("durationMillis") or 0) / 1000.0
        stages = [(s.get("name"), ts(s.get("startTimeMillis")),
                   (ts(s.get("startTimeMillis")) or 0) + (s.get("durationMillis") or 0) / 1000.0)
                  for s in build.get("stages") or []]
        created = start - queue if start is not None else None
        rows.append(row(
            platform="jenkins", run_id=str(build.get("id")), job=job_name, event=None, ref=None,
            status=build.get("status"), attempt=1, run_created=created, queued=created,
            started=start, finished=start + duration if start is not None else None,
            setup_s=setup_seconds(stages, setup_pattern), approx=not stages,
        ))
    return rows


def parse_k8s_pods(pods, run_label=None, job_label=None):
    """kubectl get pods -o json. waiting = creation to scheduled, setup = scheduled to first main container start
    (image pull and init containers), running = first main start to last main finish."""
    rows = []
    items = pods.get("items", []) if isinstance(pods, dict) else pods
    for pod in items:
        meta = pod.get("metadata") or {}
        labels = meta.get("labels") or {}
        status = pod.get("status") or {}
        created = ts(meta.get("creationTimestamp"))
        scheduled = None
        for cond in status.get("conditions") or []:
            if cond.get("type") == "PodScheduled" and cond.get("status") == "True":
                scheduled = ts(cond.get("lastTransitionTime"))
        main_starts, main_ends = [], []
        for cs in status.get("containerStatuses") or []:
            state = cs.get("state") or {}
            term = state.get("terminated") or {}
            running = state.get("running") or {}
            start = ts(term.get("startedAt") or running.get("startedAt"))
            if start is not None:
                main_starts.append(start)
            if term.get("finishedAt"):
                main_ends.append(ts(term["finishedAt"]))
        if not main_starts:
            continue
        first_main = min(main_starts)
        finished = max(main_ends) if main_ends else None
        name = meta.get("name") or ""
        job = labels.get(job_label) if job_label else None
        if not job:
            job = re.sub(r"(-[a-z0-9]{5}){1,2}$", "", name) or name
        run_id = labels.get(run_label) if run_label else None
        rows.append(row(
            platform="k8s", run_id=str(run_id or name), job=job, event=None, ref=None,
            status=status.get("phase"), attempt=1, run_created=created, queued=created,
            started=scheduled or first_main, finished=finished,
            setup_s=span(scheduled or first_main, first_main), approx=scheduled is None,
        ))
    return rows


# ---------------------------------------------------------------- analysis (pure, tested)

def percentile(values, pct):
    """Nearest-rank percentile."""
    data = sorted(v for v in values if v is not None)
    if not data:
        return None
    rank = max(1, int(-(-pct * len(data) // 100)))
    return data[min(rank, len(data)) - 1]


def job_parts(r):
    waiting = span(r.get("queued"), r.get("started"))
    total_run = span(r.get("started"), r.get("finished"))
    setup = r.get("setup_s")
    if setup is not None and total_run is not None:
        setup = min(setup, total_run)
        running = total_run - setup
    else:
        running = total_run
    return waiting, setup, running


def analyze(rows, budgets=None, price_per_minute=None):
    budgets = {**DEFAULT_BUDGETS, **(budgets or {})}
    runs = {}
    for r in rows:
        runs.setdefault((r.get("platform"), r.get("run_id")), []).append(r)

    run_results, critical = [], []
    for key, jobs in runs.items():
        if any(j.get("finished") is None for j in jobs):
            continue
        created = min((j.get("run_created") or j.get("queued") or j.get("started")) for j in jobs
                      if (j.get("run_created") or j.get("queued") or j.get("started")) is not None)
        end = max(j["finished"] for j in jobs)
        billable = sum((span(j.get("started"), j.get("finished")) or 0) for j in jobs)
        slowest = max(jobs, key=lambda j: j["finished"])
        run_results.append({"run": key, "time_to_result": end - created, "billable_s": billable,
                            "created": created, "attempt": max(int(j.get("attempt") or 1) for j in jobs),
                            "event": slowest.get("event")})
        critical.append(job_parts(slowest))

    per_job = {}
    for r in rows:
        if r.get("finished") is None:
            continue
        per_job.setdefault(r.get("job") or "?", []).append(job_parts(r) + (span(r.get("queued"), r.get("finished")),))

    jobs_table = []
    for name, parts in sorted(per_job.items()):
        entry = {"job": name, "count": len(parts)}
        for idx, label in enumerate(["waiting", "setup", "running", "total"]):
            values = [p[idx] for p in parts]
            entry[label + "_p50"] = percentile(values, 50)
            entry[label + "_p95"] = percentile(values, 95)
        jobs_table.append(entry)
    jobs_table.sort(key=lambda e: -(e["total_p95"] or 0))

    buckets = {}
    for idx, label in enumerate(["waiting", "setup", "running"]):
        buckets[label] = {"p50": percentile([c[idx] for c in critical], 50),
                          "p95": percentile([c[idx] for c in critical], 95)}
    biggest = max(buckets, key=lambda b: buckets[b]["p50"] or 0) if critical else None

    ttr = [r["time_to_result"] for r in run_results]
    summary = {
        "runs": len(run_results),
        "jobs": sum(len(v) for v in per_job.values()),
        "time_to_result_p50": percentile(ttr, 50),
        "time_to_result_p95": percentile(ttr, 95),
        "billable_minutes_per_run": (sum(r["billable_s"] for r in run_results) / len(run_results) / 60.0)
        if run_results else None,
        "rerun_share": (sum(1 for r in run_results if r["attempt"] > 1) / len(run_results)) if run_results else None,
        "approx_rows": sum(1 for r in rows if r.get("approx")),
    }
    if run_results:
        first, last = min(r["created"] for r in run_results), max(r["created"] for r in run_results)
        days = max(1.0, (last - first) / 86400.0)
        summary["runs_per_day"] = len(run_results) / days
        summary["billable_minutes_per_month"] = summary["billable_minutes_per_run"] * summary["runs_per_day"] * 30
        if price_per_minute is not None:
            summary["cost_per_month"] = summary["billable_minutes_per_month"] * float(price_per_minute)

    violations = []
    for metric in ("time_to_result_p50", "time_to_result_p95"):
        if summary.get(metric) is not None and summary[metric] > budgets[metric]:
            violations.append({"what": metric, "value": summary[metric], "budget": budgets[metric]})
    for entry in jobs_table:
        checks = [("waiting", entry["waiting_p50"]), ("setup", entry["setup_p50"]),
                  ("job", (entry["setup_p50"] or 0) + (entry["running_p50"] or 0))]
        per_job_budget = (budgets.get("per_job") or {}).get(entry["job"])
        for label, value in checks:
            limit = per_job_budget if (label == "job" and per_job_budget) else budgets[label]
            if value is not None and value > limit:
                violations.append({"what": "%s %s p50" % (entry["job"], label), "value": value, "budget": limit})

    return {"summary": summary, "buckets": buckets, "biggest_bucket": biggest,
            "jobs": jobs_table, "violations": violations, "budgets": budgets}


def fmt(seconds):
    if seconds is None:
        return "-"
    return "%.1fs" % seconds if seconds < 120 else "%.1fm" % (seconds / 60.0)


def render_markdown(result, sources):
    s = result["summary"]
    lines = ["# CI timing audit", "", "- **Sources:** " + ", ".join(sources),
             "- **Runs analyzed:** %d (%d job rows)" % (s["runs"], s["jobs"]),
             "- **Time to result:** p50 %s, p95 %s" % (fmt(s["time_to_result_p50"]), fmt(s["time_to_result_p95"])),
             "- **Billable minutes per run:** %s" % ("%.1f" % s["billable_minutes_per_run"]
                                                      if s.get("billable_minutes_per_run") is not None else "-")]
    if s.get("billable_minutes_per_month") is not None:
        lines.append("- **Billable minutes per month (estimated):** %.0f" % s["billable_minutes_per_month"])
    if s.get("cost_per_month") is not None:
        lines.append("- **Cost per month (estimated):** %.2f" % s["cost_per_month"])
    if s.get("rerun_share"):
        lines.append("- **Runs that needed a rerun:** %.0f%% (each one is a bug to find, not a retry to keep)"
                     % (s["rerun_share"] * 100))
    if s["approx_rows"]:
        lines.append("- **Rows without step detail:** %d (setup counted as running for these)" % s["approx_rows"])
    lines += ["", "## Critical path buckets", "",
              "The slowest job of each run, split into waiting, setup, and running. Fix the biggest bucket first.", "",
              "| Bucket | p50 | p95 |", "|--------|-----|-----|"]
    for name, vals in result["buckets"].items():
        mark = " (biggest)" if name == result["biggest_bucket"] else ""
        lines.append("| %s%s | %s | %s |" % (name, mark, fmt(vals["p50"]), fmt(vals["p95"])))
    lines += ["", "## Jobs, slowest p95 first", "",
              "| Job | Runs | Waiting p50/p95 | Setup p50/p95 | Running p50/p95 | Total p50/p95 |",
              "|-----|------|-----------------|---------------|-----------------|---------------|"]
    for j in result["jobs"]:
        lines.append("| %s | %d | %s / %s | %s / %s | %s / %s | %s / %s |" % (
            j["job"], j["count"], fmt(j["waiting_p50"]), fmt(j["waiting_p95"]), fmt(j["setup_p50"]),
            fmt(j["setup_p95"]), fmt(j["running_p50"]), fmt(j["running_p95"]), fmt(j["total_p50"]), fmt(j["total_p95"])))
    lines += ["", "## Over budget", ""]
    if result["violations"]:
        lines += ["| What | Value | Budget |", "|------|-------|--------|"]
        lines += ["| %s | %s | %s |" % (v["what"], fmt(v["value"]), fmt(v["budget"])) for v in result["violations"]]
    else:
        lines.append("Nothing over budget.")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------- network collectors

def http_json(url, headers=None):
    req = urllib.request.Request(url, headers={"Accept": "application/json", **(headers or {})})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def gh_api(path):
    if not shutil.which("gh"):
        raise SystemExit("gh CLI not found. Install it and run `gh auth login`, or export rows another way.")
    out = subprocess.run(["gh", "api", path], capture_output=True, text=True, check=False)
    if out.returncode != 0:
        raise SystemExit("gh api %s failed: %s" % (path, out.stderr.strip()))
    return json.loads(out.stdout)


def collect_github(args):
    runs, page = [], 1
    while len(runs) < args.limit:
        query = {"per_page": 100, "page": page}
        if args.branch:
            query["branch"] = args.branch
        if args.event:
            query["event"] = args.event
        data = gh_api("repos/%s/actions/runs?%s" % (args.repo, urllib.parse.urlencode(query)))
        batch = [r for r in data.get("workflow_runs", []) if r.get("status") == "completed"]
        if not data.get("workflow_runs"):
            break
        runs += batch
        page += 1
    runs = runs[: args.limit]
    jobs = {r["id"]: gh_api("repos/%s/actions/runs/%s/jobs?per_page=100" % (args.repo, r["id"])).get("jobs", [])
            for r in runs}
    return parse_github(runs, jobs, args.setup_pattern)


def collect_gitea(args):
    token = os.environ.get("GITEA_TOKEN") or os.environ.get("FORGEJO_TOKEN")
    headers = {"Authorization": "token " + token} if token else {}
    base = args.server.rstrip("/") + "/api/v1/repos/" + args.repo
    try:
        data = http_json(base + "/actions/runs?limit=%d" % min(args.limit, 50), headers)
        runs = (data.get("workflow_runs") or [])[: args.limit]
        jobs = {r["id"]: http_json(base + "/actions/runs/%s/jobs" % r["id"], headers).get("jobs", []) for r in runs}
        return parse_github(runs, jobs, args.setup_pattern, platform="gitea")
    except Exception:  # noqa: BLE001  older Gitea and Forgejo: fall back to tasks
        tasks, page = [], 1
        while len(tasks) < args.limit:
            data = http_json(base + "/actions/tasks?limit=50&page=%d" % page, headers)
            batch = data.get("workflow_runs") or data.get("tasks") or []
            if not batch:
                break
            tasks += batch
            page += 1
        return parse_gitea_tasks(tasks[: args.limit])


def collect_woodpecker(args):
    token = os.environ.get("WOODPECKER_TOKEN")
    headers = {"Authorization": "Bearer " + token} if token else {}
    base = args.server.rstrip("/") + "/api/repos/%s/pipelines" % args.repo_id
    numbers, page = [], 1
    while len(numbers) < args.limit:
        batch = http_json(base + "?page=%d&per_page=50" % page, headers)
        if not batch:
            break
        numbers += [p["number"] for p in batch if p.get("finished")]
        page += 1
    return parse_woodpecker([http_json(base + "/%s" % n, headers) for n in numbers[: args.limit]], args.setup_pattern)


def collect_gitlab(args):
    token = os.environ.get("GITLAB_TOKEN")
    headers = {"PRIVATE-TOKEN": token} if token else {}
    project = urllib.parse.quote(str(args.gitlab_project), safe="")
    base = args.server.rstrip("/") + "/api/v4/projects/" + project
    pipes, page = [], 1
    while len(pipes) < args.limit:
        batch = http_json(base + "/pipelines?per_page=100&page=%d&scope=finished" % page, headers)
        if not batch:
            break
        pipes += batch
        page += 1
    pipes = pipes[: args.limit]
    jobs = {p["id"]: http_json(base + "/pipelines/%s/jobs?per_page=100&include_retried=true" % p["id"], headers)
            for p in pipes}
    return parse_gitlab(pipes, jobs)


def collect_jenkins(args):
    headers = {}
    if os.environ.get("JENKINS_USER") and os.environ.get("JENKINS_TOKEN"):
        pair = "%s:%s" % (os.environ["JENKINS_USER"], os.environ["JENKINS_TOKEN"])
        headers["Authorization"] = "Basic " + base64.b64encode(pair.encode()).decode()
    job_path = "".join("/job/" + urllib.parse.quote(part) for part in args.job.strip("/").split("/"))
    base = args.server.rstrip("/") + job_path
    data = http_json(base + "/api/json?tree=builds[number,building]{0,%d}" % args.limit, headers)
    builds = [http_json(base + "/%s/wfapi/describe" % b["number"], headers)
              for b in data.get("builds", []) if not b.get("building")]
    return parse_jenkins(builds, args.job, args.setup_pattern)


def collect_k8s(args):
    if args.file:
        pods = json.loads(Path(args.file).read_text(encoding="utf-8"))
    else:
        if not shutil.which("kubectl"):
            raise SystemExit("kubectl not found. Install it or pass --file pods.json.")
        cmd = ["kubectl", "get", "pods", "-o", "json"]
        cmd += ["-A"] if args.namespace == "all" else ["-n", args.namespace]
        if args.selector:
            cmd += ["-l", args.selector]
        if args.context:
            cmd += ["--context", args.context]
        out = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if out.returncode != 0:
            raise SystemExit("kubectl failed: " + out.stderr.strip())
        pods = json.loads(out.stdout)
    return parse_k8s_pods(pods, args.run_label, args.job_label)


COLLECTORS = {"github": collect_github, "gitea": collect_gitea, "forgejo": collect_gitea,
              "woodpecker": collect_woodpecker, "gitlab": collect_gitlab, "jenkins": collect_jenkins,
              "k8s": collect_k8s, "k3s": collect_k8s}


# ---------------------------------------------------------------- io

def read_rows(paths):
    rows = []
    for path in paths:
        text = Path(path).read_text(encoding="utf-8")
        if str(path).endswith(".csv"):
            for raw in csv.DictReader(text.splitlines()):
                rows.append(row(**{k: (ts(v) if k in ("run_created", "queued", "started", "finished") else
                                       (float(v) if k == "setup_s" and v not in ("", None) else
                                        (v.lower() == "true" if k == "approx" else v if v != "" else None)))
                                   for k, v in raw.items() if k in FIELDS}))
        else:
            rows += [json.loads(line) for line in text.splitlines() if line.strip()]
    return rows


def write_rows(rows, path, append=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a" if append else "w", encoding="utf-8") as handle:
        for r in rows:
            handle.write(json.dumps(r) + "\n")
    return path


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--project", default=None, help="Project folder under ~/.gti/fast-ci/ (default: git root name)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    col = sub.add_parser("collect", help="Pull recent runs from a CI system into normalized rows")
    col.add_argument("platform", choices=sorted(COLLECTORS))
    col.add_argument("--limit", type=int, default=150, help="Runs to pull (default 150)")
    col.add_argument("--repo", help="owner/name (github, gitea, forgejo)")
    col.add_argument("--branch", help="Only runs for this branch (github)")
    col.add_argument("--event", help="Only runs for this event, for example pull_request (github)")
    col.add_argument("--server", help="Base URL (gitea, forgejo, woodpecker, gitlab, jenkins)")
    col.add_argument("--repo-id", help="Woodpecker repository id")
    col.add_argument("--gitlab-project", help="GitLab project id or path, for example group/app")
    col.add_argument("--job", help="Jenkins job path, for example folder/my-pipeline")
    col.add_argument("--namespace", default="default", help="k8s namespace, or 'all'")
    col.add_argument("--selector", help="k8s label selector for CI pods")
    col.add_argument("--context", help="kubectl context")
    col.add_argument("--run-label", help="k8s label that groups pods into one run, e.g. tekton.dev/pipelineRun")
    col.add_argument("--job-label", help="k8s label that names the job, e.g. tekton.dev/pipelineTask")
    col.add_argument("--file", help="k8s: read saved `kubectl get pods -o json` output instead of calling kubectl")
    col.add_argument("--setup-pattern", default=DEFAULT_SETUP_PATTERN, help="Regex for step names counted as setup")
    col.add_argument("--out", help="Output .jsonl path")

    rec = sub.add_parser("record", help="Manual CI: run a command, time it, append a row")
    rec.add_argument("--job", required=True)
    rec.add_argument("--run", default=None, help="Run id shared by the commands of one CI run (default: timestamp)")
    rec.add_argument("--setup", action="store_true", help="Count this command as setup for the job")
    rec.add_argument("--out", help="Output .jsonl path (default: timings/manual.jsonl)")
    rec.add_argument("command", nargs=argparse.REMAINDER)

    ana = sub.add_parser("analyze", help="p50 and p95 per bucket and job, budgets, cost")
    ana.add_argument("rows", nargs="+", help=".jsonl or .csv files with the normalized fields")
    ana.add_argument("--budgets", help="JSON file overriding the default budgets (seconds)")
    ana.add_argument("--price-per-minute", type=float, help="Runner price per minute, for the monthly cost")
    ana.add_argument("--out", help="Output folder (default: ~/.gti/fast-ci/<project>/audits)")

    args = parser.parse_args(argv)
    project = args.project or project_name()

    if args.cmd == "collect":
        needs = {"github": ["repo"], "gitea": ["server", "repo"], "forgejo": ["server", "repo"],
                 "woodpecker": ["server", "repo_id"], "gitlab": ["server", "gitlab_project"], "jenkins": ["server", "job"]}
        missing = [n for n in needs.get(args.platform, []) if not getattr(args, n, None)]
        if missing:
            parser.error("collect %s needs --%s" % (args.platform, " --".join(m.replace("_", "-") for m in missing)))
        rows = COLLECTORS[args.platform](args)
        out = Path(args.out) if args.out else gti_dir(project, "timings") / ("%s-%s.jsonl" % (args.platform, stamp()))
        write_rows(rows, out)
        print("%d job rows -> %s" % (len(rows), out))
        return 0

    if args.cmd == "record":
        command = args.command[1:] if args.command[:1] == ["--"] else args.command
        if not command:
            parser.error("record needs a command after --")
        run_id = args.run or os.environ.get("CI_RUN_ID") or stamp()
        start = time.time()
        code = subprocess.call(command)
        end = time.time()
        r = row(platform="manual", run_id=run_id, job=args.job, event="manual", ref=None,
                status="success" if code == 0 else "failure", attempt=1,
                run_created=start, queued=start, started=start, finished=end,
                setup_s=(end - start) if args.setup else 0.0)
        out = Path(args.out) if args.out else gti_dir(project, "timings") / "manual.jsonl"
        write_rows([r], out, append=True)
        print("%s: %.2fs (exit %d) -> %s" % (args.job, end - start, code, out), file=sys.stderr)
        return code

    rows = read_rows(args.rows)
    budgets = json.loads(Path(args.budgets).read_text(encoding="utf-8")) if args.budgets else None
    result = analyze(rows, budgets, args.price_per_minute)
    folder = Path(args.out) if args.out else gti_dir(project, "audits")
    folder.mkdir(parents=True, exist_ok=True)
    name = "ci-timings-" + stamp()
    (folder / (name + ".json")).write_text(json.dumps(result, indent=2, default=str), encoding="utf-8")
    md = folder / (name + ".md")
    md.write_text(render_markdown(result, [str(p) for p in args.rows]), encoding="utf-8")
    s = result["summary"]
    print("runs=%d p50=%s p95=%s biggest=%s over_budget=%d -> %s" % (
        s["runs"], fmt(s["time_to_result_p50"]), fmt(s["time_to_result_p95"]),
        result["biggest_bucket"], len(result["violations"]), md))
    return 0


if __name__ == "__main__":
    sys.exit(main())
