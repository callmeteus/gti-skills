"""Validate CVE findings and render the Markdown report from the template.

Input is a findings JSON file: see assets/templates/cve-findings.example.json.
Each left_to_do item has a text and a rollout value; items whose rollout is
needs-downtime are listed under their own heading for the user to decide. The
script checks it, sorts CVEs by their overall status (worst first), groups more
than five services that share version, condition, and status into one row, and
writes the report to ~/.gti/infra-expert/<project>/cve/ (GTI_HOME replaces
~/.gti) unless --out is given. With --check it only validates. With --plan-dir
it also writes a fix plan in that folder when a service is affected or possible;
the plan has one step per left_to_do item and is linked from Left to do. Standard
library only, Python 3.8+. Use python3 on macOS and Linux and python or py -3 on
Windows.
"""

import argparse
import importlib.util
import json
import os
import sys
from datetime import datetime
from pathlib import Path

STATUSES = ("affected", "possible", "not-applicable", "fixed", "no-fix", "not-checked")
RANK = {"affected": 0, "possible": 1, "no-fix": 2, "not-checked": 3, "not-applicable": 4, "fixed": 5}
ROLLOUTS = ("rolling", "blue-green", "reload", "no-restart", "needs-downtime")
GROUP_LIMIT = 5
TEMPLATE = Path(__file__).resolve().parents[2] / "assets" / "templates" / "cve-report.md"
PLAN_SCRIPT = Path(__file__).resolve().parents[1] / "plan" / "plan.py"


def gti_dir(skill, *parts):
    """Folder for generated files: ~/.gti/<skill>/... (GTI_HOME replaces ~/.gti). Never the user's repository."""
    base = Path(os.environ.get("GTI_HOME") or Path.home() / ".gti").expanduser()
    folder = base.joinpath(skill, *parts)
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def project_name(start=None):
    """Name of the project being worked on: the git root's folder name, or the current folder's."""
    here = Path(start or Path.cwd()).resolve()
    for folder in (here, *here.parents):
        if (folder / ".git").exists():
            return folder.name or "project"
    return here.name or "project"


def cell(value):
    """Make a value safe to put in one Markdown table cell."""
    return str(value if value is not None else "").replace("|", "\\|").replace("\n", " ").strip()


def validate(data):
    errors = []
    if not isinstance(data, dict):
        return ["findings must be a JSON object"]
    for key in ("project", "checked_on", "mode", "cves"):
        if not data.get(key):
            errors.append(f"missing or empty '{key}'")
    if data.get("mode") not in ("manual", "automatic"):
        errors.append("mode must be manual or automatic")

    cves = data.get("cves")
    if not isinstance(cves, list):
        errors.append("'cves' must be a list")
        return errors
    for index, cve in enumerate(cves):
        where = f"CVE {index + 1}"
        if not isinstance(cve, dict):
            errors.append(f"{where} must be an object")
            continue
        for key in ("id", "component"):
            if not cve.get(key):
                errors.append(f"{where} is missing '{key}'")
        services = cve.get("services")
        if not isinstance(services, list) or not services:
            errors.append(f"{where} has no services")
            continue
        seen = set()
        for offset, service in enumerate(services):
            label = f"{where} service {offset + 1}"
            if not isinstance(service, dict):
                errors.append(f"{label} must be an object")
                continue
            name = service.get("name", "")
            key = (name, service.get("host", ""))
            if key in seen:
                errors.append(f"{where} has a duplicate service '{name}' on '{service.get('host', '')}'")
            seen.add(key)
            status = service.get("status")
            if status not in STATUSES:
                errors.append(f"{label} has unknown status '{status}'")
                continue
            if status in ("affected", "possible") and (not service.get("version") or not service.get("condition")):
                errors.append(f"{label} is {status} without version and condition")
            if status == "not-checked" and not service.get("reason"):
                errors.append(f"{label} is not-checked without reason")

    not_checked = data.get("not_checked") or []
    if not isinstance(not_checked, list) or any(not isinstance(item, str) for item in not_checked):
        errors.append("'not_checked' must be a list of strings")

    left = data.get("left_to_do") or []
    if not isinstance(left, list):
        errors.append("'left_to_do' must be a list of objects with 'text' and 'rollout'")
    else:
        for index, item in enumerate(left):
            where = f"left_to_do item {index + 1}"
            if not isinstance(item, dict):
                errors.append(f"{where} must be an object with 'text' and 'rollout'")
                continue
            if not item.get("text"):
                errors.append(f"{where} is missing 'text'")
            rollout = item.get("rollout")
            if not rollout:
                errors.append(f"{where} is missing 'rollout'")
            elif rollout not in ROLLOUTS:
                errors.append(f"{where} has unknown rollout '{rollout}'")
    return errors


def overall(cve):
    """Worst status of the CVE's services: affected > possible > no-fix > not-checked > not-applicable > fixed."""
    return min((s.get("status", "fixed") for s in cve.get("services") or []), key=lambda s: RANK.get(s, 99))


def ordered_cves(data):
    return sorted(data["cves"], key=lambda cve: RANK[overall(cve)])


def grouped_rows(services):
    """Rows of Service, Host or group, Version, Condition, Status. Group only large identical sets."""
    groups = {}
    order = []
    for service in services:
        key = (cell(service.get("version", "")), cell(service.get("condition", "")), service.get("status", ""))
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(service)
    rows = []
    for key in order:
        version, condition, status = key
        members = groups[key]
        if len(members) > GROUP_LIMIT:
            names = [member.get("name", "") for member in members[:3]]
            service_cell = ", ".join(f"`{name}`" for name in names)
            service_cell += f" and {len(members) - len(names)} more"
            rows.append((service_cell, f"{len(members)} hosts", version, condition, status))
        else:
            for member in members:
                rows.append((cell(member.get("name", "")), cell(member.get("host", "")), version, condition, status))
    return rows


def services_table(services):
    lines = ["| Service | Host or group | Version | Condition | Status |",
             "|---|---|---|---|---|"]
    for row in grouped_rows(services):
        lines.append("| " + " | ".join(cell(value) for value in row) + " |")
    return "\n".join(lines)


def summary_text(data, cves):
    total = sum(len(cve["services"]) for cve in cves)
    flagged = sum(1 for cve in cves for service in cve["services"] if service.get("status") in ("affected", "possible"))
    unread = sum(1 for cve in cves for service in cve["services"] if service.get("status") == "not-checked")
    unread += len(data.get("not_checked") or [])
    parts = [f"This run reviewed {len(cves)} CVEs across {total} services.",
             f"{flagged} service{'s' if flagged != 1 else ''} {'are' if flagged != 1 else 'is'} affected or possible."]
    if unread:
        parts.append(f"{unread} service{'s' if unread != 1 else ''} could not be read and "
                     f"{'are' if unread != 1 else 'is'} listed as not checked.")
    else:
        parts.append("Every listed service was read.")
    return " ".join(parts)


def results_table(cves):
    lines = ["| CVE | Component | Overall status | Affected services | Fixed in | Record |",
             "|---|---|---|---|---|---|"]
    for cve in cves:
        flagged = sum(1 for s in cve["services"] if s.get("status") in ("affected", "possible"))
        lines.append("| " + " | ".join([
            cell(cve["id"]), cell(cve["component"]), overall(cve), str(flagged),
            cell(cve.get("fixed_in") or "unknown"), cell(cve.get("record") or "none"),
        ]) + " |")
    return "\n".join(lines)


def affected_sections(cves):
    sections = []
    for cve in cves:
        flagged = [s for s in cve["services"] if s.get("status") in ("affected", "possible")]
        if not flagged:
            continue
        component = cell(cve["component"])
        fixed = cell(cve.get("fixed_in") or "the fixed version")
        if "no fixed" in fixed.lower():
            upgrade = f"- No fixed package is published yet for {component}; watch the vendor advisory."
        else:
            upgrade = f"- Upgrade {component} to {fixed}."
        sections.append("\n".join([
            f"### {cell(cve['id'])}: {component}",
            "",
            services_table(flagged),
            "",
            "Upgrade step left to do:",
            "",
            upgrade,
            "",
        ]))
    return "\n".join(sections).rstrip()


def not_applicable_lines(cves):
    lines = []
    for cve in cves:
        items = [s for s in cve["services"] if s.get("status") == "not-applicable"]
        if not items:
            continue
        reasons = []
        for service in items:
            reason = cell(service.get("reason") or service.get("condition") or "condition absent")
            if reason not in reasons:
                reasons.append(reason)
        text = "; ".join(reasons[:2])
        if len(reasons) > 2:
            text += f" (+{len(reasons) - 2} more)"
        lines.append(f"- **{cell(cve['id'])}** ({cell(cve['component'])}): {text}")
    return "\n".join(lines)


def not_checked_lines(data, cves):
    lines = []
    for cve in cves:
        for service in cve["services"]:
            if service.get("status") == "not-checked":
                lines.append(f"- **{cell(cve['id'])}** {cell(service.get('name'))} on "
                             f"{cell(service.get('host'))}: {cell(service.get('reason'))}")
    for item in data.get("not_checked") or []:
        lines.append(f"- {cell(item)}")
    return "\n".join(lines)


def left_to_do_lines(items):
    """One line per step that can run without a decision, showing its rollout plan."""
    return "\n".join(f"- {cell(item.get('text'))} (rollout: {cell(item.get('rollout'))})" for item in items
                     if item.get("rollout") != "needs-downtime")


def downtime_lines(items):
    """Only the steps that need a downtime decision."""
    return "\n".join(f"- {cell(item.get('text'))}" for item in items
                     if item.get("rollout") == "needs-downtime")


def render(data, plan_link=""):
    cves = ordered_cves(data)
    components = ", ".join(sorted({cell(cve["component"]) for cve in cves}))
    tokens = {
        "project": cell(data.get("project") or project_name()),
        "summary": summary_text(data, cves),
        "scope": components,
        "checked_on": cell(data.get("checked_on")),
        "cves_reviewed": str(len(cves)),
        "services_read": str(sum(len(cve["services"]) for cve in cves)),
        "mode": cell(data.get("mode", "manual")),
        "status": "done",
        "results": results_table(cves),
        "affected_sections": affected_sections(cves),
        "not_applicable": not_applicable_lines(cves),
        "not_checked": not_checked_lines(data, cves),
        "left_to_do": left_to_do_lines(data.get("left_to_do") or []),
        "plan_link": cell(plan_link),
        "downtime_decisions": downtime_lines(data.get("left_to_do") or []),
    }
    text = TEMPLATE.read_text(encoding="utf-8")
    for name, value in tokens.items():
        text = text.replace("{{" + name + "}}", value)
    return text


def default_output(data):
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    project = data.get("project") or project_name()
    return gti_dir("infra-expert", project, "cve") / f"cve-report-{stamp}.md"


def load_plan_module():
    """Load plan.py from this skill so a fix plan uses the same schema and renderer."""
    previous = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        spec = importlib.util.spec_from_file_location("infra_expert_plan", PLAN_SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = previous
    return module


def method_from_conventions():
    """Method from the project's provisioning path; pipeline when none is documented."""
    here = Path.cwd().resolve()
    root = None
    for folder in (here, *here.parents):
        if (folder / ".git").exists():
            root = folder
            break
    if root is None:
        return "pipeline"
    path = root / ".gti" / "infra-expert" / "conventions.md"
    if not path.is_file():
        return "pipeline"
    try:
        text = path.read_text(encoding="utf-8").lower()
    except OSError:
        return "pipeline"
    if "pipeline" in text or "ci workflow" in text or "continuous integration" in text:
        return "pipeline"
    if "command line" in text or "cli" in text:
        return "cli"
    return "pipeline"


def affected_services(data):
    """Pairs of CVE and service for services that need a fix."""
    pairs = []
    for cve in data.get("cves") or []:
        for service in cve.get("services") or []:
            if service.get("status") in ("affected", "possible"):
                pairs.append((cve, service))
    return pairs


def database_involved(data):
    """True when an upgrade in the report touches a database or a dump."""
    words = []
    for cve in data.get("cves") or []:
        words.append(str(cve.get("component") or ""))
        for service in cve.get("services") or []:
            words.append(str(service.get("name") or ""))
            words.append(str(service.get("host") or ""))
    for item in data.get("left_to_do") or []:
        words.append(str(item.get("text") or ""))
    blob = " ".join(words).lower()
    return any(token in blob for token in ("database", "postgres", "mysql", "db-", "dump"))


def short_title(text):
    """One short line for a step title, cut at a word boundary."""
    value = " ".join(str(text).split())
    if value.lower().startswith("needs downtime:"):
        value = value.split(":", 1)[1].strip()
    if len(value) <= 64:
        return value
    return value[:64].rsplit(" ", 1)[0].rstrip(",;:") + "..."


def backup_for(rollout):
    """Backup line for an upgrade step, named so the agent knows what to protect."""
    if rollout in ("rolling", "blue-green"):
        return "Tag the running image before it is replaced."
    if rollout in ("reload", "no-restart"):
        return "Back up the config file before changing it."
    return "Take a database dump before the upgrade when a database is involved."


def fix_plan_data(data, report_path, plan_module):
    """Build the front matter of a fix plan from CVE findings."""
    pairs = affected_services(data)
    ids = []
    for cve, _ in pairs:
        if cve.get("id") not in ids:
            ids.append(cve.get("id"))
    targets = ", ".join(sorted({service.get("name") or "" for _, service in pairs if service.get("name")}))
    targets = targets or "the affected hosts"
    method = method_from_conventions()
    todos = data.get("left_to_do") or []
    needs_downtime = any(item.get("rollout") == "needs-downtime" for item in todos)
    steps = []
    backup_step = database_involved(data)
    if backup_step:
        db_targets = ", ".join(sorted({
            service.get("host") or service.get("name") or ""
            for _, service in pairs
            if any(token in (str(service.get("name") or "") + " " + str(service.get("host") or "")).lower()
                   for token in ("database", "postgres", "mysql", "db-"))
        })) or "the database hosts"
        steps.append({
            "id": "s0",
            "title": "Take and check a database backup",
            "target": db_targets,
            "method": "cli",
            "change": "Dump each affected database to a timestamped file outside the repository and record its size and checksum.",
            "rollout": "no-restart",
            "backup": "none; this step creates the backup",
            "verify": "The dump exists with its recorded size, checksum, and expected table list.",
            "rollback": "none; no live state changed",
            "depends_on": [],
            "requires_approval": False,
            "status": "pending",
            "log": [],
        })
    for index, item in enumerate(todos, 1):
        text = str(item.get("text") or "Upgrade step")
        rollout = item.get("rollout")
        if rollout not in plan_module.ROLLOUTS:
            rollout = "no-restart"
        steps.append({
            "id": "s" + str(index),
            "title": short_title(text),
            "target": targets,
            "method": method,
            "change": text,
            "rollout": rollout,
            "backup": backup_for(rollout),
            "verify": "The service answers its health check during and after the change and reports the fixed version.",
            "rollback": "Restore the previous version through the same path and verify health before continuing.",
            "depends_on": ["s0"] if backup_step else [],
            "requires_approval": rollout == "needs-downtime",
            "status": "pending",
            "log": [],
        })
    title = "Fix " + ", ".join(ids) if ids else "Fix the reported finding"
    return {
        "id": "",
        "title": title,
        "goal": "Upgrade the affected components to their fixed versions and keep each service up where a zero-downtime path exists.",
        "requested_by": "CVE triage",
        "created": datetime.now().date().isoformat(),
        "status": "draft",
        "scope": sorted({service.get("name") or "" for _, service in pairs if service.get("name")}),
        "risk": "high" if needs_downtime else "medium",
        "downtime": {
            "kind": "needs-decision" if needs_downtime else "none",
            "reason": ("At least one upgrade has no zero-downtime path."
                       if needs_downtime else "Every upgrade uses a scripted zero-downtime rollout."),
        },
        "approvals": [],
        "source": {
            "cve": ids[0] if ids else "",
            "cves": ids,
            "report": str(Path(report_path).resolve()),
        },
        "open_questions": (["Choose a downtime window, add a second instance first, or defer for the steps that need downtime."]
                           if needs_downtime else []),
        "steps": steps,
    }


def make_fix_plan(data, report_path, plan_dir):
    """Write a fix plan next to the report run when a service needs a fix."""
    if not affected_services(data):
        return None
    plan = load_plan_module()
    payload = fix_plan_data(data, report_path, plan)
    stamp = datetime.now().strftime("%Y%m%d")
    name = stamp + "-fix-" + plan.slugify(payload["source"]["cve"] or "finding")
    folder = Path(plan_dir).expanduser()
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / (name + ".md")
    suffix = 2
    while path.exists():
        path = folder / (name + "-" + str(suffix) + ".md")
        suffix += 1
    payload["id"] = path.stem
    path.write_text(plan.compose(payload), encoding="utf-8")
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("findings", help="Findings JSON file")
    parser.add_argument("--out", metavar="PATH", default=None,
                        help="Output Markdown path (default: ~/.gti/infra-expert/<project>/cve/, timestamped name)")
    parser.add_argument("--plan-dir", metavar="DIR", default=None,
                        help="Also write a fix plan in DIR when a service is affected or possible")
    parser.add_argument("--check", action="store_true", help="Validate only; do not write a report")
    args = parser.parse_args()

    try:
        data = json.loads(Path(args.findings).expanduser().read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(f"findings error: could not read {args.findings}: {exc}", file=sys.stderr)
        sys.exit(1)

    errors = validate(data)
    if errors:
        for error in errors:
            print(f"findings error: {error}", file=sys.stderr)
        sys.exit(1)
    if args.check:
        return

    out = Path(args.out).expanduser() if args.out else default_output(data)
    plan_path = make_fix_plan(data, out, args.plan_dir) if args.plan_dir else None
    plan_link = "Fix plan: `" + str(plan_path.resolve()) + "`" if plan_path else ""
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render(data, plan_link=plan_link), encoding="utf-8")
    print(out.resolve())
    if plan_path:
        print(plan_path.resolve())


if __name__ == "__main__":
    main()
