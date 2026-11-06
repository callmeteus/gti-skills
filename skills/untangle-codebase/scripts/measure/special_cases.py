"""Count special-case markers in a codebase, to measure how far an untangle has come.

The skill's main progress measure is how many special cases remain. This script finds the
textual signs of them and counts them by category, so you can save a baseline before the
refactor and compare after each round. Every hit is a lead to read, not a verdict: some
special cases are real requirements and stay.

Categories:
  swallowed_exception  empty catch or except blocks
  sleep                fixed waits (sleep, setTimeout, Thread.sleep, Task.Delay)
  retry                retry loops and helpers
  disabled_test        skipped or disabled tests (counted in test files only)
  literal_branch       if conditions that compare to a string literal or a magic number
  suppression          type, lint, and warning suppressions
  marker_comment       TODO, FIXME, HACK, XXX, WORKAROUND comments

Examples:
  python3 special_cases.py . --save .untangle/baseline.json
  python3 special_cases.py . --compare .untangle/baseline.json
  python3 special_cases.py . --list --category swallowed_exception
"""

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from common.codebase import is_test_path, iter_source_files, language_of, read_text, utf8_stdout  # noqa: E402

PATTERNS = {
    "swallowed_exception": [
        (re.compile(r"^[ \t]*except\b[^:\n]*:[ \t]*(?:#[^\n]*)?\n[ \t]*(?:pass|\.\.\.|continue)[ \t]*$", re.M), {"python"}),
        (re.compile(r"\bcatch\b[ \t]*(?:\([^)]*\))?[ \t]*\{[ \t]*(?:(?://|#)[^\n]*)?\s*\}"), None),
        (re.compile(r"\brescue\b[^\n]*\n[ \t]*(?:nil|end)\b"), {"ruby"}),
    ],
    "sleep": [
        (re.compile(r"\b(?:time\.sleep|asyncio\.sleep|Thread\.sleep|time\.Sleep|Task\.Delay|usleep|sleep_for)\s*\("), None),
        (re.compile(r"\bsetTimeout\s*\([^\n]*,\s*\d+\s*\)"), {"js"}),
        (re.compile(r"\bawait\s+(?:sleep|delay|wait)\s*\(\s*\d"), {"js"}),
    ],
    "retry": [
        (re.compile(r"\b(?:retry|retries|retrying|max_?retries|maxRetries|withRetry|backoff)\b", re.I), None),
    ],
    "disabled_test": [
        (re.compile(r"@pytest\.mark\.(?:skip|xfail)\b|@unittest\.skip|\bself\.skipTest\("), {"python"}),
        (re.compile(r"\b(?:it|test|describe|context)\.(?:skip|todo)\s*\(|\bx(?:it|test|describe)\s*\("), {"js"}),
        (re.compile(r"@Disabled\b|@Ignore\b|\[Fact\(Skip\s*=|\[Ignore\]|\bt\.Skip(?:Now|f)?\(|#\[ignore\]"), None),
    ],
    "literal_branch": [
        (re.compile(r"\b(?:if|elif|else if|when|case)\b[^\n{:]*?(?:===?|!==?|==)\s*(?:\"[^\"\n]{1,60}\"|'[^'\n]{1,60}'|-?\d{2,}\b)"), None),
        (re.compile(r"\b(?:if|elif|else if)\b[^\n{:]*?(?:\"[^\"\n]{1,60}\"|'[^'\n]{1,60}'|-?\d{2,}\b)\s*(?:===?|!==?|==)"), None),
    ],
    "suppression": [
        (re.compile(r"@ts-ignore|@ts-expect-error|eslint-disable|#\s*type:\s*ignore|#\s*noqa|#\s*pylint:\s*disable|//\s*nolint|@SuppressWarnings|#pragma warning disable|\bas any\b|:\s*any\b"), None),
    ],
    "marker_comment": [
        (re.compile(r"(?://|#|/\*|\*|--)[^\n]*?\b(?:TODO|FIXME|HACK|XXX|WORKAROUND)\b"), None),
    ],
}

CATEGORIES = list(PATTERNS)

# Literal comparisons that are type checks or language idioms, not special cases.
NEUTRAL_LITERAL = re.compile(
    r"typeof\b|\btype\(|__name__\s*==|instanceof|"
    r"""(?:===?|!==?)\s*['"](?:string|number|boolean|object|function|undefined|bigint|symbol)['"]"""
)


def scan_text(text, language, test_file):
    """Return a list of (category, line number, line text) hits."""
    hits = []
    source_lines = text.splitlines()
    for category, patterns in PATTERNS.items():
        if test_file and category != "disabled_test":
            continue
        if not test_file and category == "disabled_test":
            continue
        seen = set()
        for pattern, languages in patterns:
            if languages and language not in languages:
                continue
            for match in pattern.finditer(text):
                if category == "literal_branch" and NEUTRAL_LITERAL.search(match.group(0)):
                    continue
                line = text.count("\n", 0, match.start()) + 1
                if line in seen:
                    continue
                seen.add(line)
                hits.append((category, line, source_lines[line - 1].strip()[:160] if line <= len(source_lines) else ""))
    return sorted(hits, key=lambda h: (h[1], h[0]))


def scan(root, ignore=()):
    counts = Counter()
    by_file = defaultdict(Counter)
    locations = []
    files = 0
    for full, relative in iter_source_files(root, ignore, include_tests=True):
        text = read_text(full)
        if text is None:
            continue
        files += 1
        for category, line, snippet in scan_text(text, language_of(relative), is_test_path(relative)):
            counts[category] += 1
            by_file[relative][category] += 1
            locations.append({"category": category, "file": relative, "line": line, "text": snippet})
    return {
        "files": files,
        "total": sum(counts.values()),
        "counts": {category: counts.get(category, 0) for category in CATEGORIES},
        "by_file": {name: dict(c) for name, c in sorted(by_file.items(), key=lambda kv: (-sum(kv[1].values()), kv[0]))},
        "locations": locations,
    }


def compare(current, baseline):
    rows = []
    for category in CATEGORIES:
        before = baseline.get("counts", {}).get(category, 0)
        after = current["counts"].get(category, 0)
        rows.append({"category": category, "before": before, "after": after, "delta": after - before})
    before_total = baseline.get("total", 0)
    return {"rows": rows, "before": before_total, "after": current["total"], "delta": current["total"] - before_total}


def to_text(result, top, listing, category, comparison):
    lines = [f"Files scanned: {result['files']}  Special-case markers: {result['total']}", ""]
    if comparison:
        lines.append(f"{'category':<22}{'before':>8}{'after':>8}{'delta':>8}")
        for row in comparison["rows"]:
            lines.append(f"{row['category']:<22}{row['before']:>8}{row['after']:>8}{row['delta']:>+8}")
        lines.append(f"{'total':<22}{comparison['before']:>8}{comparison['after']:>8}{comparison['delta']:>+8}")
    else:
        for name, value in result["counts"].items():
            lines.append(f"  {name:<22}{value:>6}")
    lines += ["", "Files with the most markers:"]
    for name, counts in list(result["by_file"].items())[:top]:
        detail = ", ".join(f"{k} {v}" for k, v in sorted(counts.items()))
        lines.append(f"  {name}: {detail}")
    if listing:
        lines += ["", "Locations:"]
        for hit in result["locations"]:
            if category and hit["category"] != category:
                continue
            lines.append(f"  {hit['file']}:{hit['line']} [{hit['category']}] {hit['text']}")
    return "\n".join(lines) + "\n"


def main(argv=None):
    utf8_stdout()
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("root", nargs="?", default=".", help="Codebase root (default: current folder)")
    parser.add_argument("--ignore", action="append", default=[], help="Extra glob to skip, repeatable")
    parser.add_argument("--save", help="Write the full result as JSON to this file (a baseline)")
    parser.add_argument("--compare", help="Baseline JSON written earlier with --save")
    parser.add_argument("--list", action="store_true", help="List every location in text output")
    parser.add_argument("--category", choices=CATEGORIES, help="Only list this category")
    parser.add_argument("--top", type=int, default=15, help="Files shown in text output (default 15)")
    parser.add_argument("--json", action="store_true", help="Print JSON")
    args = parser.parse_args(argv)
    if not Path(args.root).is_dir():
        parser.error(f"not a folder: {args.root}")

    result = scan(args.root, args.ignore)
    comparison = None
    if args.compare:
        try:
            baseline = json.loads(Path(args.compare).read_text(encoding="utf-8"))
        except (OSError, ValueError) as error:
            parser.error(f"cannot read baseline {args.compare}: {error}")
        comparison = compare(result, baseline)
    if args.save:
        target = Path(args.save)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    if args.json:
        print(json.dumps({**result, "comparison": comparison} if comparison else result, indent=2))
    else:
        sys.stdout.write(to_text(result, args.top, args.list, args.category, comparison))
    return 0


if __name__ == "__main__":
    sys.exit(main())
