"""The cleaner: picks findings by level and choice, checks every path again, deletes, and logs each deletion."""

from __future__ import annotations

import json
import os
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from cleanup import fsutil
from cleanup.model import (COMMAND, DELETE, DELETE_CONTENTS, FILE_ACTIONS, REPORT, SYSTEM_ACTIONS, Finding,
                           within)

MAX_SCAN_AGE_HOURS = 24


def choose(findings, level, ids=(), categories=(), exclude_ids=(), auto=False, run_commands=False,
           allow_system=False, elevated=False):
    """Returns (chosen, skipped) where skipped is [(finding, reason)]. Nothing is chosen without an explicit
    choice: ids, categories, or automatic mode."""
    ids, categories, exclude_ids = set(ids or ()), set(categories or ()), set(exclude_ids or ())
    chosen, skipped = [], []
    for f in findings:
        picked = f.id in ids or f.category in categories or (auto and not ids and not categories)
        if not picked or f.id in exclude_ids:
            continue
        if f.action == REPORT:
            continue
        if f.manual:
            skipped.append((f, "manual step: the user does it where the command says"))
        elif not within(f.level, level) and f.id not in ids:
            pass  # out of scope for this level; an id the user named is their choice and ignores the level
        elif f.action in SYSTEM_ACTIONS and (auto or not allow_system or f.id not in ids):
            skipped.append((f, "system setting or uninstall: only by its id, with --allow-system-changes, never in automatic mode"))
        elif auto and not f.auto:
            skipped.append((f, "needs the user's explicit yes even in automatic mode"))
        elif f.action == COMMAND and not run_commands:
            skipped.append((f, "cleanup command: pass --run-commands to run it"))
        elif f.admin and not elevated:
            skipped.append((f, "needs administrator or root rights: run the command from an elevated prompt"))
        else:
            chosen.append(f)
    return chosen, skipped


class Guard:
    """Re-checks every path right before deletion, whatever the scan said."""

    def __init__(self, platform, drives, selected_ids, exclude=()):
        self.platform = platform
        self.drives = drives
        self.selected_ids = set(selected_ids)
        self.protected = [p for p in platform.protected_paths() if p]
        self.denied = [p for p in platform.denied_paths() if p]
        self.exclude = [os.path.expanduser(p) for p in exclude]

    def drive_of(self, path):
        best, best_len = None, -1
        for drive in self.drives:
            for mount in drive.mountpoints or [drive.id]:
                if fsutil.is_under(path, mount) and len(mount) > best_len:
                    best, best_len = drive, len(mount)
        return best

    def check(self, path, contents=False):
        """None when the path may be deleted, else the reason it may not. With `contents`, only what is inside
        the folder goes, so the folder itself may be a protected one (/tmp, ~/.cache), just not a parent of one."""
        if not os.path.isabs(path):
            return "not an absolute path"
        if not os.path.lexists(path):
            return "already gone"
        st = fsutil.lstat(path)
        if fsutil.is_link(st):
            return "is a link or junction; links are never followed or deleted"
        for root in self.denied:
            if fsutil.is_under(path, root):
                return f"inside {root}, which is never touched (keys, credentials, or cloud-synced files)"
        for root in self.exclude:
            if fsutil.is_under(path, root):
                return f"inside {root}, excluded by the user's preferences"
        for root in self.protected:
            if fsutil.is_under(root, path) and not (contents and fsutil.norm(root) == fsutil.norm(path)):
                return f"would delete the protected folder {root}"
        drive = self.drive_of(path)
        if drive is None:
            return "not on any known drive"
        if drive.excluded:
            return f"on an excluded drive: {drive.exclude_reason}"
        if drive.id not in self.selected_ids:
            return f"on drive {drive.id}, which was not chosen for this run"
        return None


def verify_duplicate(finding, path):
    if not finding.keep or not finding.digest:
        return "duplicate without a kept copy"
    if fsutil.norm(path) == fsutil.norm(finding.keep):
        return "is the kept copy"
    if fsutil.hash_file(finding.keep) != finding.digest:
        return "the kept copy changed or is gone since the scan"
    if fsutil.hash_file(path) != finding.digest:
        return "the file changed since the scan"
    return None


def execute(chosen, guard, manifest_path, jobs=4, exclude_paths=()):
    """Deletes and runs what was chosen. Every deletion is a line in the manifest."""
    lock = threading.Lock()
    results = []
    exclude_paths = [os.path.expanduser(p) for p in exclude_paths]
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    handle = open(manifest_path, "a", encoding="utf-8")

    def log(entry):
        entry["time"] = time.strftime("%Y-%m-%dT%H:%M:%S")
        with lock:
            handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
            handle.flush()

    def clean_files(f):
        freed, done, problems = 0, 0, []
        for path in f.paths:
            if any(fsutil.is_under(path, p) for p in exclude_paths):
                problems.append(f"{path}: excluded for this run")
                continue
            reason = guard.check(path, contents=f.action == DELETE_CONTENTS)
            if reason is None and f.category == "duplicates":
                reason = verify_duplicate(f, path)
            if reason:
                problems.append(f"{path}: {reason}")
                log({"finding": f.id, "path": path, "action": "skipped", "reason": reason})
                continue
            if f.action == DELETE_CONTENTS:
                size, removed, errors = fsutil.empty_folder(path, f.older_than_days)
                done += removed
            else:
                size, error = fsutil.remove(path)
                errors = [f"{path}: {error}"] if error else []
                done += 0 if error and size == 0 else 1
            freed += size
            problems.extend(errors[:20])
            log({"finding": f.id, "category": f.category, "path": path, "action": f.action, "bytes": size,
                 "digest": f.digest, "kept": f.keep, "errors": len(errors)})
        return {"id": f.id, "title": f.title, "category": f.category, "freed": freed, "items": done,
                "problems": problems}

    file_findings = [f for f in chosen if f.action in FILE_ACTIONS]
    with ThreadPoolExecutor(max_workers=max(1, jobs)) as pool:
        results.extend(pool.map(clean_files, file_findings))

    for f in chosen:
        if f.action == DELETE or f.action == DELETE_CONTENTS:
            continue
        results.append(run_command(f, guard, log))
    handle.close()
    return results


def run_command(f, guard, log):
    """Commands run one at a time; freed space is the change in free space on their drive."""
    target = f.drive + os.sep if f.drive and f.drive.endswith(":") else (f.drive or os.path.abspath(os.sep))
    if f.paths and os.path.exists(f.paths[0]):
        target = f.paths[0]
    before = fsutil.disk_usage(target)["free"]
    started = time.time()
    try:
        completed = subprocess.run(f.command, shell=f.shell or isinstance(f.command, str), capture_output=True,
                                   text=True, timeout=3600, encoding="utf-8", errors="replace", stdin=subprocess.DEVNULL)
        code, output = completed.returncode, (completed.stdout + completed.stderr)[-2000:]
    except (OSError, subprocess.SubprocessError) as error:
        code, output = -1, str(error)
    freed = max(fsutil.disk_usage(target)["free"] - before, 0)
    log({"finding": f.id, "category": f.category, "action": f.action, "command": f.command, "exit": code,
         "bytes": freed, "seconds": round(time.time() - started, 1)})
    return {"id": f.id, "title": f.title, "category": f.category, "freed": freed, "items": 1 if code == 0 else 0,
            "problems": [] if code == 0 else [f"exit {code}: {output.strip()[-500:]}"], "command": f.command}


def load_scan(path):
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    data["findings"] = [Finding.from_dict(f) for f in data.get("findings", [])]
    return data


def scan_age_hours(scan):
    return (time.time() - scan.get("created_epoch", 0)) / 3600
