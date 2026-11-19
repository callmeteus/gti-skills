"""Validate CVE findings and render the Markdown report from the template.

Input is a findings JSON file: see assets/templates/cve-findings.example.json.
Each left_to_do item has a text and a rollout value; items whose rollout is
needs-downtime are listed under their own heading for the user to decide. The
script checks it, sorts CVEs by their overall status (worst first), groups more
than five services that share version, condition, and status into one row, and
writes the report to ~/.gti/infra-expert/<project>/cve/ (GTI_HOME replaces
~/.gti) unless --out is given. With --check it only validates. Standard library
only, Python 3.8+. Use python3 on macOS and Linux and python or py -3 on Windows.
"""

import argparse
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


def render(data):
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


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("findings", help="Findings JSON file")
    parser.add_argument("--out", metavar="PATH", default=None,
                        help="Output Markdown path (default: ~/.gti/infra-expert/<project>/cve/, timestamped name)")
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
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render(data), encoding="utf-8")
    print(out.resolve())


if __name__ == "__main__":
    main()
