"""Stale git worktrees: linked worktrees that coding agents and people leave behind (opencode, Claude Code,
Cursor, Maestro, Paseo). One is removed only when git says nothing in it would be lost."""

from __future__ import annotations

import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from cleanup import fsutil
from cleanup.model import COMMAND, REPORT, Finding, human

DAY = 86400


def read_gitdir(worktree):
    """The admin folder a linked worktree's .git file points to, or None for repositories and submodules."""
    try:
        text = Path(worktree, ".git").read_text(encoding="utf-8", errors="replace").strip()
    except OSError:
        return None
    if not text.startswith("gitdir:"):
        return None
    gitdir = text[len("gitdir:"):].strip()
    if not os.path.isabs(gitdir):
        gitdir = os.path.normpath(os.path.join(worktree, gitdir))
    parts = Path(gitdir).parts
    if len(parts) < 2 or parts[-2] != "worktrees":
        return None  # a submodule (.git/modules/...), not a worktree
    return gitdir


def common_dir(gitdir):
    """The repository's own .git folder: <repo>/.git/worktrees/<name> -> <repo>/.git."""
    try:
        text = Path(gitdir, "commondir").read_text(encoding="utf-8").strip()
        return os.path.normpath(os.path.join(gitdir, text))
    except OSError:
        return str(Path(gitdir).parent.parent)


def activity(worktree, gitdir, ignore):
    """Newest sign of use: git's index, HEAD, and reflog for this worktree, and its files two levels deep."""
    from cleanup.scanners import project_activity
    newest = project_activity(worktree, ignore)
    for name in ("HEAD", "index", "logs/HEAD", "ORIG_HEAD", "FETCH_HEAD"):
        st = fsutil.lstat(os.path.join(gitdir, name))
        if st:
            newest = max(newest, st.st_mtime)
    return newest


def git(worktree, *args, timeout=60):
    return fsutil.run(["git", "-C", worktree, *args], timeout=timeout)


def inspect(worktree, ctx, ignore, now=None):
    """Returns (state, details): state is one of stale, active, dirty, detached-unique, orphan, locked, unknown."""
    gitdir = read_gitdir(worktree)
    if gitdir is None:
        return None, {}
    details = {"worktree": worktree, "gitdir": gitdir}
    if not os.path.isdir(gitdir):
        return "orphan", details
    if os.path.exists(os.path.join(gitdir, "locked")):
        return "locked", details
    last = activity(worktree, gitdir, ignore)
    idle = int(((now or time.time()) - last) / DAY) if last else None
    details["idle_days"] = idle
    if idle is None or idle < ctx.pref("stale_worktree_days"):
        return "active", details
    status = git(worktree, "status", "--porcelain", "--untracked-files=normal")
    if status is None:
        return "unknown", details
    if status.strip():
        details["changes"] = len(status.strip().splitlines())
        return "dirty", details
    branch = (git(worktree, "symbolic-ref", "-q", "--short", "HEAD", timeout=20) or "").strip()
    details["branch"] = branch
    if not branch:
        refs = git(worktree, "for-each-ref", "--contains", "HEAD", "--count=1", "--format=%(refname)")
        if not (refs or "").strip():
            return "detached-unique", details
    details["common_dir"] = common_dir(gitdir)
    return "stale", details


def worktree_findings(walk, ctx, ignore):
    if not fsutil.run_exists("git"):
        if walk.worktrees:
            ctx.note("git is not on PATH: worktrees were not checked.")
        return []
    candidates = [w for w in dict.fromkeys(walk.worktrees) if ctx.on_selected(w)]
    with ThreadPoolExecutor(max_workers=ctx.jobs) as pool:
        states = list(pool.map(lambda w: inspect(w, ctx, ignore), candidates))
    findings, kept = [], {"dirty": [], "detached-unique": [], "orphan": []}
    for worktree, (state, details) in zip(candidates, states):
        if state == "stale":
            branch = details.get("branch")
            findings.append(Finding(
                category="dev", title=f"Stale git worktree {os.path.basename(worktree)}", action=COMMAND,
                level="aggressive", auto=True, size=fsutil.fast_size(worktree), paths=[worktree],
                command=["git", "--git-dir", details["common_dir"], "worktree", "remove", worktree],
                reason=f"No change for {details['idle_days']} days, nothing uncommitted or untracked"
                       + (f"; branch {branch} stays in the repository." if branch else "; its commit is on another branch."),
                risk="Ignored files in it (build output, .env files) go with it. git refuses if anything is uncommitted.",
                restore=f"git worktree add {worktree} {branch}" if branch else "git worktree add <path> <commit>",
                drive=getattr(ctx.drive_of(worktree), "id", None), details=details))
        elif state in kept:
            kept[state].append((worktree, details))
    labels = {
        "dirty": ("Stale git worktrees with uncommitted changes", "They have not changed in a long time but hold "
                  "uncommitted or untracked work; commit, stash, or discard it, then remove them with git worktree remove."),
        "detached-unique": ("Stale git worktrees with commits on no branch", "HEAD is detached on commits no branch "
                            "or tag contains: removing them would lose those commits. Create a branch first."),
        "orphan": ("Git worktrees whose repository is gone", "The .git file points to a repository that no longer "
                   "exists, so git cannot say what is in them. Check them by hand before deleting."),
    }
    for state, rows in kept.items():
        if not rows:
            continue
        size = sum(fsutil.fast_size(w) for w, _ in rows)
        title, reason = labels[state]
        findings.append(Finding(
            category="dev", title=f"{title} ({len(rows)})", action=REPORT, level="aggressive", size=size,
            paths=sorted(w for w, _ in rows), reason=f"{reason} Total {human(size)}.",
            details={"worktrees": {w: d for w, d in rows}}))
    return findings


def inside(path, roots):
    return any(fsutil.is_under(path, root) and fsutil.norm(path) != fsutil.norm(root) for root in roots)
