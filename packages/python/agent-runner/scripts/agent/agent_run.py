#!/usr/bin/env python3
"""Start, resume, and record headless coding-agent sessions through one command, for any harness.

  list      which harnesses from harnesses.json are on PATH, with their versions
  spawn     start a session: build the harness command, run it in --cwd, stream readable output,
            keep the raw log, capture the session id, and write a result JSON
  resume    send a new prompt to a recorded session (same flags, plus --session)
  models    run the harness's own model listing command
  smoke     ask the agent to create hello.txt in a scratch git folder, to prove model and keys work

Examples:
  python3 agent_run.py list
  python3 agent_run.py spawn --harness claude --model haiku --cwd ./repo --prompt-file brief.md \\
      --trace run/session.jsonl --result run/result.json --timeout 1800 --yolo --isolate
  python3 agent_run.py resume --harness claude --session <id> --cwd ./repo --prompt "Review your work."
  python3 agent_run.py spawn --harness script:./my-adapter.sh --model x --cwd ./repo --prompt-file brief.md
  python3 agent_run.py spawn ... --dry-run        # print the command, run nothing

--harness is an id from harnesses.json, or script:<path> for an adapter script that reads WORKSPACE,
PROMPT_FILE, MODEL, TRACE_DIR, and EXTRA_ARGS and leaves $TRACE_DIR/session.jsonl.
Optional flags (--yolo, --isolate) are checked against the harness's --help and dropped, with a note in the
result, when the installed version does not list them. Exit code: the harness's own, 124 on timeout.

Part of gti-skills packages/python/agent-runner. Session parsing in extract_session.py and the first adapter
flags come from sybil-solutions/skill-distill (MIT, see LICENSE.txt).
"""
import argparse
import datetime as dt
import json
import os
import re
import shlex
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
REGISTRY = HERE / "harnesses.json"
SMOKE_PROMPT = "Create a file named hello.txt containing the word hi, then reply DONE."
CLIP = 400


def now():
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def registry():
    return json.loads(REGISTRY.read_text())["harnesses"]


def gti_dir(skill, *parts):
    """Folder for generated files: ~/.gti/<skill>/... (GTI_HOME replaces ~/.gti). Never the user's repository."""
    base = Path(os.environ.get("GTI_HOME") or Path.home() / ".gti").expanduser()
    folder = base.joinpath(skill, *parts)
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def owner_skill():
    """The skill this copy is installed in (<skill>/scripts/agent/), for default output folders."""
    skill_dir = HERE.parent.parent
    return skill_dir.name if (skill_dir / "SKILL.md").exists() else "agent-runner"


def project_name(start=None):
    here = Path(start or Path.cwd()).resolve()
    for folder in (here, *here.parents):
        if (folder / ".git").exists():
            return folder.name or "project"
    return here.name or "project"


# ---------------------------------------------------------------- resolve and build


def find_bin(spec):
    for name in spec["bin"]:
        path = shutil.which(name)
        if path:
            return path
    return None


def resolve(harness):
    """Return (id, spec). A script:<path> harness gets a synthetic spec."""
    if harness.startswith("script:") or harness.endswith(".sh"):
        path = Path(harness.split(":", 1)[1] if harness.startswith("script:") else harness).expanduser().resolve()
        if not path.exists():
            raise SystemExit(f"adapter script not found: {path}")
        return path.stem, {"name": f"script {path.name}", "script": str(path), "status": "custom",
                           "session": {"assign": None, "keys": []}, "resume": None, "log": "script"}
    specs = registry()
    if harness not in specs:
        raise SystemExit(f"unknown harness {harness!r}; known: {', '.join(sorted(specs))}, or script:<path>")
    return harness, specs[harness]


def fill(items, values):
    out = []
    for item in items:
        for key, value in values.items():
            token = "{" + key + "}"
            if token in item:
                if value in (None, ""):
                    raise SystemExit(f"this harness needs --{key.replace('_', '-')}")
                item = item.replace(token, str(value))
        out.append(item)
    return out


_HELP = {}


def help_text(binary, spec):
    key = (binary, tuple(spec.get("help") or ["--help"]))
    if key not in _HELP:
        try:
            r = subprocess.run([binary, *key[1]], capture_output=True, text=True, timeout=20)
            _HELP[key] = (r.stdout or "") + (r.stderr or "")
        except Exception:
            _HELP[key] = ""
    return _HELP[key]


def checked(flags, binary, spec, dropped):
    """Keep optional flags the installed CLI documents; drop the rest and say so."""
    if not flags:
        return []
    text = help_text(binary, spec) if binary else ""
    if not text:
        return list(flags)
    def listed(flag):
        return re.search(r"(?<![\w-])" + re.escape(flag) + r"(?![\w-])", text) is not None
    missing = [f.split("=")[0] for f in flags if f.startswith("-") and not listed(f.split("=")[0])]
    if missing:
        dropped.extend(missing)
        return []
    return list(flags)


def create_session(spec, binary):
    """Harnesses that create a chat with a separate command (Cursor create-chat) print its id."""
    r = subprocess.run([binary, *spec["session"]["create"]], capture_output=True, text=True, timeout=60)
    lines = [x.strip() for x in (r.stdout or "").splitlines() if x.strip()]
    if r.returncode or not lines:
        raise SystemExit(f"could not create a {spec['name']} session: {(r.stderr or r.stdout).strip()[:300]}")
    return lines[-1]


def build(spec, mode, a, binary, prompt_file, trace_dir):
    """The argv for spawn or resume, the session id assigned up front, and the dropped optional flags."""
    dropped = []
    session = a.session
    assign = (spec.get("session") or {}).get("assign")
    if mode == "spawn" and not session and assign == "command":
        session = create_session(spec, binary) if binary and not a.dry_run else "<created at run time>"
    elif mode == "spawn" and not session and assign:
        session = str(uuid.uuid4()) if assign == "uuid" else f"agent-{uuid.uuid4().hex[:12]}"
    values = {"model": a.model, "provider": a.provider, "session": session, "cwd": a.cwd,
              "trace_dir": str(trace_dir), "title": a.title, "agent": a.agent}
    if mode == "resume":
        if not spec.get("resume"):
            raise SystemExit(f"{spec['name']} has no resume command")
        if not session:
            raise SystemExit("resume needs --session")
        argv = fill(spec["resume"], values)
        groups = spec.get("resume_flags", ["model", "provider", "yolo", "isolate", "log"])
        prompt_mode = spec.get("resume_prompt", spec.get("prompt", "arg"))
    else:
        argv = fill(spec["spawn"], values)
        sess = spec.get("session") or {}
        if session and sess.get("flag"):
            argv += fill(sess["flag"], values)
        groups = ["model", "provider", "title", "yolo", "isolate", "log"]
        prompt_mode = spec.get("spawn_prompt", spec.get("prompt", "arg"))
    if "model" in groups and a.model and spec.get("model"):
        argv += fill(spec["model"], values)
    if "provider" in groups and a.provider and spec.get("provider"):
        argv += fill(spec["provider"], values)
    if "title" in groups and a.title and spec.get("title"):
        argv += fill(spec["title"], values)
    if "yolo" in groups and a.yolo:
        argv += checked(spec.get("yolo"), binary, spec, dropped)
    if "isolate" in groups and a.isolate:
        argv += checked(spec.get("isolate"), binary, spec, dropped)
    if "log" in groups and isinstance(spec.get("log"), dict):
        argv += fill(spec["log"]["session_dir"], values)
    argv += shlex.split(a.extra_args or "")
    if prompt_mode == "arg":
        argv.append(Path(prompt_file).read_text())
    elif "flag" in prompt_mode:
        argv += [prompt_mode["flag"], Path(prompt_file).read_text()]
    elif "file_flag" in prompt_mode:
        argv += [prompt_mode["file_flag"], str(prompt_file)]
    return [binary or spec["bin"][0], *argv], session, dropped


def shown(argv, prompt_file):
    """The command as recorded: the prompt text replaced by a pointer to its file."""
    text = Path(prompt_file).read_text()
    return [f"<prompt: {prompt_file}>" if part == text else part for part in argv]


# ---------------------------------------------------------------- output handling


def readable(line):
    """One short human line for a JSON event, or the raw line."""
    try:
        o = json.loads(line)
    except (ValueError, TypeError):
        return line.rstrip()[:CLIP]
    if not isinstance(o, dict):
        return line.rstrip()[:CLIP]
    msg = o.get("message") if isinstance(o.get("message"), dict) else None
    if msg:
        parts = []
        for b in msg.get("content") or []:
            if isinstance(b, dict) and b.get("type") == "text" and b.get("text", "").strip():
                parts.append("agent: " + b["text"].strip()[:CLIP])
            elif isinstance(b, dict) and b.get("type") in ("tool_use", "toolCall"):
                args = json.dumps(b.get("input") or b.get("arguments"))[:200]
                parts.append(f"tool: {b.get('name')} {args}")
        return "\n".join(parts) or None
    item = o.get("item") if isinstance(o.get("item"), dict) else None
    if item:
        if item.get("type") == "agent_message":
            return "agent: " + str(item.get("text", ""))[:CLIP]
        if item.get("type") == "command_execution" and "exit_code" in item:
            return f"$ {str(item.get('command'))[:200]} -> {item.get('exit_code')}"
        return None
    if o.get("type") == "result" and o.get("result"):
        return "result: " + str(o["result"])[:CLIP]
    return None


def find_key(obj, keys, depth=0):
    if depth > 4:
        return None
    if isinstance(obj, dict):
        for k in keys:
            v = obj.get(k)
            if isinstance(v, (str, int)) and str(v):
                return str(v)
        for v in obj.values():
            hit = find_key(v, keys, depth + 1)
            if hit:
                return hit
    elif isinstance(obj, list):
        for v in obj[:20]:
            hit = find_key(v, keys, depth + 1)
            if hit:
                return hit
    return None


def kill(proc):
    try:
        if hasattr(os, "killpg"):
            os.killpg(proc.pid, signal.SIGTERM)
        else:
            proc.kill()
    except Exception:
        pass


def execute(argv, cwd, env, timeout, trace, keys, quiet=False):
    """Run argv, stream readable lines, tee raw stdout to trace, and return (exit code, timed out, session)."""
    kw = {"start_new_session": True} if hasattr(os, "setsid") else {}
    proc = subprocess.Popen(argv, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            stdin=subprocess.DEVNULL, text=True, errors="replace", bufsize=1, **kw)
    found = {"session": None}
    sink = open(trace, "a") if trace else None

    def pump():
        for line in proc.stdout:
            if sink:
                sink.write(line)
                sink.flush()
            if keys and not found["session"] and line.lstrip().startswith("{"):
                try:
                    found["session"] = find_key(json.loads(line), keys)
                except ValueError:
                    pass
            text = readable(line)
            if text and not quiet:
                print(text, flush=True)

    reader = threading.Thread(target=pump, daemon=True)
    reader.start()
    timed_out = False
    try:
        rc = proc.wait(timeout=timeout or None)
    except subprocess.TimeoutExpired:
        timed_out = True
        kill(proc)
        try:
            rc = proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            proc.kill()
            rc = proc.wait()
        rc = 124
    reader.join(timeout=5)
    if sink:
        sink.close()
    return rc, timed_out, found["session"]


def newest_jsonl(folder):
    files = [*Path(folder).glob("*.jsonl"), *Path(folder).glob("*/*.jsonl")]
    return max(files, key=lambda p: p.stat().st_mtime) if files else None


# ---------------------------------------------------------------- commands


def run_session(a, mode):
    """spawn or resume; returns the result dict."""
    hid, spec = resolve(a.harness)
    cwd = Path(a.cwd or os.getcwd()).resolve()
    a.cwd = str(cwd)
    temp_prompt = None
    if a.prompt_file:
        prompt_file = Path(a.prompt_file).resolve()
    else:
        if a.prompt is None:
            raise SystemExit("give --prompt or --prompt-file")
        fd, name = tempfile.mkstemp(prefix="agent-prompt-", suffix=".md")
        with os.fdopen(fd, "w") as f:
            f.write(a.prompt)
        prompt_file = temp_prompt = Path(name)
    trace = Path(a.trace).resolve() if a.trace else None
    trace_dir = trace.parent if trace else Path(tempfile.mkdtemp(prefix="agent-trace-"))
    trace_dir.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, **dict(kv.split("=", 1) for kv in a.env or [])}

    if "script" in spec:
        if mode == "resume":
            raise SystemExit("an adapter script cannot resume a session")
        binary, session, dropped = "bash", None, []
        argv = ["bash", spec["script"]]
        env.update({"WORKSPACE": str(cwd), "PROMPT_FILE": str(prompt_file), "MODEL": a.model or "",
                    "TRACE_DIR": str(trace_dir), "EXTRA_ARGS": a.extra_args or "", "STUDENT_ARGS": a.extra_args or ""})
        record = argv
    else:
        binary = find_bin(spec)
        if not binary and not a.dry_run:
            raise SystemExit(f"{spec['name']} is not on PATH (looked for {', '.join(spec['bin'])})")
        argv, session, dropped = build(spec, mode, a, binary, prompt_file, trace_dir)
        record = shown(argv, prompt_file)

    result = {"harness": hid, "name": spec["name"], "mode": mode, "model": a.model or "default",
              "session": session, "cwd": str(cwd), "command": record, "dropped_flags": dropped,
              "trace": str(trace) if trace else None, "status": spec.get("status")}
    if a.dry_run:
        print(json.dumps(result, indent=2))
        if temp_prompt:
            temp_prompt.unlink(missing_ok=True)
        return result
    try:
        return finish_session(a, spec, mode, argv, cwd, env, trace, trace_dir, result)
    finally:
        if temp_prompt:
            temp_prompt.unlink(missing_ok=True)


def finish_session(a, spec, mode, argv, cwd, env, trace, trace_dir, result):
    for flag in result["dropped_flags"]:
        print(f"note: {flag} is not in this {spec['name']} version's help; running without it", file=sys.stderr)

    result["started_at"] = now()
    keys = (spec.get("session") or {}).get("keys") or []
    stdout_trace = trace if spec.get("log") == "stdout" else None
    rc, timed_out, seen = execute(argv, str(cwd), env, a.timeout, stdout_trace, keys, quiet=a.quiet)
    result.update({"ended_at": now(), "exit_code": rc, "timed_out": timed_out})
    if seen and not result["session"]:
        result["session"] = seen
    if trace and not trace.exists():
        if isinstance(spec.get("log"), dict):
            log = newest_jsonl(trace_dir / "sessions")
        else:
            log = trace_dir / "session.jsonl" if (trace_dir / "session.jsonl").exists() else None
        if log and log != trace:
            shutil.copy(log, trace)
    result["resumable"] = bool(spec.get("resume") and result["session"])
    if a.result:
        Path(a.result).parent.mkdir(parents=True, exist_ok=True)
        Path(a.result).write_text(json.dumps(result, indent=2))
    return result


def background(a, mode):
    if not a.result:
        raise SystemExit("--background needs --result, where the record is written when the session ends")
    args = [x for x in sys.argv[1:] if x != "--background"]
    log = Path(a.result).with_suffix(".log")
    log.parent.mkdir(parents=True, exist_ok=True)
    kw = {"start_new_session": True} if hasattr(os, "setsid") else {}
    with open(log, "w") as out:
        proc = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), *args], stdout=out,
                                stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, **kw)
    print(json.dumps({"pid": proc.pid, "result": str(Path(a.result).resolve()), "log": str(log.resolve())}))


def cmd_spawn(a, mode="spawn"):
    if a.background and not a.dry_run:
        return background(a, mode)
    r = run_session(a, mode)
    if not a.dry_run:
        print(json.dumps({k: r.get(k) for k in ("harness", "model", "session", "resumable", "exit_code",
                                                 "timed_out", "dropped_flags")}), file=sys.stderr)
        return r["exit_code"]
    return 0


def cmd_resume(a):
    return cmd_spawn(a, "resume")


def cmd_list(a):
    rows = []
    for hid, spec in sorted(registry().items()):
        binary = find_bin(spec)
        version = ""
        if binary:
            try:
                r = subprocess.run([binary, "--version"], capture_output=True, text=True, timeout=10)
                version = ((r.stdout or r.stderr).strip().splitlines() or [""])[0][:60]
            except Exception:
                version = "?"
        rows.append({"id": hid, "name": spec["name"], "path": binary, "version": version,
                     "resume": bool(spec.get("resume")), "status": spec.get("status")})
    if a.json:
        print(json.dumps(rows, indent=2))
    else:
        for r in rows:
            print(f"{'ok  ' if r['path'] else '-   '} {r['id']:13} {r['name']:18} {r['version'] or 'not on PATH':40} "
                  f"resume {'yes' if r['resume'] else 'no '}  {r['status']}")
    return 0


def cmd_models(a):
    hid, spec = resolve(a.harness)
    if not spec.get("models"):
        raise SystemExit(f"{spec['name']} has no model listing command; use the ids its docs or config declare")
    binary = find_bin(spec)
    if not binary:
        raise SystemExit(f"{spec['name']} is not on PATH")
    return subprocess.run([binary, *fill(spec["models"], {"provider": a.provider})]).returncode


def cmd_smoke(a):
    out = Path(a.out).resolve() if a.out else Path(tempfile.mkdtemp(
        prefix=dt.datetime.now().strftime("%Y%m%d-%H%M%S-"), dir=gti_dir(owner_skill(), project_name(), "smoke")))
    ws = out / "workspace"
    ws.mkdir(parents=True, exist_ok=True)
    ident = ["-c", "user.name=agent-runner", "-c", "user.email=agent-runner@localhost"]
    subprocess.run(["git", "init", "-q"], cwd=ws, check=True)
    subprocess.run(["git", *ident, "commit", "-q", "--allow-empty", "-m", "start"], cwd=ws, check=True)
    (out / "prompt.md").write_text(SMOKE_PROMPT + "\n")
    a.cwd, a.prompt_file, a.prompt, a.session, a.title, a.agent = str(ws), str(out / "prompt.md"), None, None, None, a.agent
    a.trace, a.result, a.yolo, a.dry_run, a.quiet = str(out / "trace" / "session.jsonl"), str(out / "result.json"), True, False, False
    a.background = False
    print(f"smoke test: {a.harness} / {a.model or 'default model'}  ->  {out}")
    r = run_session(a, "spawn")
    hello = ws / "hello.txt"
    ok = r["exit_code"] == 0 and hello.exists() and "hi" in hello.read_text(errors="replace").lower()
    has_trace = Path(a.trace).exists() and Path(a.trace).stat().st_size > 0
    print(f"exit {r['exit_code']}  hello.txt {'ok' if ok else 'missing or wrong'}  "
          f"session log {'ok' if has_trace else 'missing'}  session id {r['session'] or 'none'}")
    if not ok:
        print("smoke test failed: fix the model id, key, server, or --extra-args before real work", file=sys.stderr)
        return 1
    if not has_trace:
        print("warning: no session log was written, so later runs will have no trace to read")
    return 0


def session_args(p, resume=False):
    p.add_argument("--harness", required=True, help="id from harnesses.json, or script:<path>")
    p.add_argument("--model"); p.add_argument("--provider"); p.add_argument("--agent", help="openagents: agent to delegate to")
    p.add_argument("--title")
    p.add_argument("--session", required=resume, help="session id to resume, or to assign on spawn")
    p.add_argument("--cwd", help="working folder (default: current)")
    p.add_argument("--prompt"); p.add_argument("--prompt-file")
    p.add_argument("--trace", help="where to keep the raw session log (JSON lines)")
    p.add_argument("--result", help="where to write the result JSON")
    p.add_argument("--timeout", type=float, default=0, help="seconds; 0 = none; exit code 124 when reached")
    p.add_argument("--yolo", action="store_true", help="skip the harness's permission prompts (throwaway folders only)")
    p.add_argument("--isolate", action="store_true", help="turn off the user's global context, rules, and skills")
    p.add_argument("--extra-args", help='extra harness flags, appended verbatim; write --extra-args="-c ..."')
    p.add_argument("--env", action="append", help="K=V for the harness process, repeatable")
    p.add_argument("--background", action="store_true", help="return at once; the result JSON appears when it ends")
    p.add_argument("--dry-run", action="store_true", help="print the command and run nothing")
    p.add_argument("--quiet", action="store_true", help="do not stream readable output")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("list", help="harnesses on PATH"); p.add_argument("--json", action="store_true")
    session_args(sub.add_parser("spawn", help="start a session"))
    session_args(sub.add_parser("resume", help="continue a session"), resume=True)
    p = sub.add_parser("models", help="list the harness's models"); p.add_argument("--harness", required=True)
    p.add_argument("--provider", help="paseo: the provider whose models to list")
    p = sub.add_parser("smoke", help="one-minute check that the agent and model work")
    p.add_argument("--harness", required=True); p.add_argument("--model"); p.add_argument("--provider")
    p.add_argument("--agent"); p.add_argument("--extra-args"); p.add_argument("--env", action="append")
    p.add_argument("--isolate", action="store_true"); p.add_argument("--timeout", type=float, default=300)
    p.add_argument("--out", help="folder for the scratch workspace (default: ~/.gti/<skill>/<project>/smoke/)")
    a = ap.parse_args(argv)
    return globals()["cmd_" + a.cmd](a) or 0


if __name__ == "__main__":
    sys.exit(main())
