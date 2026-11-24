#!/usr/bin/env python3
"""Skill Distill run manager: the deterministic half of the teacher and student loop.

The teacher (the agent following SKILL.md) decides what goes in the student skill and judges results.
This script does the bookkeeping that must not drift between iterations:

  smoke     run a one-minute task through the student harness, before any run exists
  init      create a run: reference summary, frozen prompt, starting state, empty student skill
  trial     freeze the current skill as iteration N and start K student sessions in tmux
  status    show which trials are still running
  wait      block until an iteration's trials exit (or timeout)
  evidence  collect what each trial produced: trace summary, files, diff, checks.sh output
  verdict   record the teacher's judgement of one trial in the ledger
  ledger    print the ledger
  report    write report.html: reference and trials side by side, for the user's pass or fail call
  accept    record the user's decision and copy the accepted skill to final/
  list      list the runs of this project

RUN is a task name or a path. A task name resolves to ~/.gti/skill-distill/<project>/runs/<task>/
(GTI_HOME replaces ~/.gti; <project> is the git root folder name of the current folder, or --project).

Students are started through the shared agent runner in scripts/agent/agent_run.py (synced from
packages/python/agent-runner), which knows each harness's flags.

Run layout:
  run.json          settings          prompt.md        the original task prompt, verbatim
  base/             snapshot of an uncommitted starting state (only with --base <repo>@worktree)
  reference/        reference.md, reference.json, evidence/
  skill/            the student skill being edited (SKILL.md, scripts/, references/)
  acceptance.md     what "as good as the reference" means, written by the teacher
  checks.sh         optional task checks; gets WORKSPACE, OUT; exit 0 = pass
  iters/NN/skill/   frozen copy of the skill used for iteration NN
  iters/NN/tK/      workspace/, trace/, prompt.md, run.sh, exit_code, evidence/, verdict.json
  ledger.jsonl      one line per verdict, and the user's decisions
  final/<name>/     the accepted skill
"""
import argparse
import datetime as dt
import html
import json
import os
import shlex
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

SKILL_ID = "skill-distill"
HERE = Path(__file__).resolve().parent
SKILL_DIR = HERE.parent.parent
AGENT = HERE.parent / "agent"
RUNNER = AGENT / "agent_run.py"
TEMPLATE = SKILL_DIR / "assets" / "templates" / "student-skill.md"
EXTRACT = AGENT / "extract_session.py"
SKILL_POINTER = ("\n\n---\nA skill for this task is at `.skill/{name}/SKILL.md` in this folder. "
                 "Read all of it before you start, and follow it.\n")
GIT_ID = ["-c", "user.name=skill-distill", "-c", "user.email=skill-distill@localhost"]


def gti_root():
    """~/.gti, or GTI_HOME. Generated files never go into the user's repository."""
    return Path(os.environ.get("GTI_HOME") or Path.home() / ".gti").expanduser()


def gti_dir(skill, *parts):
    """Folder for generated files: ~/.gti/<skill>/... (GTI_HOME replaces ~/.gti). Never the user's repository."""
    folder = gti_root().joinpath(skill, *parts)
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def project_name(start=None):
    """Name of the project being worked on: the git root's folder name, or the current folder's."""
    here = Path(start or Path.cwd()).resolve()
    for folder in (here, *here.parents):
        if (folder / ".git").exists():
            return folder.name or "project"
    return here.name or "project"


def runs_root(project=None):
    return gti_root() / SKILL_ID / (project or project_name()) / "runs"


def resolve_run(arg, project=None):
    """A bare task name lives under ~/.gti/skill-distill/<project>/runs/; anything path-like is used as given."""
    if os.sep in arg or "/" in arg or arg.startswith((".", "~")):
        return Path(arg).expanduser().resolve()
    return runs_root(project) / arg


def now():
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def sh(cmd, **kw):
    kw.setdefault("timeout", 600)
    return subprocess.run(cmd, shell=isinstance(cmd, str), capture_output=True, text=True, **kw)


def git(args, cwd, **kw):
    return sh(["git", *GIT_ID, *args], cwd=cwd, **kw)


def load(run):
    p = Path(run) / "run.json"
    if not p.exists():
        raise SystemExit(f"no run at {run} (run.json missing)")
    return json.loads(p.read_text())


def save(run, cfg):
    (Path(run) / "run.json").write_text(json.dumps(cfg, indent=2))


def iter_dir(run, n):
    return Path(run) / "iters" / f"{n:02d}"


def last_iter(run):
    d = Path(run) / "iters"
    ns = [int(p.name) for p in d.iterdir() if p.name.isdigit()] if d.exists() else []
    return max(ns) if ns else 0


def parse_student(spec):
    """harness:model. harness is an id from scripts/agent/harnesses.json, or script:<path> (or a .sh path)."""
    if spec.startswith("script:"):
        path, _, model = spec[len("script:"):].partition(":")
        harness = "script:" + str(Path(path).expanduser().resolve())
    else:
        harness, _, model = spec.partition(":")
        if harness.endswith(".sh") or os.sep in harness or "/" in harness:
            harness = "script:" + str(Path(harness).expanduser().resolve())
    sys.path.insert(0, str(AGENT))
    try:
        import agent_run
    finally:
        sys.path.pop(0)
    name, _ = agent_run.resolve(harness)
    return name, harness, model


def snapshot_worktree(repo, dest):
    """Copy repo into dest and commit its uncommitted changes there. The user's repository is not touched."""
    repo = Path(repo).resolve()
    r = sh(["git", "clone", "-q", "--no-hardlinks", str(repo), str(dest)])
    if r.returncode:
        raise SystemExit(f"clone failed: {r.stderr}")
    head = sh(["git", "rev-parse", "HEAD"], cwd=repo).stdout.strip()
    git(["checkout", "-q", head], cwd=dest)
    changed = sh(["git", "ls-files", "-z", "-m", "-o", "--exclude-standard"], cwd=repo).stdout.split("\0")
    deleted = sh(["git", "ls-files", "-z", "-d"], cwd=repo).stdout.split("\0")
    for rel in filter(None, deleted):
        (Path(dest) / rel).unlink(missing_ok=True)
    for rel in filter(None, changed):
        src, dst = repo / rel, Path(dest) / rel
        if src.is_file():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
    git(["add", "-A"], cwd=dest)
    git(["commit", "-q", "--allow-empty", "-m", "skill-distill: uncommitted starting state"], cwd=dest)
    return sh(["git", "rev-parse", "HEAD"], cwd=dest).stdout.strip()


def start_ref(cfg, ws):
    """The commit a workspace started from, for diffs."""
    if cfg["base"]["kind"] == "git":
        return cfg["base"]["ref"]
    out = sh(["git", "rev-list", "--max-parents=0", "HEAD"], cwd=ws).stdout.split()
    return out[0] if out else "HEAD"


def make_workspace(cfg, dest):
    """Copy the starting state into dest. base = git repo + ref, or 'empty'."""
    dest = Path(dest)
    base = cfg["base"]
    if base["kind"] == "empty":
        dest.mkdir(parents=True)
        git(["init", "-q"], cwd=dest)
        git(["commit", "-q", "--allow-empty", "-m", "start"], cwd=dest)
    else:
        r = sh(["git", "clone", "-q", "--no-hardlinks", base["path"], str(dest)])
        if r.returncode:
            raise SystemExit(f"clone failed: {r.stderr}")
        r = git(["checkout", "-q", base["ref"]], cwd=dest)
        if r.returncode:
            raise SystemExit(f"checkout {base['ref']} failed: {r.stderr}")
        git(["remote", "remove", "origin"], cwd=dest)
    if cfg.get("setup"):
        r = sh(cfg["setup"], cwd=dest, timeout=1800)
        if r.returncode:
            raise SystemExit(f"setup failed in {dest}:\n{r.stdout}\n{r.stderr}")


def runner_args(cfg):
    """Flags for agent_run.py shared by smoke and trials: harness, model, extra args, and environment."""
    args = ["--harness", cfg["harness"]]
    if cfg["model"]:
        args += ["--model", cfg["model"]]
    if cfg["student_args"]:
        args.append("--extra-args=" + cfg["student_args"])  # = keeps argparse from reading "-c ..." as a flag
    for k, v in cfg["env"].items():
        args += ["--env", f"{k}={v}"]
    return args


def cmd_smoke(a):
    name, harness, model = parse_student(a.student)
    cfg = {"harness": harness, "model": model, "student_args": a.student_args or "",
           "env": dict(kv.split("=", 1) for kv in a.env or [])}
    root = Path(tempfile.mkdtemp(prefix=dt.datetime.now().strftime("%Y%m%d-%H%M%S-"),
                                 dir=gti_dir(SKILL_ID, a.project or project_name(), "smoke")))
    r = subprocess.run([sys.executable, str(RUNNER), "smoke", *runner_args(cfg), "--isolate",
                        "--timeout", str(a.timeout), "--out", str(root)])
    if r.returncode:
        raise SystemExit("smoke test failed: fix the model id, key, server, or --student-args before any run")


def cmd_init(a):
    run = resolve_run(a.run, a.project)
    run.mkdir(parents=True, exist_ok=True)
    if (run / "run.json").exists() and not a.force:
        raise SystemExit(f"{run}/run.json exists (use --force)")
    harness_name, harness, model = parse_student(a.student)
    if a.base == "empty":
        base = {"kind": "empty"}
    else:
        path, _, ref = a.base.partition("@")
        path = str(Path(path).expanduser().resolve())
        if ref == "worktree":
            if (run / "base").exists():
                shutil.rmtree(run / "base")
            ref = snapshot_worktree(path, run / "base")
            path = str(run / "base")
        else:
            ref = ref or sh(["git", "rev-parse", "HEAD"], cwd=path).stdout.strip()
            r = sh(["git", "rev-parse", "--verify", f"{ref}^{{commit}}"], cwd=path)
            if r.returncode:
                raise SystemExit(f"{ref} is not a commit in {path}")
            ref = r.stdout.strip()
        base = {"kind": "git", "path": path, "ref": ref}
    name = a.name or "reproduce-" + run.name
    cfg = {"created": now(), "name": name, "harness_name": harness_name, "harness": harness, "model": model,
           "student_args": a.student_args or "", "env": dict(kv.split("=", 1) for kv in a.env or []),
           "base": base, "setup": a.setup or "", "tmux": a.tmux or f"distill-{run.name}",
           "timeout_min": a.timeout_min, "reference_log": "",
           "reference_workspace": str(Path(a.reference_workspace).resolve()) if a.reference_workspace else ""}
    if Path(a.prompt).resolve() != (run / "prompt.md").resolve():
        shutil.copy(a.prompt, run / "prompt.md")
    (run / "reference").mkdir(exist_ok=True)
    if a.reference in ("claude", "codex", "omp"):
        sys.path.insert(0, str(EXTRACT.parent))
        from extract_session import current
        a.reference = current(a.reference, a.reference_workspace or os.getcwd())
        print(f"reference session: {a.reference}")
    if a.reference:
        r = sh([sys.executable, str(EXTRACT), a.reference, "-o", str(run / "reference/reference.md"),
                "--json", str(run / "reference/reference.json")])
        print(r.stdout.strip() or r.stderr.strip())
        cfg["reference_log"] = str(Path(a.reference).resolve())
    skill = run / "skill"
    if not skill.exists():
        skill.mkdir()
        (skill / "SKILL.md").write_text(TEMPLATE.read_text().replace("{{name}}", name)
                                        .replace("{{model}}", model or "the default model")
                                        .replace("{{harness}}", harness_name))
    save(run, cfg)
    print(f"run ready: {run}\n  student: {harness_name} / {model}\n  base:    {base.get('path', 'empty')}"
          f"{'@' + base['ref'][:12] if base.get('ref') else ''}\n  skill:   {skill}/SKILL.md (edit this)")


def cmd_trial(a):
    run = resolve_run(a.run, a.project)
    cfg = load(run)
    if not shutil.which("tmux"):
        raise SystemExit("tmux is not on PATH; run scripts/setup/doctor.py")
    n = a.iter or last_iter(run) + 1
    it = iter_dir(run, n)
    if it.exists():
        raise SystemExit(f"{it} exists; use a new --iter")
    shutil.copytree(run / "skill", it / "skill")
    session = cfg["tmux"]
    q = shlex.quote
    if sh(["tmux", "has-session", "-t", session], timeout=10).returncode:
        (run / "ledger.jsonl").touch()
        sh(["tmux", "new-session", "-d", "-s", session, "-n", "ledger", f"tail -F {q(str(run / 'ledger.jsonl'))}"],
           timeout=10)
    prompt = (run / "prompt.md").read_text().rstrip() + SKILL_POINTER.format(name=cfg["name"])
    for k in range(1, a.k + 1):
        t = it / f"t{k}"
        make_workspace(cfg, t / "workspace")
        shutil.copytree(it / "skill", t / "workspace" / ".skill" / cfg["name"])
        with open(t / "workspace" / ".git" / "info" / "exclude", "a") as f:
            f.write("\n.skill/\n")
        (t / "trace").mkdir()
        (t / "prompt.md").write_text(prompt)
        secs = int(cfg["timeout_min"] * 60)
        spawn = [sys.executable, str(RUNNER), "spawn", *runner_args(cfg), "--cwd", str(t / "workspace"),
                 "--prompt-file", str(t / "prompt.md"), "--trace", str(t / "trace" / "session.jsonl"),
                 "--result", str(t / "agent.json"), "--timeout", str(secs), "--yolo", "--isolate"]
        stamp = "date -u +%Y-%m-%dT%H:%M:%SZ"
        (t / "run.sh").write_text(f"""#!/usr/bin/env bash
{stamp} > {q(str(t / 'started_at'))}
{' '.join(q(x) for x in spawn)} 2>&1 | tee {q(str(t / 'stdout.log'))}
echo ${{PIPESTATUS[0]}} > {q(str(t / 'exit_code'))}
{stamp} > {q(str(t / 'ended_at'))}
echo "== trial done (exit $(cat {q(str(t / 'exit_code'))})) =="
""")
        win = f"i{n:02d}-t{k}"
        r = sh(["tmux", "new-window", "-d", "-t", session, "-n", win, f"bash {q(str(t / 'run.sh'))}; sleep 86400"],
               timeout=10)
        if r.returncode:
            raise SystemExit(f"tmux failed: {r.stderr}")
        print(f"started {session}:{win}  ->  {t}")
    print(f"iteration {n}: {a.k} trials running; watch with: tmux attach -t {session}")


def trial_dirs(run, n):
    d = iter_dir(run, n)
    return sorted(p for p in d.glob("t*") if p.is_dir()) if d.exists() else []


def state(t):
    if (t / "exit_code").exists():
        return f"exit {(t / 'exit_code').read_text().strip()}"
    return "running" if (t / "started_at").exists() else "pending"


def cmd_status(a):
    run = resolve_run(a.run, a.project)
    n = a.iter or last_iter(run)
    ts = trial_dirs(run, n)
    if not ts:
        print(f"no trials yet in {run}")
    for t in ts:
        log = t / "stdout.log"
        tail = log.read_text(errors="replace").strip().splitlines()[-1:] if log.exists() else []
        print(f"i{n:02d}/{t.name}: {state(t):10} {tail[0][:120] if tail else ''}")


def cmd_wait(a):
    run = resolve_run(a.run, a.project)
    n = a.iter or last_iter(run)
    deadline = time.time() + a.timeout
    while True:
        ts = trial_dirs(run, n)
        if ts and all((t / "exit_code").exists() for t in ts):
            cmd_status(a)
            return
        if time.time() > deadline:
            cmd_status(a)
            raise SystemExit(2)
        time.sleep(15)


def collect(ws, out, checks, start, trace=None):
    out.mkdir(parents=True, exist_ok=True)
    files = sh("git ls-files --others --cached --exclude-standard | grep -v '^.skill/' | head -400", cwd=ws).stdout
    (out / "files.txt").write_text(files)
    diff = sh(["git", "diff", "--stat", start], cwd=ws).stdout
    status = sh("git status --short | grep -v '^?? .skill/' | head -200", cwd=ws).stdout
    (out / "diffstat.txt").write_text(f"since {start}:\n{diff}\nstatus:\n{status}")
    if trace and trace.exists() and trace.stat().st_size:
        r = sh([sys.executable, str(EXTRACT), str(trace), "-o", str(out / "trace.md"),
                "--json", str(out / "trace.json")])
        if r.returncode:
            (out / "trace.md").write_text(f"could not parse trace: {r.stderr}")
    result = None
    if checks.exists():
        env = {**os.environ, "WORKSPACE": str(ws), "OUT": str(out)}
        try:
            r = subprocess.run(["bash", str(checks)], cwd=ws, env=env, capture_output=True, text=True, timeout=1800)
            (out / "checks.log").write_text(r.stdout + "\n--- stderr ---\n" + r.stderr)
            result = r.returncode
        except subprocess.TimeoutExpired:
            (out / "checks.log").write_text("checks.sh timed out after 1800 s")
            result = 124
    (out / "summary.json").write_text(json.dumps({"files": len(files.splitlines()), "checks_exit": result}))
    return result


def cmd_evidence(a):
    run = resolve_run(a.run, a.project)
    cfg = load(run)
    checks = run / "checks.sh"
    if a.reference:
        ws = Path(a.reference if isinstance(a.reference, str) else cfg["reference_workspace"])
        if not str(ws) or not ws.exists():
            raise SystemExit("no reference workspace: pass --reference <dir> or init with --reference-workspace")
        rc = collect(ws, run / "reference" / "evidence", checks, start_ref(cfg, ws))
        print(f"reference: checks exit {rc}  ->  {run}/reference/evidence")
        if checks.exists() and rc != 0:
            print("the checks fail on the reference: fix checks.sh before judging any trial")
        return
    n = a.iter or last_iter(run)
    for t in trial_dirs(run, n):
        ws = t / "workspace"
        rc = collect(ws, t / "evidence", checks, start_ref(cfg, ws), t / "trace" / "session.jsonl")
        tj = t / "evidence" / "trace.json"
        s = json.loads(tj.read_text()) if tj.exists() else {}
        print(f"i{n:02d}/{t.name}: {state(t)}  checks exit {rc}  tool calls {s.get('tool_calls', '?')}  "
              f"errors {s.get('tool_errors', '?')}  ->  {t}/evidence")


def ledger_add(run, row):
    with open(Path(run) / "ledger.jsonl", "a") as f:
        f.write(json.dumps({"at": now(), **row}) + "\n")


def cmd_verdict(a):
    run = resolve_run(a.run, a.project)
    t = iter_dir(run, a.iter) / f"t{a.trial}"
    if not t.exists():
        raise SystemExit(f"no trial {t}")
    if not 0 <= a.score <= 10:
        raise SystemExit("--score must be between 0 and 10")
    row = {"kind": "verdict", "iter": a.iter, "trial": a.trial, "verdict": a.verdict, "score": a.score,
           "first_divergence": a.divergence or "", "note": a.note or "", "fix": a.fix or ""}
    (t / "verdict.json").write_text(json.dumps(row, indent=2))
    ledger_add(run, row)
    print(f"recorded i{a.iter:02d}/t{a.trial}: {a.verdict} {a.score}")


def rows(run):
    p = Path(run) / "ledger.jsonl"
    return [json.loads(line) for line in p.read_text().splitlines() if line.strip()] if p.exists() else []


def cmd_ledger(a):
    run = resolve_run(a.run, a.project)
    print(f"{'iter':>4} {'trial':>5} {'verdict':8} {'score':>5}  first divergence / note")
    for r in rows(run):
        if r["kind"] == "verdict":
            print(f"{r['iter']:>4} {r['trial']:>5} {r['verdict']:8} {r['score']:>5}  "
                  f"{r['first_divergence'] or r['note']}"[:200])
        else:
            print(f"user decision on iter {r.get('iter')}: {r.get('decision')}  {r.get('note', '')}")
    best = {}
    for r in rows(run):
        if r["kind"] == "verdict":
            best[r["iter"]] = max(best.get(r["iter"], 0), r["score"])
    if best:
        print("best score per iteration: " + ", ".join(f"{i}: {s}" for i, s in sorted(best.items())))


def imgs(d):
    return sorted([*Path(d).glob("*.png"), *Path(d).glob("*.jpg")]) if Path(d).exists() else []


def cmd_report(a):
    run = resolve_run(a.run, a.project)
    cfg = load(run)
    n = a.iter or last_iter(run)
    if not n:
        raise SystemExit("no iterations yet; run trial first")
    e = html.escape
    ref_ev = run / "reference" / "evidence"

    def panel(title, ev, extra=""):
        pics = "".join(f'<figure><img src="{e(os.path.relpath(p, run))}"><figcaption>{e(p.name)}</figcaption></figure>'
                       for p in imgs(ev))
        checks = (ev / "checks.log").read_text(errors="replace")[-3000:] if (ev / "checks.log").exists() else "(no checks.log)"
        files = (ev / "files.txt").read_text()[:3000] if (ev / "files.txt").exists() else ""
        return (f"<section><h3>{e(title)}</h3>{extra}<div class=pics>{pics or '<p>(no screenshots)</p>'}</div>"
                f"<details><summary>checks.log</summary><pre>{e(checks)}</pre></details>"
                f"<details><summary>files</summary><pre>{e(files)}</pre></details></section>")

    trials = []
    for t in trial_dirs(run, n):
        v = json.loads((t / "verdict.json").read_text()) if (t / "verdict.json").exists() else {}
        extra = (f"<p><b>{e(v.get('verdict', 'not judged'))}</b> {e(str(v.get('score', '')))} "
                 f"{e(v.get('note', ''))}</p><p>workspace: <code>{e(str(t / 'workspace'))}</code></p>")
        trials.append(panel(f"iteration {n}, {t.name} ({state(t)})", t / "evidence", extra))
    led = "".join(f"<tr><td>{r.get('iter')}</td><td>{r.get('trial', '')}</td>"
                  f"<td>{e(str(r.get('verdict', r.get('decision'))))}</td>"
                  f"<td>{e(str(r.get('score', '')))}</td><td>{e(r.get('first_divergence', '') or r.get('note', ''))}</td></tr>"
                  for r in rows(run))
    skill = (iter_dir(run, n) / "skill" / "SKILL.md").read_text()
    accept = f"distill.py accept {shlex.quote(str(run))} --iter {n} --decision pass|fail --note \"...\""
    page = f"""<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Skill Distill Report</title><style>
:root{{--bg:#fff;--fg:#111;--muted:#666;--line:#ccc;--code:#f4f4f4}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#111;--fg:#ddd;--muted:#999;--line:#444;--code:#222;color-scheme:dark}}}}
:root[data-theme="dark"]{{--bg:#111;--fg:#ddd;--muted:#999;--line:#444;--code:#222;color-scheme:dark}}
body{{font:14px/1.5 system-ui,sans-serif;max-width:1200px;margin:0 auto;padding:16px;background:var(--bg);color:var(--fg)}}
h1{{font-size:20px}} h2{{font-size:16px;border-bottom:1px solid var(--line);margin-top:28px}} h3{{font-size:14px}}
.pics{{display:flex;flex-wrap:wrap;gap:8px}} figure{{margin:0;width:280px;max-width:100%}} img{{width:100%;border:1px solid var(--line)}}
figcaption{{font-size:12px;color:var(--muted)}} pre,code{{background:var(--code)}} pre{{padding:8px;overflow:auto;max-height:360px;white-space:pre-wrap}}
table{{border-collapse:collapse;width:100%}} td,th{{border:1px solid var(--line);padding:4px 6px;text-align:left;vertical-align:top}}
.tbl{{overflow-x:auto}} .cols{{display:grid;grid-template-columns:1fr;gap:12px}} @media(min-width:900px){{.cols{{grid-template-columns:1fr 1fr}}}}
</style>
<h1>Skill Distill: {e(cfg['name'])}</h1>
<p>student: <code>{e(cfg['harness_name'])} / {e(cfg['model'])}</code> - iteration {n} - generated {now()}</p>
<p><b>Your call:</b> is the student's result as good as the reference? Record it with <code>{e(accept)}</code></p>
<h2>Task</h2><pre>{e((run / 'prompt.md').read_text())}</pre>
<div class=cols>{panel('reference', ref_ev)}<div>{''.join(trials)}</div></div>
<h2>Ledger</h2><div class=tbl><table><tr><th>iter</th><th>trial</th><th>verdict</th><th>score</th><th>note</th></tr>{led}</table></div>
<h2>Skill used in iteration {n}</h2><pre>{e(skill)}</pre>
"""
    out = run / "report.html"
    out.write_text(page)
    print(out)


def cmd_accept(a):
    run = resolve_run(a.run, a.project)
    cfg = load(run)
    if not iter_dir(run, a.iter).exists():
        raise SystemExit(f"no iteration {a.iter} in {run}")
    ledger_add(run, {"kind": "decision", "iter": a.iter, "decision": a.decision, "note": a.note or ""})
    if a.decision == "pass":
        dest = run / "final" / cfg["name"]
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(iter_dir(run, a.iter) / "skill", dest)
        print(f"accepted; skill copied to {dest}")
    else:
        print("recorded fail; add the user's note to acceptance.md, revise skill/, and start the next iteration")


def cmd_list(a):
    root = runs_root(a.project)
    runs = sorted(p for p in root.glob("*") if (p / "run.json").exists()) if root.exists() else []
    if not runs:
        print(f"no runs in {root}")
    for run in runs:
        cfg = load(run)
        scores = [r["score"] for r in rows(run) if r["kind"] == "verdict"]
        decisions = [r["decision"] for r in rows(run) if r["kind"] == "decision"]
        print(f"{run.name:30} {cfg['harness_name']}/{cfg['model']:30} iterations {last_iter(run):>2}  "
              f"best {max(scores) if scores else '-':>4}  decision {decisions[-1] if decisions else '-'}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--project", help="project folder name under ~/.gti/skill-distill/ (default: git root name)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    def add(name, help_text):
        return sub.add_parser(name, parents=[common], help=help_text)

    p = add("smoke", "run a one-minute task through the student harness")
    p.add_argument("--student", required=True, help="harness:model, e.g. omp:local/deepseek-v4.1-flash")
    p.add_argument("--student-args"); p.add_argument("--env", action="append", help="K=V, repeatable")
    p.add_argument("--timeout", type=int, default=300, help="seconds")
    p = add("init", "create a run")
    p.add_argument("run", help="task name or path")
    p.add_argument("--prompt", required=True, help="file with the reference's first user message, verbatim")
    p.add_argument("--student", required=True,
                   help="harness:model; harness is an id from scripts/agent/harnesses.json or script:<path>")
    p.add_argument("--base", required=True,
                   help="'empty', or /path/to/repo[@ref], or /path/to/repo@worktree to snapshot uncommitted changes")
    p.add_argument("--reference", help="reference session log, or claude|codex|omp for the newest session of "
                                       "--reference-workspace (default: the current folder)")
    p.add_argument("--reference-workspace", help="where the reference's result lives (for evidence)")
    p.add_argument("--name", help="name of the student skill (default: reproduce-<task>)")
    p.add_argument("--student-args"); p.add_argument("--env", action="append", help="K=V, repeatable")
    p.add_argument("--setup", help="shell command run in every fresh workspace before the student starts")
    p.add_argument("--tmux"); p.add_argument("--timeout-min", type=float, default=90)
    p.add_argument("--force", action="store_true")
    p = add("trial", "start K student sessions for the next iteration")
    p.add_argument("run"); p.add_argument("--iter", type=int); p.add_argument("-k", type=int, default=3)
    for c, h in (("status", "show trial states"), ("report", "write report.html")):
        p = add(c, h); p.add_argument("run"); p.add_argument("--iter", type=int)
    p = add("evidence", "collect what each trial produced")
    p.add_argument("run"); p.add_argument("--iter", type=int)
    p.add_argument("--reference", nargs="?", const=True, default=False,
                   help="collect evidence for the reference workspace instead (optionally its path)")
    p = add("wait", "block until all trials of an iteration exit")
    p.add_argument("run"); p.add_argument("--iter", type=int)
    p.add_argument("--timeout", type=int, default=540, help="seconds; exit code 2 when reached")
    p = add("verdict", "record the teacher's judgement of one trial")
    p.add_argument("run"); p.add_argument("--iter", type=int, required=True)
    p.add_argument("--trial", type=int, required=True)
    p.add_argument("--verdict", required=True, choices=["match", "close", "miss", "broken"])
    p.add_argument("--score", type=float, required=True, help="0-10 against the reference")
    p.add_argument("--divergence"); p.add_argument("--note"); p.add_argument("--fix")
    p = add("ledger", "print the ledger"); p.add_argument("run")
    p = add("accept", "record the user's decision")
    p.add_argument("run"); p.add_argument("--iter", type=int, required=True)
    p.add_argument("--decision", required=True, choices=["pass", "fail"]); p.add_argument("--note")
    add("list", "list the runs of this project")
    a = ap.parse_args()
    globals()["cmd_" + a.cmd](a)


if __name__ == "__main__":
    main()
