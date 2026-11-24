#!/usr/bin/env python3
"""Check that this machine can run Skill Distill, and say how to install what is missing.

  python3 doctor.py [--student omp] [--web] [--json]

Required: Python 3.10+, git, bash, and tmux. --student also checks the student harness: an id from
scripts/agent/harnesses.json (run `python3 scripts/agent/agent_run.py list` for all of them) or a path to
your own adapter script. --web also checks Playwright with Chromium and Pillow, which
scripts/capture/capture_web.py needs.
Exit code 0 when everything required is present, 1 otherwise. Nothing is installed.
"""
import argparse
import importlib.util
import json
import platform
import shutil
import sys
from pathlib import Path

AGENT = Path(__file__).resolve().parent.parent / "agent"
CLI_HINTS = {
    "omp": "install oh-my-pi and configure the model in ~/.omp/agent/models.yml",
    "pi": "install the pi coding agent",
    "codex": "npm install -g @openai/codex",
    "claude": "npm install -g @anthropic-ai/claude-code",
    "opencode": "install opencode and configure the provider",
}


def install_hint(tool):
    if sys.platform == "darwin":
        return f"brew install {tool}"
    if sys.platform.startswith("linux"):
        for pm, cmd in (("apt-get", "sudo apt-get install -y"), ("dnf", "sudo dnf install -y"),
                        ("pacman", "sudo pacman -S --noconfirm")):
            if shutil.which(pm):
                return f"{cmd} {tool}"
        return f"install {tool} with your package manager"
    return "run Skill Distill inside WSL; tmux and bash are not available natively on Windows"


def check(name, ok, detail, hint="", required=True):
    return {"name": name, "ok": bool(ok), "detail": detail, "hint": "" if ok else hint, "required": required}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--student", help="harness id from scripts/agent/harnesses.json, or a path to an adapter script")
    ap.add_argument("--web", action="store_true", help="also check Playwright and Pillow for web results")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    results = [check("python", sys.version_info >= (3, 10), platform.python_version(),
                     "install Python 3.10 or newer")]
    for tool in ("git", "bash", "tmux"):
        path = shutil.which(tool)
        results.append(check(tool, path, path or "not found", install_hint(tool)))
    if a.student:
        if a.student.startswith("script:") or a.student.endswith(".sh") or "/" in a.student:
            p = Path(a.student.split(":", 1)[1] if a.student.startswith("script:") else a.student).expanduser()
            results.append(check("adapter", p.exists(), str(p), "the adapter script does not exist"))
        else:
            sys.path.insert(0, str(AGENT))
            import agent_run
            specs = agent_run.registry()
            spec = specs.get(a.student)
            results.append(check("harness", spec, spec["name"] if spec else a.student,
                                 f"unknown harness; known: {', '.join(sorted(specs))}"))
            if spec:
                path = agent_run.find_bin(spec)
                results.append(check(spec["bin"][0], path, path or "not found",
                                     CLI_HINTS.get(a.student, f"install {spec['name']} and configure its model")))
    if a.web:
        for mod, hint in (("playwright", "python3 -m pip install playwright && python3 -m playwright install chromium"),
                          ("PIL", "python3 -m pip install pillow")):
            found = importlib.util.find_spec(mod) is not None
            results.append(check(mod, found, "importable" if found else "not importable", hint))

    ok = all(r["ok"] for r in results if r["required"])
    if a.json:
        print(json.dumps({"ok": ok, "checks": results}, indent=2))
    else:
        for r in results:
            print(f"{'ok  ' if r['ok'] else 'MISS'} {r['name']:12} {r['detail']}" + (f"\n     -> {r['hint']}" if r["hint"] else ""))
        print("ready" if ok else "missing requirements above")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
