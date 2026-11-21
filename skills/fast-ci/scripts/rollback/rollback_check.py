#!/usr/bin/env python3
"""Check that a repository can roll back, quickly and safely, and time real rollback drills.

Subcommands:

    scan    [--root .] [--fail-on none|minor|major|blocker] [--out DIR]
            Finds rollback scripts (rollback, revert, downgrade, undo in the file name), rollback jobs in CI
            config (GitHub, Forgejo, Gitea, Woodpecker, GitLab, Jenkins, Tekton, Argo, Helm, Makefile and
            package.json targets), and database migrations, then flags what makes a rollback slow, unsafe,
            or impossible. Writes Markdown and JSON to ~/.gti/fast-ci/<project>/rollback/. Exits 1 when a
            finding is at or above --fail-on (default none, so an audit never fails by itself).
    drill   --name NAME [--verify "command"] [--out FILE] -- <rollback command ...>
            Runs a rollback drill, then the verify command (a health check), and appends one row with the
            time to roll back, the time to healthy, and both exit codes to rollback/drills.jsonl.
            Returns the rollback's exit code, or the verify command's when the rollback succeeded.

The scan is static: it reads files and never runs them. A clean scan does not prove a rollback works;
only a drill that ends healthy does.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.gti import gti_dir, project_name, stamp  # noqa: E402

SEVERITY = {"blocker": 3, "major": 2, "minor": 1, "info": 0}
SKIP_DIRS = {".git", "node_modules", "vendor", "dist", "build", "target", ".venv", "venv", "__pycache__",
             ".next", ".nuxt", ".terraform", "coverage", ".gradle", ".idea", ".vscode", "bin", "obj"}
ROLLBACK_NAME = re.compile(r"(roll[-_]?back|revert|downgrade|undo|restore[-_]?(release|deploy|version))", re.I)
NOT_ROLLBACK = re.compile(r"(^|[-_.])(check|checker|lint|test|tests|spec|mock|fixture)([-_.]|$)|^test_", re.I)
SCRIPT_EXT = {".sh", ".bash", ".zsh", ".ps1", ".py", ".js", ".mjs", ".cjs", ".ts", ".rb", ".pl", ".groovy"}
CI_FILE = re.compile(
    r"(^|/)(\.github/workflows/[^/]+\.ya?ml|\.forgejo/workflows/[^/]+\.ya?ml|\.gitea/workflows/[^/]+\.ya?ml"
    r"|\.woodpecker(\.ya?ml|/[^/]+\.ya?ml)|\.gitlab-ci\.ya?ml|Jenkinsfile[^/]*|[^/]*\.jenkinsfile"
    r"|\.drone\.ya?ml|bitbucket-pipelines\.ya?ml|azure-pipelines\.ya?ml|\.circleci/config\.ya?ml"
    r"|Makefile|makefile|GNUmakefile|justfile|Justfile|Taskfile\.ya?ml|package\.json)$")
MANIFEST = re.compile(r"\b(kind:\s*(Rollout|Pipeline|Task|PipelineRun|Workflow|Application)\b|helm\.sh/|argoproj\.io)")
MIGRATION_DIR = re.compile(r"(^|/)(migrations?|migrate|alembic/versions|db/migrate|database/migrations|sql/migrations"
                           r"|flyway|liquibase|changelog|schema/migrations)(/|$)", re.I)

ROLLBACK_WORD = re.compile(r"roll[-_ ]?back|rollout\s+undo|\brevert\b|downgrade|\bundo\b", re.I)
DEPLOY_WORD = re.compile(r"\b(deploy|kubectl\s+(apply|set\s+image|rollout)|helm\s+(upgrade|install)|argocd\s+app\s+sync"
                         r"|kustomize\s+build|flux\s+reconcile|docker\s+(stack\s+deploy|compose\s+up)|terraform\s+apply"
                         r"|ansible-playbook|cap\s+\w+\s+deploy|fly\s+deploy|vercel\s+--prod|railway\s+up)\b", re.I)
WAIT_WORD = re.compile(r"rollout\s+status|--wait\b|--atomic\b|--rollback-on-failure|kubectl\s+wait|argocd\s+app\s+wait"
                       r"|health|healthz|readyz|smoke|curl\s|wget\s|Invoke-WebRequest|httpie|\bhttp\s+GET", re.I)

# Per-line rules for rollback scripts and rollback jobs: (id, severity, regex, message, fix)
LINE_RULES = [
    ("RB002", "major", re.compile(r"\|\|\s*(true|:)\s*($|[;#)])|continue-on-error:\s*true|allow_failure:\s*true"
                                  r"|-ErrorAction\s+SilentlyContinue|failure:\s*ignore", re.I),
     "A rollback step ignores its own failure, so a broken rollback reports success.",
     "Remove the error swallowing; let the step fail and alert."),
    ("RB003", "major", re.compile(r"[\w./-]+:latest\b|\btag:\s*['\"]?latest\b|imageTag:\s*['\"]?latest\b", re.I),
     "The rollback target is the moving tag `latest`, which usually points at the broken release.",
     "Roll back to a pinned version or image digest recorded at deploy time."),
    ("RB004", "major", re.compile(r"kubectl\s+(?:-\S+\s+)*rollout\s+undo(?!.*--to-revision)", re.I),
     "`kubectl rollout undo` without `--to-revision` goes to the previous revision; run twice, it returns to the broken one.",
     "Pass `--to-revision` or set the known-good image digest explicitly."),
    ("RB006", "major", re.compile(r"\b(docker\s+build|docker\s+buildx\s+build|podman\s+build|buildah\s+bud|kaniko"
                                  r"|(npm|pnpm|yarn|bun)\s+(run\s+)?build|go\s+build|cargo\s+build|mvn\s+(\S+\s+)*package"
                                  r"|gradlew?\s+(\S+\s+)*(build|assemble)|dotnet\s+publish|make\s+build)\b", re.I),
     "The rollback rebuilds from source, so it is slow and may not produce the artifact that last worked.",
     "Redeploy the stored artifact or image digest of the last good release; never rebuild during a rollback."),
    ("RB007", "blocker", re.compile(r"git\s+push\s+(.*\s)?(--force(?!-with-lease)\b|-f\b)", re.I),
     "The rollback force-pushes, rewriting shared history.",
     "Revert with a new commit (`git revert`) or redeploy an older artifact; never rewrite main."),
    ("RB008", "major", re.compile(r"helm\s+rollback(?!.*--wait)", re.I),
     "`helm rollback` without `--wait` returns before the old version is healthy.",
     "Add `--wait --timeout <budget>` and check the release status after."),
    ("RB009", "minor", re.compile(r"(^|[\s;&|])(sleep\s+\d+|Start-Sleep\s+(-Seconds\s+)?\d+|time\.sleep\(\s*\d+)", re.I),
     "A fixed sleep waits for the rollback instead of checking it, wasting time or passing too early.",
     "Wait on status: `kubectl rollout status`, `helm --wait`, or a health check loop with a timeout."),
    ("RB010", "major", re.compile(r"(^|[\s;&|])(read\s+(-\w+\s+)*-p\b|Read-Host\b|input\()|\bselect\s+\w+\s+in\b", re.I),
     "The rollback waits for keyboard input, so it cannot run from CI or by someone who did not write it.",
     "Take the target version as an argument or variable, and confirm in the CI system's approval step instead."),
    ("RB011", "blocker", re.compile(r"\b(DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\s+(TABLE\s+)?\w)", re.I),
     "The rollback script drops or truncates data.",
     "Keep data changes out of the app rollback; restore data only from a verified backup in a separate, approved step."),
    ("RB012", "major", re.compile(r"git\s+reset\s+--hard", re.I),
     "The rollback resets a checkout, which loses local state and does not change what is deployed.",
     "Deploy a known artifact by version, or `git revert` and let CI deploy."),
]

SHELL_EXT = {".sh", ".bash", ".zsh"}

# Migration rules
UP_DEF = re.compile(r"^\s*(def\s+(upgrade|up|change|forwards)\b|(public\s+)?(async\s+)?(function\s+)?up\s*\(|exports\.up\b"
                    r"|async\s+up\s*\(|--\s*\+migrate\s+Up|--\s*migrate:up)", re.I)
DOWN_DEF = re.compile(r"^\s*(def\s+(downgrade|down|backwards)\b|(public\s+)?(async\s+)?(function\s+)?down\s*\(|exports\.down\b"
                      r"|async\s+down\s*\(|--\s*\+migrate\s+Down|--\s*migrate:down)", re.I)
DESTRUCTIVE = re.compile(r"\b(DROP\s+(TABLE|COLUMN)|ALTER\s+TABLE\s+\S+\s+(DROP|RENAME)\b|RENAME\s+(COLUMN|TO)\b"
                         r"|ALTER\s+COLUMN\s+\S+\s+(SET\s+DATA\s+)?TYPE\b|op\.drop_(column|table)|op\.alter_column"
                         r"|remove_column|rename_column|drop_table|change_column\b|migrations\.(RemoveField|RenameField"
                         r"|DeleteModel|RenameModel)|dropColumn|renameColumn|dropTable|\.dropColumn\(|->dropColumn"
                         r"|->renameColumn|Schema::drop)", re.I)
EMPTY_DOWN = re.compile(r"(down\s*\([^)]*\)\s*(:\s*[\w<>\[\]]+\s*)?\{\s*\}|def\s+downgrade\([^)]*\)\s*(->\s*None\s*)?:\s*\n"
                        r"(\s*(#.*|\"\"\"[\s\S]*?\"\"\"|'''[\s\S]*?''')\s*\n)*\s*pass\b)", re.I)


def norm(path):
    return str(path).replace("\\", "/")


def finding(rule, severity, path, line, message, fix, text=""):
    return {"rule": rule, "severity": severity, "file": norm(path), "line": line, "message": message,
            "fix": fix, "text": text.strip()[:160]}


def walk(root):
    for folder, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".cache")]
        for name in files:
            yield Path(folder) / name


def read(path):
    try:
        if path.stat().st_size > 2_000_000:
            return None
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None


def classify(root):
    """Return (rollback_scripts, ci_files, migrations) as lists of (relative path, text)."""
    scripts, ci, migrations = [], [], []
    for path in walk(root):
        rel = norm(path.relative_to(root))
        name = path.name
        if MIGRATION_DIR.search(rel.rsplit("/", 1)[0] if "/" in rel else "") and path.suffix.lower() in {
                ".sql", ".py", ".rb", ".js", ".ts", ".php", ".go", ".xml", ".yaml", ".yml"}:
            text = read(path)
            if text is not None:
                migrations.append((rel, text))
            continue
        if CI_FILE.search(rel):
            text = read(path)
            if text is not None:
                ci.append((rel, text))
            continue
        if path.suffix.lower() in {".yaml", ".yml"}:
            text = read(path)
            if text is not None and MANIFEST.search(text):
                ci.append((rel, text))
            continue
        if ROLLBACK_NAME.search(name) and not NOT_ROLLBACK.search(name) and (
                path.suffix.lower() in SCRIPT_EXT or path.suffix == ""):
            text = read(path)
            if text is not None:
                scripts.append((rel, text))
    return scripts, ci, migrations


def scan_lines(rel, lines, rules=LINE_RULES):
    out = []
    for number, line in enumerate(lines, 1):
        stripped = line.strip()
        if not stripped or stripped.startswith(("#", "//", "--")) and "migrate" not in stripped.lower():
            continue
        for rule, severity, regex, message, fix in rules:
            if regex.search(line):
                out.append(finding(rule, severity, rel, number, message, fix, line))
    return out


def scan_script(rel, text):
    lines = text.splitlines()
    out = scan_lines(rel, lines)
    ext = Path(rel).suffix.lower()
    first = lines[0] if lines else ""
    is_shell = ext in SHELL_EXT or (ext == "" and re.match(r"#!.*\b(ba|z|da)?sh\b", first))
    if is_shell and not re.search(r"^\s*set\s+(-\w*e\w*|-o\s+errexit)", text, re.M):
        out.append(finding("RB001", "blocker", rel, 1, "The shell script has no `set -e`, so it keeps going after a failed "
                           "step and can end with a half-rolled-back system that reports success.",
                           "Start the script with `set -euo pipefail`."))
    if ext == ".ps1" and not re.search(r"\$ErrorActionPreference\s*=\s*['\"]Stop['\"]", text, re.I):
        out.append(finding("RB001", "blocker", rel, 1, "The PowerShell script does not stop on errors.",
                           "Add `$ErrorActionPreference = 'Stop'` at the top and check `$LASTEXITCODE` after native commands."))
    out += file_level_checks(rel, text)
    return out


def file_level_checks(rel, text):
    out = []
    acts = re.search(r"rollout\s+undo|helm\s+rollback|kubectl\s+(apply|set\s+image)|helm\s+upgrade|argocd\s+app\s+(rollback|sync)"
                     r"|docker\s+(service\s+update|compose\s+up|stack\s+deploy)|systemctl\s+restart|deploy", text, re.I)
    if acts and not WAIT_WORD.search(text):
        line = text[:acts.start()].count("\n") + 1
        out.append(finding("RB005", "major", rel, line, "The rollback changes what runs but never checks that the old "
                           "version came back healthy.", "Wait on the rollout and run a health check with a timeout; "
                           "fail the rollback when the check fails.", acts.group(0)))
    if not re.search(r"\btimeout\b|--timeout|timeout-minutes|timeoutInMinutes|activeDeadlineSeconds", text, re.I) and acts:
        out.append(finding("RB013", "minor", rel, 1, "The rollback has no time limit, so a stuck rollback hangs instead "
                           "of failing loudly.", "Add a timeout at or under the rollback budget (5 minutes by default)."))
    return out


def ci_blocks(text):
    """Split CI config into blocks that mention rollback, as (start_line, lines). YAML jobs, Groovy stages,
    Makefile targets, and package.json scripts are cut by indentation or by target lines."""
    lines = text.splitlines()
    ranges = []
    for i, line in enumerate(lines):
        if not ROLLBACK_WORD.search(line):
            continue
        indent = len(line) - len(line.lstrip())
        start = i
        while start > 0 and i - start < 40 and (
                not lines[start].strip() or len(lines[start]) - len(lines[start].lstrip()) >= indent):
            start -= 1
        end = i + 1
        while end < len(lines) and end - i < 80 and (
                not lines[end].strip() or len(lines[end]) - len(lines[end].lstrip()) > indent):
            end += 1
        if ranges and start <= ranges[-1][1]:
            ranges[-1] = (min(ranges[-1][0], start), max(ranges[-1][1], end))
        else:
            ranges.append((start, end))
    return [(start + 1, lines[start:end]) for start, end in ranges]


def scan_ci(rel, text):
    out = []
    for start, body in ci_blocks(text):
        for f in scan_lines(rel, body):
            f["line"] += start - 1
            out.append(f)
        joined = "\n".join(body)
        for f in file_level_checks(rel, joined):
            f["line"] += start - 1
            out.append(f)
    for number, line in enumerate(text.splitlines(), 1):
        if re.search(r"helm\s+upgrade\b", line) and not re.search(r"--atomic|--rollback-on-failure", line):
            out.append(finding("RB014", "minor", rel, number, "`helm upgrade` without `--atomic` (Helm 3) or "
                               "`--rollback-on-failure` (Helm 4) leaves a failed release in place instead of rolling back.",
                               "Add the flag with `--timeout`, so a failed deploy rolls itself back.", line))
    return out


def scan_migrations(migrations):
    out = []
    names = {rel for rel, _ in migrations}
    tools = set()
    for rel, text in migrations:
        low = rel.lower()
        base = rel.rsplit("/", 1)[-1]
        # golang-migrate, dbmate-style pairs
        if low.endswith(".up.sql"):
            tools.add("paired-sql")
            if rel[:-len(".up.sql")] + ".down.sql" not in names:
                out.append(finding("MG001", "major", rel, 1, "The up migration has no matching down migration.",
                                   "Add the `.down.sql`, or document that this schema change is rolled forward only "
                                   "and keep the previous app version compatible with it."))
        if re.match(r"V\d+(_\d+)*__", base):
            tools.add("flyway")
        if base == "migration.sql" and "prisma" in low:
            tools.add("prisma")
        if re.search(r"<changeSet\b", text) and not re.search(r"<rollback\b", text):
            out.append(finding("MG005", "major", rel, 1, "Liquibase change sets without `<rollback>` blocks cannot be "
                               "rolled back unless Liquibase can derive the inverse.", "Add a `<rollback>` to each change set."))
        if EMPTY_DOWN.search(text):
            line = text[:EMPTY_DOWN.search(text).start()].count("\n") + 1
            out.append(finding("MG002", "major", rel, line, "The down migration is empty, so a rollback leaves the new schema "
                               "in place while it reports success.", "Write the inverse, or raise an explicit error that says "
                               "the migration is irreversible and why."))
        if re.search(r"IrreversibleMigration", text):
            line = text[:text.index("IrreversibleMigration")].count("\n") + 1
            out.append(finding("MG003", "major", rel, line, "The migration is declared irreversible.",
                               "Make sure the previous app version works on the new schema (expand and contract), "
                               "so an app rollback never needs this down migration."))
        for match in re.finditer(r"migrations\.(RunPython|RunSQL)\(([^()]|\([^()]*\))*\)", text):
            call = match.group(0)
            reverse = ("reverse_code" in call or "reverse_sql" in call
                       or re.search(r"RunPython\(\s*[\w.]+\s*,\s*[\w.]+", call)
                       or re.search(r"RunSQL\(\s*(\"\"\"[\s\S]*?\"\"\"|'[^']*'|\"[^\"]*\"|\[[^\]]*\]|[\w.]+)\s*,\s*\S", call))
            if not reverse:
                line = text[:match.start()].count("\n") + 1
                out.append(finding("MG004", "major", rel, line, "`%s` has no reverse, so `migrate` back to the previous "
                                   "migration fails." % match.group(1), "Pass `reverse_code` (or "
                                   "`migrations.RunPython.noop` when nothing needs undoing) or `reverse_sql`.", call))
        section = "up"
        is_up_file = low.endswith(".up.sql") or re.match(r"v\d+", base.lower()) or base == "migration.sql"
        is_down_file = low.endswith(".down.sql") or re.match(r"u\d+", base.lower())
        for number, line in enumerate(text.splitlines(), 1):
            if DOWN_DEF.search(line):
                section = "down"
            elif UP_DEF.search(line):
                section = "up"
            if is_down_file or (section == "down" and not is_up_file):
                continue
            if DESTRUCTIVE.search(line):
                out.append(finding("MG006", "major", rel, number, "The migration drops, renames, or retypes a column or "
                                   "table in one step, so the previous app version breaks on the new schema and an app "
                                   "rollback fails or loses data.", "Expand and contract: add the new shape, ship code that "
                                   "uses both, backfill, and drop the old shape only after the release that stopped using it.",
                                   line))
    if "flyway" in tools and not any(re.match(r"U\d+", r.rsplit("/", 1)[-1]) for r in names):
        out.append(finding("MG007", "info", "(flyway)", 0, "Flyway migrations have no undo (`U`) scripts; schema changes "
                           "are rolled forward.", "Keep every migration backward compatible with the previous release."))
    if "prisma" in tools:
        out.append(finding("MG007", "info", "(prisma)", 0, "Prisma Migrate has no down migrations; schema changes are "
                           "rolled forward.", "Keep every migration backward compatible with the previous release, "
                           "and test `prisma migrate diff` for the reverse when one is needed."))
    return out


def scan(root):
    root = Path(root).resolve()
    scripts, ci, migrations = classify(root)
    findings = []
    for rel, text in scripts:
        findings += scan_script(rel, text)
    for rel, text in ci:
        findings += scan_ci(rel, text)
    findings += scan_migrations(migrations)

    ci_text = "\n".join(text for _, text in ci)
    has_deploy = bool(DEPLOY_WORD.search(ci_text)) or any(DEPLOY_WORD.search(t) for _, t in scripts)
    rollback_in_ci = [rel for rel, text in ci if ROLLBACK_WORD.search(text)]
    if has_deploy and not scripts and not rollback_in_ci:
        findings.append(finding("RP001", "blocker", "(repository)", 0, "The repository deploys but has no rollback "
                                "script or rollback job.", "Add one command that redeploys a given earlier version, "
                                "runnable from CI, and drill it."))
    for rel, _ in scripts:
        stem = Path(rel).name
        if not any(stem in text for _, text in ci):
            findings.append(finding("RP002", "major", rel, 0, "No CI job or make target runs this rollback script, so it "
                                    "is never drilled and will likely fail when it is needed.",
                                    "Run it from CI as a manual or scheduled job, and drill it against staging."))
    findings.sort(key=lambda f: (-SEVERITY[f["severity"]], f["file"], f["line"]))
    return {"root": str(root), "scripts": [r for r, _ in scripts], "ci_files": [r for r, _ in ci],
            "ci_with_rollback": rollback_in_ci, "migrations": len(migrations), "deploys": has_deploy,
            "findings": findings}


def read_drills(path):
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def pct(values, q):
    if not values:
        return None
    values = sorted(values)
    k = (len(values) - 1) * q
    lo, hi = int(k), min(int(k) + 1, len(values) - 1)
    return values[lo] + (values[hi] - values[lo]) * (k - lo)


def drill_summary(drills, budget=300):
    ok = [d for d in drills if d.get("rollback_exit") == 0 and d.get("verify_exit") in (0, None)]
    totals = [d["total_s"] for d in ok]
    last = drills[-1] if drills else None
    return {"drills": len(drills), "passed": len(ok), "last": last and last.get("at"),
            "last_passed": bool(last and last in ok), "p50_s": pct(totals, 0.5), "p95_s": pct(totals, 0.95),
            "budget_s": budget, "over_budget": [d for d in ok if d["total_s"] > budget]}


def render(result, drills):
    counts = {s: sum(1 for f in result["findings"] if f["severity"] == s) for s in SEVERITY}
    lines = ["# Rollback check", "", "- **Root:** `%s`" % result["root"],
             "- **Deploys found:** %s" % ("yes" if result["deploys"] else "no"),
             "- **Rollback scripts:** %s" % (", ".join("`%s`" % s for s in result["scripts"]) or "none"),
             "- **CI files with a rollback:** %s" % (", ".join("`%s`" % s for s in result["ci_with_rollback"]) or "none"),
             "- **Migration files:** %d" % result["migrations"],
             "- **Findings:** %d blocker, %d major, %d minor, %d info" % (
                 counts["blocker"], counts["major"], counts["minor"], counts["info"]), ""]
    lines += ["## Drills", ""]
    if drills["drills"]:
        lines += ["| Drills | Passed | Last | Last passed | Time to healthy p50 | p95 | Budget |",
                  "|--------|--------|------|-------------|---------------------|-----|--------|",
                  "| %d | %d | %s | %s | %s | %s | %ds |" % (
                      drills["drills"], drills["passed"], drills["last"], "yes" if drills["last_passed"] else "no",
                      fmt(drills["p50_s"]), fmt(drills["p95_s"]), drills["budget_s"]), ""]
    else:
        lines += ["No drill recorded. A rollback that has never run is not known to work. Record one with "
                  "`rollback_check.py drill`.", ""]
    lines += ["## Findings", ""]
    if not result["findings"]:
        lines += ["None.", ""]
    else:
        lines += ["| Severity | Rule | Where | Problem | Fix |", "|----------|------|-------|---------|-----|"]
        for f in result["findings"]:
            where = "`%s`" % f["file"] + (":%d" % f["line"] if f["line"] else "")
            lines.append("| %s | %s | %s | %s | %s |" % (f["severity"], f["rule"], where,
                                                         f["message"].replace("|", "\\|"), f["fix"].replace("|", "\\|")))
        lines.append("")
    return "\n".join(lines)


def fmt(seconds):
    if seconds is None:
        return "-"
    seconds = float(seconds)
    return "%dm%02ds" % divmod(round(seconds), 60) if seconds >= 60 else "%.1fs" % seconds


def run(command):
    """Run a command and return its exit code; 127 when the program does not exist."""
    try:
        return subprocess.call(command)
    except FileNotFoundError:
        print("not found: %s" % (command if isinstance(command, str) else command[0]), file=sys.stderr)
        return 127


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--project", default=None, help="Project folder under ~/.gti/fast-ci/ (default: git root name)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sc = sub.add_parser("scan", help="Find rollback scripts, jobs, and migrations and flag what breaks a rollback")
    sc.add_argument("--root", default=".", help="Repository root (default: current folder)")
    sc.add_argument("--fail-on", default="none", choices=["none", "info", "minor", "major", "blocker"])
    sc.add_argument("--budget", type=int, default=300, help="Rollback budget in seconds for drills (default 300)")
    sc.add_argument("--out", help="Output folder (default: ~/.gti/fast-ci/<project>/rollback)")

    dr = sub.add_parser("drill", help="Run and time a rollback drill, then a health check")
    dr.add_argument("--name", required=True, help="Environment or drill name, for example staging")
    dr.add_argument("--verify", help="Health check command run after the rollback, for example \"curl -fsS URL\"")
    dr.add_argument("--out", help="Drill log (default: ~/.gti/fast-ci/<project>/rollback/drills.jsonl)")
    dr.add_argument("command", nargs=argparse.REMAINDER)

    args = parser.parse_args(argv)
    project = args.project or project_name(getattr(args, "root", None))

    if args.cmd == "drill":
        command = args.command[1:] if args.command[:1] == ["--"] else args.command
        if not command:
            parser.error("drill needs the rollback command after --")
        start = time.time()
        code = run(command)
        rolled = time.time()
        verify_code = None
        if args.verify and code == 0:
            # Windows parses a command string itself; elsewhere split it like a shell would.
            verify_code = run(args.verify if os.name == "nt" else shlex.split(args.verify))
        end = time.time()
        row = {"at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "name": args.name,
               "command": " ".join(command), "rollback_s": round(rolled - start, 3), "total_s": round(end - start, 3),
               "rollback_exit": code, "verify": args.verify, "verify_exit": verify_code}
        out = Path(args.out) if args.out else gti_dir(project, "rollback") / "drills.jsonl"
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(row) + "\n")
        print("drill %s: rollback %s (exit %d), healthy after %s (verify exit %s) -> %s" % (
            args.name, fmt(row["rollback_s"]), code, fmt(row["total_s"]), verify_code, out), file=sys.stderr)
        return code if code != 0 else (verify_code or 0)

    result = scan(args.root)
    folder = Path(args.out) if args.out else gti_dir(project, "rollback")
    folder.mkdir(parents=True, exist_ok=True)
    drills = drill_summary(read_drills(folder / "drills.jsonl"), args.budget)
    result["drills"] = drills
    name = "rollback-check-" + stamp()
    (folder / (name + ".json")).write_text(json.dumps(result, indent=2, default=str), encoding="utf-8")
    md = folder / (name + ".md")
    md.write_text(render(result, drills), encoding="utf-8")
    counts = {s: sum(1 for f in result["findings"] if f["severity"] == s) for s in SEVERITY}
    print("scripts=%d ci_with_rollback=%d migrations=%d blocker=%d major=%d minor=%d drills=%d -> %s" % (
        len(result["scripts"]), len(result["ci_with_rollback"]), result["migrations"], counts["blocker"],
        counts["major"], counts["minor"], drills["drills"], md))
    if args.fail_on != "none":
        limit = SEVERITY[args.fail_on]
        if any(SEVERITY[f["severity"]] >= limit for f in result["findings"]):
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
