#!/usr/bin/env python3
"""Balance test shards by recorded file times, and prove the shards together ran every file.

Works with any test runner that writes JUnit XML (bun, vitest, jest-junit, pytest, go-junit-report,
gotestsum, cargo-nextest, Gradle, Maven, dotnet) or with a JSON map {"path/to/file": seconds}.

Subcommands:

    plan    --timings <xml|json ...> --shards N [--files <list|glob ...>] [--split-over 20]
            Prints a summary and writes the plan JSON to ~/.gti/fast-ci/<project>/shards/.
    list    --timings <xml|json ...> --shards N --index K [--files ...]
            Prints only the files of shard K (1-based), one per line, for the CI job to pass to the runner.
            Writes nothing, so it is safe inside CI.
    verify  --files <list|glob ...> --ran <xml|json ...>
            Exits 1 and lists every expected test file that no shard reported.

The algorithm is longest-processing-time first: sort files by time, always give the next file to the
lightest shard. Files with no recorded time get the median time, so new files still spread out.
"""

from __future__ import annotations

import argparse
import glob
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.gti import gti_dir, project_name, stamp  # noqa: E402


def norm(path):
    text = str(path).replace("\\", "/").strip()
    while text.startswith("./"):
        text = text[2:]
    return text


def read_timings(paths):
    """Return {file: seconds} summed across every given JUnit XML or JSON file."""
    times = {}
    for path in paths:
        text = Path(path).read_text(encoding="utf-8")
        if str(path).endswith(".json"):
            for key, value in json.loads(text).items():
                times[norm(key)] = times.get(norm(key), 0.0) + float(value)
            continue
        root = ET.fromstring(text)
        suites = [root] if root.tag == "testsuite" else list(root.iter("testsuite"))
        for suite in suites:
            if suite.find("testsuite") is not None:
                continue  # parent suite; its children are counted on their own
            name = suite.get("file") or suite.get("filepath")
            if name:
                times[norm(name)] = times.get(norm(name), 0.0) + float(suite.get("time") or 0)
                continue
            cases = suite.findall("testcase")
            by_file = {}
            for case in cases:
                key = case.get("file") or case.get("classname") or suite.get("name")
                by_file[key] = by_file.get(key, 0.0) + float(case.get("time") or 0)
            if not cases and suite.get("name"):
                by_file[suite.get("name")] = float(suite.get("time") or 0)
            for key, value in by_file.items():
                if key:
                    times[norm(key)] = times.get(norm(key), 0.0) + value
    return times


def expand_files(items):
    """Each item is a glob, a file path, or a text file that lists one path per line (prefix with @)."""
    files = []
    for item in items or []:
        if item.startswith("@"):
            files += [norm(line) for line in Path(item[1:]).read_text(encoding="utf-8").splitlines() if line.strip()]
        elif any(ch in item for ch in "*?["):
            files += [norm(p) for p in glob.glob(item, recursive=True)]
        else:
            files.append(norm(item))
    return sorted(set(files))


def median(values):
    data = sorted(values)
    if not data:
        return 1.0
    mid = len(data) // 2
    return data[mid] if len(data) % 2 else (data[mid - 1] + data[mid]) / 2.0


def plan(times, shards, files=None, split_over=20.0):
    if shards < 1:
        raise ValueError("shards must be at least 1")
    universe = sorted(set(files)) if files else sorted(times)
    fallback = median([times[f] for f in universe if f in times])
    weights = {f: times.get(f, fallback) for f in universe}
    loads = [0.0] * shards
    buckets = [[] for _ in range(shards)]
    for name in sorted(universe, key=lambda f: (-weights[f], f)):
        idx = min(range(shards), key=lambda i: (loads[i], i))
        buckets[idx].append(name)
        loads[idx] += weights[name]
    return {
        "shards": [sorted(b) for b in buckets],
        "loads": [round(x, 3) for x in loads],
        "total": round(sum(loads), 3),
        "imbalance": round((max(loads) - min(loads)), 3) if loads else 0.0,
        "files_over_limit": sorted([f for f in universe if weights[f] > split_over], key=lambda f: -weights[f]),
        "missing_timing": sorted(f for f in universe if f not in times),
        "stale_timing": sorted(f for f in times if files and f not in set(files)),
        "split_over": split_over,
    }


def verify(expected, ran):
    def matches(exp, seen):
        return exp == seen or exp.endswith("/" + seen) or seen.endswith("/" + exp)
    missing = [f for f in expected if not any(matches(f, r) for r in ran)]
    return {"expected": len(expected), "ran": len(ran), "missing": missing}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--project", default=None, help="Project folder under ~/.gti/fast-ci/")
    sub = parser.add_subparsers(dest="cmd", required=True)
    for name in ("plan", "list"):
        p = sub.add_parser(name)
        p.add_argument("--timings", nargs="+", required=True, help="JUnit XML or JSON timing files from main")
        p.add_argument("--shards", type=int, required=True)
        p.add_argument("--files", nargs="*", help="Every test file: globs, paths, or @list.txt (default: files in the timings)")
        p.add_argument("--split-over", type=float, default=20.0, help="Flag files slower than this many seconds")
        if name == "list":
            p.add_argument("--index", type=int, required=True, help="Shard number, 1-based")
        else:
            p.add_argument("--out", help="Plan JSON path (default: ~/.gti/fast-ci/<project>/shards/)")
    v = sub.add_parser("verify")
    v.add_argument("--files", nargs="+", required=True, help="Every test file that must run")
    v.add_argument("--ran", nargs="+", required=True, help="JUnit XML or JSON reports from every shard")
    args = parser.parse_args(argv)

    if args.cmd == "verify":
        result = verify(expand_files(args.files), sorted(read_timings(args.ran)))
        if result["missing"]:
            print("%d of %d test files did not run in any shard:" % (len(result["missing"]), result["expected"]))
            for name in result["missing"]:
                print("  " + name)
            return 1
        print("All %d test files ran across the shards." % result["expected"])
        return 0

    result = plan(read_timings(args.timings), args.shards, expand_files(args.files), args.split_over)
    if args.cmd == "list":
        if not 1 <= args.index <= args.shards:
            parser.error("--index must be between 1 and --shards")
        print("\n".join(result["shards"][args.index - 1]))
        return 0

    out = Path(args.out) if args.out else gti_dir(args.project or project_name(), "shards") / ("plan-%s.json" % stamp())
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print("shards=%d total=%.1fs loads=%s imbalance=%.1fs over_%gs=%d no_timing=%d -> %s" % (
        args.shards, result["total"], result["loads"], result["imbalance"], args.split_over,
        len(result["files_over_limit"]), len(result["missing_timing"]), out))
    for name in result["files_over_limit"]:
        print("  split this file: " + name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
