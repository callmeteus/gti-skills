"""List the files and folders that change most often in a git repository.

Recent, frequent changes show where a refactor pays off first. Lock files,
build output, and generated files are skipped by default.
"""

import argparse
import fnmatch
import json
import subprocess
import sys
from collections import Counter
from pathlib import PurePosixPath

DEFAULT_IGNORE = [
    "*.lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "poetry.lock", "Cargo.lock", "go.sum",
    "*node_modules/*", "*vendor/*", "*dist/*", "*build/*", "*.min.js", "*.map", "*.snap", "CHANGELOG.md",
]


def changed_files(repo, commits, since):
    command = ["git", "-C", repo, "log", "--no-merges", "--name-only", "--format=", f"--max-count={commits}"]
    if since:
        command.append(f"--since={since}")
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.returncode != 0:
        raise SystemExit(result.stderr.strip() or "git log failed")
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def ignored(path, patterns):
    return any(fnmatch.fnmatch(path, pattern) or fnmatch.fnmatch(PurePosixPath(path).name, pattern) for pattern in patterns)


def count(paths, depth, patterns):
    files = Counter(path for path in paths if not ignored(path, patterns))
    folders = Counter()
    for path, changes in files.items():
        parts = PurePosixPath(path).parts[:-1]
        if parts:
            folders["/".join(parts[:depth])] += changes
    return files, folders


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("repo", nargs="?", default=".", help="Repository path (default: current folder)")
    parser.add_argument("--commits", type=int, default=300, help="Number of recent commits to read (default 300)")
    parser.add_argument("--since", default=None, help="Only commits after this date, for example 3.months")
    parser.add_argument("--top", type=int, default=15, help="Rows to show per table (default 15)")
    parser.add_argument("--depth", type=int, default=2, help="Folder depth used to group files (default 2)")
    parser.add_argument("--ignore", action="append", default=[], help="Extra glob to skip; repeatable")
    parser.add_argument("--json", action="store_true", help="Print JSON, ready for the report's hotspots field")
    args = parser.parse_args()

    files, folders = count(changed_files(args.repo, args.commits, args.since), args.depth, DEFAULT_IGNORE + args.ignore)
    if args.json:
        print(json.dumps({
            "files": [{"path": path, "changes": n} for path, n in files.most_common(args.top)],
            "folders": [{"path": path, "changes": n} for path, n in folders.most_common(args.top)],
        }, indent=2))
        return
    if not files:
        print("no changed files found in the selected commits", file=sys.stderr)
        return
    print(f"Most changed folders (depth {args.depth}):")
    for path, n in folders.most_common(args.top):
        print(f"  {n:5d}  {path}/")
    print("Most changed files:")
    for path, n in files.most_common(args.top):
        print(f"  {n:5d}  {path}")


if __name__ == "__main__":
    main()
