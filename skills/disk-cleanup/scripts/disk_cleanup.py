#!/usr/bin/env python3
"""Disk Cleanup: list drives, scan them in parallel, and clean what the user (or automatic mode) chose.

  python3 disk_cleanup.py drives
  python3 disk_cleanup.py scan --drives C: D: --level aggressive
  python3 disk_cleanup.py scan --auto
  python3 disk_cleanup.py clean --ids a1b2c3d4e5 f6a7b8c9d0 --level aggressive --apply
  python3 disk_cleanup.py clean --auto --level safe --run-commands --apply
  python3 disk_cleanup.py prefs show

Everything generated goes to ~/.gti/disk-cleanup/<machine>/ (GTI_HOME replaces ~/.gti). Standard library only.
"""

from __future__ import annotations

import argparse
import json
import os
import platform as pyplatform
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from cleanup import fsutil, scanners  # noqa: E402
from cleanup.clean import MAX_SCAN_AGE_HOURS, Guard, choose, execute, load_scan, scan_age_hours  # noqa: E402
from cleanup.drives import select  # noqa: E402
from cleanup.model import CATEGORIES, DEFAULT_PREFERENCES, human, parse_level  # noqa: E402
from cleanup.report import clean_markdown, reclaimable, scan_markdown  # noqa: E402
from common.gti import gti_dir, machine_name, read_json, stamp, write_json  # noqa: E402
from platforms import current  # noqa: E402
from platforms.base import Context  # noqa: E402

PREFS_FILE = "preferences.json"


def load_prefs():
    saved = read_json(gti_dir() / PREFS_FILE, {}) or {}
    return {**DEFAULT_PREFERENCES, **saved}, saved


def out(text=""):
    print(text, flush=True)


# drives ------------------------------------------------------------------------------------------

def cmd_drives(args):
    drives = current().list_drives()
    if args.json:
        out(json.dumps([d.to_dict() for d in drives], indent=2, ensure_ascii=False))
        return 0
    width = max([len(d.id) for d in drives] + [5])
    out(f"{'Drive':<{width}} {'Label':<20} {'Type':<10} {'FS':<16} {'Free':>10} {'Total':>10}  Note")
    for d in drives:
        note = d.exclude_reason or ("system drive (automatic mode uses only this one)" if d.system else "")
        out(f"{d.id:<{width}} {d.label[:20]:<20} {d.kind:<10} {d.fstype[:16]:<16} {human(d.free):>10} {human(d.total):>10}  "
            f"{'EXCLUDED: ' if d.excluded else ''}{note}")
    return 0


# scan --------------------------------------------------------------------------------------------

def cmd_scan(args):
    prefs, _ = load_prefs()
    level = parse_level(args.level or prefs["level"])
    platform = current()
    drives = platform.list_drives()
    auto = args.auto
    if auto and args.drives:
        out("Automatic mode scans only the system drive; ignoring --drives.")
    selected, refused = select(drives, () if auto else (args.drives or ()), auto=auto)
    for name, reason in refused:
        out(f"Not scanning {name}: {reason}")
    if not selected:
        out("No drive to scan. Run `drives` and pass --drives with the ids it lists.")
        return 2
    ctx = Context(level=level, prefs=prefs, drives=drives, selected=selected, elevated=fsutil.is_elevated(),
                  jobs=args.jobs or min(16, (os.cpu_count() or 4) * 2))
    wanted = set(args.categories or CATEGORIES)
    tasks = {}
    if wanted & {"temp", "caches", "logs", "trash", "system", "dev", "downloads"}:
        tasks["targets"] = lambda: scanners.scan_targets(platform, ctx)
        tasks["commands"] = lambda: scanners.scan_commands(platform, ctx)
    if "system" in wanted:
        tasks["system"] = lambda: platform.system_findings(ctx)
    if "config" in wanted:
        tasks["config"] = lambda: platform.config_findings(ctx)
    if "programs" in wanted:
        tasks["programs"] = lambda: [f for f in platform.programs(ctx) if f]
    data_summary = {}
    if wanted & {"duplicates", "dev", "downloads", "large"}:
        def data():
            findings, summary = scanners.scan_data(platform, ctx)
            data_summary.update(summary)
            return findings
        tasks["data"] = data
    out(f"Scanning {', '.join(d.id for d in selected)} at level {level} with {len(tasks)} scanners in parallel...")
    started = time.time()
    results, timings = scanners.run_parallel(tasks, len(tasks), ctx)
    findings = [f for group in results.values() for f in group if f.category in wanted]
    findings = list({f.id: f for f in findings}.values())
    excluded = [d for d in drives if d.excluded]
    for d in excluded:
        ctx.note(f"Drive {d.id} ({d.label or d.root}) was ignored: {d.exclude_reason}.")
    if not ctx.elevated:
        ctx.note("Not running elevated: items marked admin can only be measured where readable and are listed as pending.")
    du = fsutil.du_tool()
    scan = {
        "version": 1, "machine": machine_name(), "created": time.strftime("%Y-%m-%d %H:%M:%S"),
        "created_epoch": time.time(), "system": f"{pyplatform.system()} {pyplatform.release()} ({platform.name})",
        "level": level, "auto": auto, "elevated": ctx.elevated, "du": f"{du[0]} ({du[1]})" if du else None,
        "drives": [d.to_dict() for d in drives], "selected": [d.id for d in selected],
        "seconds": round(time.time() - started, 1), "timings": timings, "notes": ctx.notes, "data": data_summary,
        "findings": [f.to_dict() for f in sorted(findings, key=lambda f: (f.category, -f.size))],
    }
    folder = Path(args.out) if args.out else gti_dir(machine_name(), "scans", stamp())
    write_json(folder / "scan.json", scan)
    (folder / "report.md").write_text(scan_markdown(scan, findings), encoding="utf-8")
    (gti_dir(machine_name()) / "latest-scan.txt").write_text(str(folder / "scan.json"), encoding="utf-8")
    out(f"Done in {scan['seconds']} s. Findings: {len(findings)}.")
    for lv in ("safe", "aggressive", "yolo"):
        out(f"  reclaimable at {lv:<10} {human(reclaimable(findings, lv)):>10}   "
            f"(automatic mode: {human(reclaimable(findings, lv, files_only=True))})")
    out(f"Scan:   {folder / 'scan.json'}")
    out(f"Report: {folder / 'report.md'}")
    return 0


# clean -------------------------------------------------------------------------------------------

def cmd_clean(args):
    prefs, _ = load_prefs()
    level = parse_level(args.level or prefs["level"])
    scan_path = args.scan
    if scan_path in (None, "latest"):
        pointer = gti_dir(machine_name()) / "latest-scan.txt"
        if not pointer.exists():
            out("No scan yet. Run `scan` first.")
            return 2
        scan_path = pointer.read_text(encoding="utf-8").strip()
    scan = load_scan(scan_path)
    age = scan_age_hours(scan)
    if age > MAX_SCAN_AGE_HOURS and not args.allow_old_scan:
        out(f"The scan is {age:.0f} hours old; files change. Scan again, or pass --allow-old-scan.")
        return 2
    if args.auto and not scan.get("auto"):
        out("Automatic cleaning needs a scan made with --auto (system drive only). Scan again with --auto.")
        return 2
    platform = current()
    drives = platform.list_drives()
    elevated = fsutil.is_elevated()
    chosen, skipped = choose(scan["findings"], level, ids=args.ids, categories=args.categories,
                             exclude_ids=args.exclude_ids, auto=args.auto, run_commands=args.run_commands,
                             allow_system=args.allow_system_changes, elevated=elevated)
    if not chosen:
        out("Nothing chosen. Pass --ids, --categories, or --auto (see the report for ids).")
        for f, reason in skipped:
            out(f"  pending {f.id} {f.title}: {reason}")
        return 0 if skipped else 1
    total = sum(f.size for f in chosen)
    out(f"{'Cleaning' if args.apply else 'Would clean'} {len(chosen)} items, about {human(total)}, at level {level}:")
    for f in chosen:
        out(f"  {f.id}  {human(f.size):>10}  [{f.category}] {f.title} ({f.action}, {len(f.paths)} paths)")
    for f, reason in skipped:
        out(f"  pending {f.id}  {f.title}: {reason}")
    if not args.apply:
        out("Dry run: nothing was deleted. Add --apply to delete.")
        return 0
    guard = Guard(platform, drives, scan["selected"], exclude=prefs.get("exclude", []))
    folder = gti_dir(machine_name(), "cleanups", stamp())
    before = {d: fsutil.disk_usage(root)["free"] for d, root in drive_roots(drives, scan["selected"]).items()}
    results = execute(chosen, guard, folder / "manifest.jsonl", jobs=args.jobs or 4, exclude_paths=args.exclude_paths or ())
    after = {d: fsutil.disk_usage(root)["free"] for d, root in drive_roots(drives, scan["selected"]).items()}
    run = {"machine": machine_name(), "created": time.strftime("%Y-%m-%d %H:%M:%S"), "level": level, "auto": args.auto,
           "scan": scan_path, "manifest": str(folder / "manifest.jsonl"),
           "free": {d: (before[d], after.get(d, before[d])) for d in before}}
    write_json(folder / "result.json", {**run, "results": results,
                                         "pending": [{"id": f.id, "title": f.title, "reason": r} for f, r in skipped]})
    (folder / "report.md").write_text(clean_markdown(run, results, skipped), encoding="utf-8")
    freed = sum(r["freed"] for r in results)
    gained = sum(max(a - b, 0) for b, a in run["free"].values())
    out(f"Freed {human(freed)} (free space grew by {human(gained)}).")
    problems = sum(len(r["problems"]) for r in results)
    if problems:
        out(f"{problems} paths were skipped or failed; see the report.")
    out(f"Report: {folder / 'report.md'}")
    return 0


def drive_roots(drives, ids):
    return {d.id: d.root for d in drives if d.id in set(ids)}


# prefs -------------------------------------------------------------------------------------------

def cmd_prefs(args):
    prefs, saved = load_prefs()
    path = gti_dir() / PREFS_FILE
    if args.action == "show":
        out(f"Preferences file: {path}")
        for key, value in prefs.items():
            out(f"  {key} = {json.dumps(value)}{'' if key in saved else '   (default)'}")
        return 0
    if args.action == "reset":
        if path.exists():
            path.unlink()
        out(f"Removed {path}; every value is back to its default: " + json.dumps(saved))
        return 0
    if not args.key or args.key not in DEFAULT_PREFERENCES:
        out(f"Unknown key. Keys: {', '.join(DEFAULT_PREFERENCES)}")
        return 2
    old = prefs[args.key]
    if args.action == "unset":
        saved.pop(args.key, None)
        new = DEFAULT_PREFERENCES[args.key]
    else:
        new = convert(args.key, args.value)
        if args.key == "exclude":
            new = sorted(set(saved.get("exclude", [])) | {str(Path(v).expanduser()) for v in (args.value or "").split(",") if v})
        saved[args.key] = new
    write_json(path, saved)
    out(f"{args.key}: {json.dumps(old)} -> {json.dumps(new)}")
    return 0


def convert(key, value):
    default = DEFAULT_PREFERENCES[key]
    if key == "level":
        return parse_level(value)
    if isinstance(default, bool):
        return str(value).lower() in ("1", "true", "yes", "on", "sim")
    if isinstance(default, int):
        return int(value)
    return value


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("drives", help="List drives; Google Drive, cloud, and network drives are marked excluded")
    p.add_argument("--json", action="store_true")
    p.set_defaults(fn=cmd_drives)

    p = sub.add_parser("scan", help="Scan the chosen drives in parallel and write scan.json and report.md")
    p.add_argument("--drives", nargs="+", help="Drive ids, roots, or labels (C: D:, /, /mnt/data). Default: the system drive")
    p.add_argument("--auto", action="store_true", help="Automatic mode: only the system drive")
    p.add_argument("--level", help="safe, aggressive, or yolo (seguro, agressivo, nao ligo). Default: preference")
    p.add_argument("--categories", nargs="+", choices=CATEGORIES)
    p.add_argument("--jobs", type=int, help="Parallel workers (default: 2 per CPU, at most 16)")
    p.add_argument("--out", help="Folder for scan.json and report.md")
    p.set_defaults(fn=cmd_scan)

    p = sub.add_parser("clean", help="Delete what was chosen from a scan (dry run without --apply)")
    p.add_argument("--scan", help="scan.json path, or latest (default)")
    p.add_argument("--level", help="Highest level to act on. Default: preference")
    p.add_argument("--ids", nargs="+", default=[], help="Finding ids the user approved")
    p.add_argument("--categories", nargs="+", default=[], choices=CATEGORIES, help="Every finding of these categories")
    p.add_argument("--exclude-ids", nargs="+", default=[])
    p.add_argument("--exclude-paths", nargs="+", default=[], help="Paths to keep in this run")
    p.add_argument("--auto", action="store_true", help="Automatic mode: every finding marked auto at or below the level")
    p.add_argument("--run-commands", action="store_true", help="Also run cleanup commands (apt-get clean, docker prune)")
    p.add_argument("--allow-system-changes", action="store_true",
                   help="Allow settings and uninstalls named in --ids (never in automatic mode)")
    p.add_argument("--allow-old-scan", action="store_true")
    p.add_argument("--jobs", type=int)
    p.add_argument("--apply", action="store_true", help="Really delete. Without it, only print what would happen")
    p.set_defaults(fn=cmd_clean)

    p = sub.add_parser("prefs", help="Show or change saved preferences")
    p.add_argument("action", choices=("show", "set", "unset", "reset"))
    p.add_argument("key", nargs="?")
    p.add_argument("value", nargs="?")
    p.set_defaults(fn=cmd_prefs)

    args = parser.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
