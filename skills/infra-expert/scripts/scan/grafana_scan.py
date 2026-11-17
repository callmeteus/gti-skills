"""Inventory Grafana-as-code files and list structural problems.

Read-only. It reads every JSON file under the folder and sorts it into
dashboards, alert rules, datasources, contact points, and other files, then
reports:

- near-copies: dashboards or alert rules that differ only in a few values and
  could be one template with variables, or children of one base file;
- base files: JSON files other files extend (an "$extends" key, or any key
  given with --extends-key) and how many children each has;
- queries repeated across three or more files (a recording rule or a shared
  panel is usually better);
- datasource UIDs used but not provisioned in the repository, duplicate UIDs,
  dashboards without a UID, committed numeric dashboard ids, and oversized
  dashboards.

YAML provisioning files are read only for their datasource uid lines.
Jsonnet and Terraform grafana_* files are counted, not evaluated; run
terraform_scan.py for the Terraform side.
"""

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hcl import walk  # noqa: E402

IGNORED_KEYS = {"uid", "id", "title", "version", "gridPos", "iteration", "description", "summary", "$extends"}
QUERY_KEYS = ("expr", "rawSql", "query", "logql", "rawQuery")
YAML_UID = re.compile(r"^\s*uid:\s*['\"]?([\w.-]+)", re.MULTILINE)
TEMPLATED = re.compile(r"^\$\{?[\w.:]+\}?$")


def kind_of(data, path):
    if not isinstance(data, dict):
        return "other"
    if isinstance(data.get("panels"), list) or isinstance((data.get("dashboard") or {}).get("panels"), list):
        return "dashboard"
    lowered = path.lower()
    if ("condition" in data and "data" in data) or "$extends" in data or ("alert" in lowered and "title" in data):
        return "alert"
    if "datasources" in data or ("type" in data and any(k in data for k in ("access", "jsonData", "url")) and "datasource" in lowered):
        return "datasource"
    if "receivers" in data or "contact" in lowered:
        return "contact-point"
    return "other"


def dashboard_body(data):
    return data["dashboard"] if isinstance(data.get("dashboard"), dict) else data


def panels(items):
    for panel in items or []:
        if isinstance(panel, dict):
            yield panel
            yield from panels(panel.get("panels"))


def leaves(value, path=""):
    """Yield path=value strings for every leaf, list indexes dropped, ignored keys skipped."""
    if isinstance(value, dict):
        for key, child in value.items():
            if key not in IGNORED_KEYS:
                yield from leaves(child, f"{path}.{key}")
    elif isinstance(value, list):
        for child in value:
            yield from leaves(child, f"{path}[]")
    else:
        yield f"{path}={json.dumps(value, ensure_ascii=False)}"


def walk_values(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_values(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_values(child)


def datasource_uids(data):
    for node in walk_values(data):
        source = node.get("datasource") if isinstance(node, dict) else None
        if isinstance(source, dict) and isinstance(source.get("uid"), str):
            yield source["uid"]
        elif isinstance(source, str) and source:
            yield source
        if isinstance(node.get("datasourceUid"), str):
            yield node["datasourceUid"]


def queries(data):
    for node in walk_values(data):
        for key in QUERY_KEYS:
            text = node.get(key)
            if isinstance(text, str) and len(text.strip()) > 8 and not re.fullmatch(r"[\w.$-]+", text.strip()):
                yield " ".join(text.split())


def jaccard(a, b):
    return len(a & b) / len(a | b) if a and b else 0.0


def near_copies(items, threshold):
    groups = []
    used = set()
    for i, (file, shingles) in enumerate(items):
        if i in used:
            continue
        group = [file]
        for j in range(i + 1, len(items)):
            if j not in used and jaccard(shingles, items[j][1]) >= threshold:
                group.append(items[j][0])
                used.add(j)
        if len(group) > 1:
            groups.append(group)
    return sorted(groups, key=len, reverse=True)


def resolve_extends(file, target, root):
    candidate = (root / Path(file).parent / target).resolve()
    try:
        return candidate.relative_to(root.resolve()).as_posix()
    except ValueError:
        return str(candidate)


def build(root, threshold, extends_key, large_panels):
    root = Path(root)
    docs = {}
    unreadable = []
    for path in walk(root, {".json"}):
        rel = path.relative_to(root).as_posix()
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, UnicodeDecodeError):
            unreadable.append(rel)
            continue
        docs[rel] = {"data": data, "kind": kind_of(data, rel)}

    provisioned = set()
    for path in walk(root, {".yaml", ".yml"}):
        if "datasource" in path.as_posix().lower():
            provisioned.update(YAML_UID.findall(path.read_text(encoding="utf-8", errors="replace")))
    for doc in docs.values():
        if doc["kind"] == "datasource":
            entries = doc["data"].get("datasources") if isinstance(doc["data"].get("datasources"), list) else [doc["data"]]
            provisioned.update(e["uid"] for e in entries if isinstance(e, dict) and isinstance(e.get("uid"), str))

    findings = defaultdict(list)
    counts = Counter(doc["kind"] for doc in docs.values())
    uids = defaultdict(list)
    used_sources = defaultdict(set)
    query_places = defaultdict(set)
    children = defaultdict(list)
    shingles = defaultdict(list)

    for file, doc in sorted(docs.items()):
        data, kind = doc["data"], doc["kind"]
        if kind in ("dashboard", "alert"):
            body = dashboard_body(data) if kind == "dashboard" else data
            if isinstance(body.get("uid"), str):
                uids[(kind, body["uid"])].append(file)
            elif kind == "dashboard":
                findings["dashboards_without_uid"].append({"file": file})
            for uid in datasource_uids(body):
                if not is_variable_or_builtin(uid):
                    used_sources[uid].add(file)
            for query in set(queries(body)):
                query_places[query].add(file)
            shingles[kind].append((file, set(leaves(body))))
        if kind == "dashboard":
            body = dashboard_body(data)
            count = sum(1 for _ in panels(body.get("panels")))
            if isinstance(body.get("id"), int):
                findings["committed_dashboard_ids"].append({"file": file, "id": body["id"]})
            if count > large_panels:
                findings["large_dashboards"].append({"file": file, "panels": count})
        if isinstance(data, dict) and isinstance(data.get(extends_key), str):
            target = resolve_extends(file, data[extends_key], root)
            children[target].append(file)
            if target not in docs:
                findings["missing_bases"].append({"file": file, "extends": data[extends_key]})

    for (kind, uid), files in uids.items():
        if len(files) > 1:
            findings["duplicate_uids"].append({"kind": kind, "uid": uid, "files": files})
    if provisioned:
        for uid, files in sorted(used_sources.items()):
            if uid not in provisioned:
                findings["unprovisioned_datasources"].append({"uid": uid, "used_in": len(files), "example": sorted(files)[0]})
    for query, files in sorted(query_places.items(), key=lambda item: -len(item[1])):
        if len(files) >= 3:
            findings["repeated_queries"].append({"query": query[:160], "files": len(files), "example": sorted(files)[0]})
    for kind, items in shingles.items():
        for group in near_copies(items, threshold):
            extended = [f for f in group if isinstance(docs[f]["data"], dict) and extends_key in docs[f]["data"]]
            if len(extended) < len(group):
                findings["near_copies"].append({"kind": kind, "files": group})

    bases = [{"file": base, "children": len(files)} for base, files in sorted(children.items(), key=lambda item: -len(item[1]))]
    return {
        "root": str(root.resolve()),
        "counts": dict(counts),
        "jsonnet_files": sum(1 for _ in walk(root, {".jsonnet", ".libsonnet"})),
        "unreadable_json": unreadable,
        "provisioned_datasources": sorted(provisioned),
        "bases": bases,
        "findings": {key: value for key, value in findings.items() if value},
    }


def is_variable_or_builtin(uid):
    """True for datasource references that are variables or built-ins, not fixed UIDs."""
    return bool(TEMPLATED.match(uid)) or uid in ("-- Grafana --", "-- Mixed --", "-- Dashboard --", "grafana", "__expr__")


def print_text(report, limit):
    print(f"Grafana files under {report['root']}: " + ", ".join(f"{k} {v}" for k, v in sorted(report["counts"].items())))
    if report["jsonnet_files"]:
        print(f"Jsonnet files (not evaluated): {report['jsonnet_files']}")
    print(f"Provisioned datasource UIDs: {len(report['provisioned_datasources'])}")
    if report["bases"]:
        print("\nBase files and their children:")
        for base in report["bases"][:limit]:
            print(f"  {base['children']:4d}  {base['file']}")
    for key, items in report["findings"].items():
        print(f"\n{key.replace('_', ' ')} ({len(items)}):")
        for item in items[:limit]:
            print("  " + "; ".join(f"{k}={v}" for k, v in item.items()))
        if len(items) > limit:
            print(f"  ... {len(items) - limit} more (use --json for all)")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("root", nargs="?", default=".", help="Repository or folder to scan (default: current folder)")
    parser.add_argument("--json", action="store_true", help="Print the full inventory as JSON")
    parser.add_argument("--threshold", type=float, default=0.7,
                        help="Similarity from 0 to 1 above which two files count as near-copies (default 0.7)")
    parser.add_argument("--extends-key", default="$extends", help="Key that points a JSON file at its base file (default $extends)")
    parser.add_argument("--large-panels", type=int, default=40, help="Panel count above which a dashboard is oversized (default 40)")
    parser.add_argument("--limit", type=int, default=15, help="Rows to print per finding in text mode (default 15)")
    args = parser.parse_args()

    if not Path(args.root).is_dir():
        raise SystemExit(f"not a folder: {args.root}")
    report = build(args.root, args.threshold, args.extends_key, args.large_panels)
    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    elif not report["counts"]:
        print("no JSON files found", file=sys.stderr)
    else:
        print_text(report, args.limit)


if __name__ == "__main__":
    main()
