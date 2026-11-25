"""Markdown for the scan and for the cleanup, written to ~/.gti/disk-cleanup/<machine>/."""

from __future__ import annotations

from collections import defaultdict

from cleanup.model import CATEGORIES, LEVELS, REPORT, SYSTEM_ACTIONS, human, within

TITLES = {
    "temp": "Temporary files", "caches": "Caches", "logs": "Logs and crash dumps", "trash": "Trash and Recycle Bin",
    "duplicates": "Duplicate files", "downloads": "Old downloads", "dev": "Build output and developer tools",
    "system": "System leftovers", "config": "Settings that waste space", "programs": "Programs not used",
    "large": "Largest files (only you can judge)",
}


def size_text(f):
    if f.details.get("prevents") and not f.size:
        return "stops regrowth"
    if f.estimate and not f.size:
        return "unknown"
    return ("~" if f.estimate else "") + human(f.size)


def reclaimable(findings, level, files_only=False):
    total = 0
    for f in findings:
        if f.action == REPORT or not within(f.level, level) or f.manual:
            continue
        if files_only and (f.action in SYSTEM_ACTIONS or not f.auto):
            continue
        total += f.size
    return total


def cell(text):
    return str(text).replace("|", "\\|").replace("\n", " ")


def scan_markdown(scan, findings):
    lines = [f"# Disk scan: {scan['machine']}", ""]
    lines += [f"- **When:** {scan['created']}", f"- **System:** {scan['system']}",
              f"- **Level:** {scan['level']}", f"- **Automatic mode:** {'on' if scan['auto'] else 'off'}",
              f"- **Elevated:** {'yes' if scan['elevated'] else 'no (admin-only items are listed as pending)'}",
              f"- **Native du:** {scan.get('du') or 'not used (Python walk)'}", ""]
    lines += ["## Drives", "", "| Drive | Label | Type | File system | Free | Total | Scanned | Note |",
              "|-------|-------|------|-------------|------|-------|---------|------|"]
    selected = set(scan["selected"])
    for d in scan["drives"]:
        lines.append(f"| {cell(d['id'])} | {cell(d['label'])} | {d['kind']} | {cell(d['fstype'])} | {human(d['free'])} | "
                     f"{human(d['total'])} | {'yes' if d['id'] in selected else 'no'} | "
                     f"{cell(d['exclude_reason'] or ('system drive' if d['system'] else ''))} |")
    lines += ["", "## Reclaimable space by level", "", "| Category | " + " | ".join(LEVELS) + " |",
              "|----------|" + "|".join("-" * (len(level) + 2) for level in LEVELS) + "|"]
    by_cat = defaultdict(list)
    for f in findings:
        by_cat[f.category].append(f)
    for category in CATEGORIES:
        items = by_cat.get(category, [])
        if not items or category == "large":
            continue
        lines.append(f"| {TITLES[category]} | " + " | ".join(human(reclaimable(items, lv)) for lv in LEVELS) + " |")
    lines.append("| **Total** | " + " | ".join(f"**{human(reclaimable(findings, lv))}**" for lv in LEVELS) + " |")
    lines += ["", "Sizes marked `~` are estimates; `unknown` means the tool reports the size only after it runs. "
              "Settings and uninstalls are counted but never applied automatically.", ""]
    for category in CATEGORIES:
        items = sorted(by_cat.get(category, []), key=lambda f: (-f.size, f.title))
        if not items:
            continue
        lines += [f"## {TITLES[category]}", ""]
        if category == "large":
            lines += ["| Size | File | Note |", "|------|------|------|"]
            for f in items:
                lines.append(f"| {human(f.size)} | `{cell(f.paths[0])}` | {cell(f.reason)} |")
            lines.append("")
            continue
        shown = items[:40]
        lines += ["| Id | Level | Size | Item | Action | Auto | Why | Risk |",
                  "|----|-------|------|------|--------|------|-----|------|"]
        for f in shown:
            action = f.action + (" (admin)" if f.admin else "") + (" (manual)" if f.manual else "")
            lines.append(f"| `{f.id}` | {f.level} | {size_text(f)} | {cell(f.title)} | {action} | "
                         f"{'yes' if f.auto else 'no'} | {cell(f.reason)} | {cell(f.risk)} |")
        if len(items) > len(shown):
            lines.append(f"| | | {human(sum(f.size for f in items[len(shown):]))} | {len(items) - len(shown)} more in scan.json | | | | |")
        lines.append("")
    usage = scan.get("data", {})
    if usage.get("folders"):
        lines += ["## Where the space is", "", f"Walked {usage.get('files', 0):,} files ({human(usage.get('bytes', 0))}) in "
                  f"{usage.get('seconds', 0)} s under: {', '.join(f'`{r}`' for r in usage.get('roots', []))}.", "",
                  "| Size | Folder |", "|------|--------|"]
        for row in usage["folders"]:
            lines.append(f"| {human(row['size'])} | `{cell(row['path'])}` |")
        lines.append("")
    if scan.get("notes"):
        lines += ["## Not verified", ""] + [f"- {cell(n)}" for n in scan["notes"]] + [""]
    return "\n".join(lines)


def clean_markdown(run, results, skipped):
    freed = sum(r["freed"] for r in results)
    lines = [f"# Disk cleanup: {run['machine']}", "", f"- **When:** {run['created']}", f"- **Level:** {run['level']}",
             f"- **Automatic mode:** {'on' if run['auto'] else 'off'}", f"- **Freed:** {human(freed)}",
             f"- **Manifest:** `{run['manifest']}`", "", "## Free space", "", "| Drive | Before | After | Gained |",
             "|-------|--------|-------|--------|"]
    for drive, (before, after) in run["free"].items():
        lines.append(f"| {drive} | {human(before)} | {human(after)} | {human(max(after - before, 0))} |")
    lines += ["", "## Done", "", "| Id | Item | Freed | Items | Problems |", "|----|------|-------|-------|----------|"]
    for r in sorted(results, key=lambda r: -r["freed"]):
        problems = "; ".join(r["problems"][:3]) + (f" (+{len(r['problems']) - 3} more)" if len(r["problems"]) > 3 else "")
        lines.append(f"| `{r['id']}` | {cell(r['title'])} | {human(r['freed'])} | {r['items']} | {cell(problems)} |")
    if skipped:
        lines += ["", "## Pending", "", "| Id | Item | Size | Why it was not done | Command |",
                  "|----|------|------|---------------------|---------|"]
        for f, reason in skipped:
            command = f.command if isinstance(f.command, str) else " ".join(f.command or [])
            lines.append(f"| `{f.id}` | {cell(f.title)} | {size_text(f)} | {cell(reason)} | `{cell(command)}` |")
    return "\n".join(lines) + "\n"
