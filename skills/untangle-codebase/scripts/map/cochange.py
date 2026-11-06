"""List files that git history shows changing together, to find hidden links.

Two files that are committed together again and again usually must change together.
When they live in different folders, or nothing in the code connects them, that is a
hidden link: a candidate for colocating them or making the dependency explicit.

Large commits (formatting runs, renames, dependency bumps) are skipped with --max-files.

Examples:
  python3 cochange.py .
  python3 cochange.py . --min-together 4 --cross-folder-only --depth 1
  python3 cochange.py . --json > cochange.json
"""

import argparse
import fnmatch
import json
import sys
from collections import Counter
from itertools import combinations
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from common.codebase import SKIP_DIRS, SKIP_FILES, git_commits, git_prefix, group_of, is_test_path, language_of, utf8_stdout  # noqa: E402


def keep(path, ignore, include_tests):
    parts = path.split("/")
    if any(part in SKIP_DIRS for part in parts[:-1]) or language_of(path) is None:
        return False
    if any(fnmatch.fnmatch(path, p) or fnmatch.fnmatch(parts[-1], p) for p in list(SKIP_FILES) + list(ignore)):
        return False
    return include_tests or not is_test_path(path)


def cochange(root, commits=1000, since=None, max_files=20, min_together=3, min_confidence=0.5,
             depth=2, cross_folder_only=False, include_tests=False, ignore=()):
    prefix = git_prefix(root)
    if prefix is None:
        return {"git_history": False, "commits_used": 0, "pairs": []}
    history = git_commits(root, commits, since)
    file_counts = Counter()
    pair_counts = Counter()
    used = 0
    for files in history:
        if prefix:
            files = [f[len(prefix) + 1:] for f in files if f.startswith(prefix + "/")]
        files = sorted({f for f in files if keep(f, ignore, include_tests)})
        if not files or len(files) > max_files:
            continue
        used += 1
        file_counts.update(files)
        pair_counts.update(combinations(files, 2))

    pairs = []
    for (a, b), together in pair_counts.items():
        if together < min_together:
            continue
        confidence = together / min(file_counts[a], file_counts[b])
        if confidence < min_confidence:
            continue
        group_a, group_b = group_of(a, depth), group_of(b, depth)
        cross = group_a != group_b
        if cross_folder_only and not cross:
            continue
        pairs.append({
            "a": a, "b": b, "together": together,
            "a_changes": file_counts[a], "b_changes": file_counts[b],
            "confidence": round(confidence, 2), "cross_folder": cross,
        })
    pairs.sort(key=lambda p: (-p["cross_folder"], -p["together"], -p["confidence"], p["a"], p["b"]))
    return {"git_history": True, "commits_used": used, "commits_read": len(history), "pairs": pairs}


def to_text(result, top):
    if not result["git_history"]:
        return "No git history found. Run this inside a git repository.\n"
    lines = [f"Commits used: {result['commits_used']} of {result['commits_read']} (large commits skipped)", ""]
    lines.append("Changed together (cross-folder first): together/changes(a)/changes(b), confidence")
    if not result["pairs"]:
        lines.append("  none above the thresholds")
    for pair in result["pairs"][:top]:
        marker = "cross" if pair["cross_folder"] else "same "
        lines.append(f"  [{marker}] {pair['a']}  <->  {pair['b']}: {pair['together']}/{pair['a_changes']}/{pair['b_changes']}, {pair['confidence']}")
    return "\n".join(lines) + "\n"


def main(argv=None):
    utf8_stdout()
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("root", nargs="?", default=".", help="Codebase root inside a git repository (default: current folder)")
    parser.add_argument("--commits", type=int, default=1000, help="Recent commits to read (default 1000)")
    parser.add_argument("--since", default=None, help="Only commits after this date, for example 6.months")
    parser.add_argument("--max-files", type=int, default=20, help="Skip commits that touch more files than this (default 20)")
    parser.add_argument("--min-together", type=int, default=3, help="Minimum commits a pair shares (default 3)")
    parser.add_argument("--min-confidence", type=float, default=0.5, help="Shared commits / changes of the less changed file (default 0.5)")
    parser.add_argument("--depth", type=int, default=2, help="Folder depth that decides cross-folder (default 2)")
    parser.add_argument("--cross-folder-only", action="store_true", help="Only pairs in different folders")
    parser.add_argument("--include-tests", action="store_true", help="Include test files")
    parser.add_argument("--ignore", action="append", default=[], help="Extra glob to skip, repeatable")
    parser.add_argument("--top", type=int, default=30, help="Rows in text output (default 30)")
    parser.add_argument("--json", action="store_true", help="Print JSON")
    args = parser.parse_args(argv)
    if not Path(args.root).is_dir():
        parser.error(f"not a folder: {args.root}")

    result = cochange(args.root, args.commits, args.since, args.max_files, args.min_together, args.min_confidence,
                      args.depth, args.cross_folder_only, args.include_tests, args.ignore)
    print(json.dumps(result, indent=2)) if args.json else sys.stdout.write(to_text(result, args.top))
    return 0


if __name__ == "__main__":
    sys.exit(main())
