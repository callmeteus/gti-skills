"""Build the import graph of a codebase and flag cycles and imports of more volatile code.

Resolves imports between files of the project itself for Python (ast), JavaScript and
TypeScript (relative paths and --alias prefixes), and Go (packages under the go.mod module).
Volatility is measured from git history: how often each group changed. An edge from a
group to one that changes much more often is a "depends on something more volatile" lead.

Examples:
  python3 deps.py .                      # folders two levels deep
  python3 deps.py . --depth 0 --edges    # file level, list every edge
  python3 deps.py . --alias @/=src/ --json > deps.json
"""

import argparse
import ast
import json
import posixpath
import re
import sys
from collections import defaultdict
from pathlib import Path, PurePosixPath

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from common.codebase import churn, group_of, iter_source_files, language_of, read_text, utf8_stdout  # noqa: E402

JS_IMPORT = re.compile(
    r"""(?:import|export)\s[^'"`;]*?\sfrom\s*['"]([^'"]+)['"]"""
    r"""|import\s*['"]([^'"]+)['"]"""
    r"""|(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)"""
)
JS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".vue", ".svelte"]
GO_IMPORT_BLOCK = re.compile(r"^import\s*\((.*?)^\)", re.S | re.M)
GO_IMPORT_LINE = re.compile(r'^import\s+(?:[\w.]+\s+)?"([^"]+)"', re.M)
GO_QUOTED = re.compile(r'"([^"]+)"')


def python_module_index(files):
    """Map dotted module names to relative paths, also without a leading src/ or lib/ folder."""
    index = {}
    for relative in files:
        if not relative.endswith(".py"):
            continue
        parts = list(PurePosixPath(relative).with_suffix("").parts)
        if parts[-1] == "__init__":
            parts = parts[:-1]
        if not parts:
            continue
        index.setdefault(".".join(parts), relative)
        if parts[0] in ("src", "lib") and len(parts) > 1:
            index.setdefault(".".join(parts[1:]), relative)
    return index


def resolve_python(name, index):
    parts = name.split(".")
    while parts:
        candidate = ".".join(parts)
        if candidate in index:
            return index[candidate]
        parts.pop()
    return None


def python_imports(relative, text, index):
    try:
        tree = ast.parse(text)
    except (SyntaxError, ValueError):
        return []
    package = list(PurePosixPath(relative).with_suffix("").parts)
    if package and package[-1] == "__init__":
        package = package[:-1]
    else:
        package = package[:-1]
    targets = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            targets.extend(resolve_python(alias.name, index) for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            if node.level:
                base = package[: len(package) - (node.level - 1)] if node.level > 1 else package
                if node.level - 1 > len(package):
                    continue
                prefix = ".".join(base + ([node.module] if node.module else []))
                if node.module:
                    targets.append(resolve_python(prefix, index))
                for alias in node.names:
                    targets.append(resolve_python(f"{prefix}.{alias.name}" if prefix else alias.name, index))
            elif node.module:
                targets.append(resolve_python(node.module, index))
                for alias in node.names:
                    found = resolve_python(f"{node.module}.{alias.name}", index)
                    if found and found != resolve_python(node.module, index):
                        targets.append(found)
    return [t for t in targets if t and t != relative]


def resolve_js(relative, spec, files, aliases):
    for prefix, replacement in aliases:
        if spec.startswith(prefix):
            spec = replacement + spec[len(prefix):]
            base = posixpath.normpath(spec)
            break
    else:
        if not spec.startswith("."):
            return None
        base = posixpath.normpath(posixpath.join(posixpath.dirname(relative), spec))
    stem, ext = posixpath.splitext(base)
    candidates = [base]
    if ext in (".js", ".mjs", ".cjs", ".jsx"):
        candidates += [stem + e for e in (".ts", ".tsx", ".mts", ".cts")]
    candidates += [base + e for e in JS_EXTENSIONS] + [posixpath.join(base, "index" + e) for e in JS_EXTENSIONS]
    for candidate in candidates:
        if candidate in files:
            return candidate
    return None


def js_imports(relative, text, files, aliases):
    targets = []
    for match in JS_IMPORT.finditer(text):
        spec = next(group for group in match.groups() if group)
        found = resolve_js(relative, spec, files, aliases)
        if found and found != relative:
            targets.append(found)
    return targets


def go_module(root):
    text = read_text(Path(root) / "go.mod")
    if not text:
        return None
    match = re.search(r"^module\s+(\S+)", text, re.M)
    return match.group(1) if match else None


def go_imports(relative, text, module, go_dirs):
    if not module:
        return []
    specs = GO_IMPORT_LINE.findall(text)
    for block in GO_IMPORT_BLOCK.findall(text):
        specs.extend(GO_QUOTED.findall(block))
    own_dir = posixpath.dirname(relative)
    targets = []
    for spec in specs:
        if spec == module or spec.startswith(module + "/"):
            directory = spec[len(module) + 1:] if spec != module else ""
            if directory in go_dirs and directory != own_dir:
                targets.append(go_dirs[directory])
    return targets


def strongly_connected(nodes, edges):
    """Tarjan's algorithm, iterative. Returns components with more than one node, sorted."""
    index_of, low, on_stack, stack, components = {}, {}, set(), [], []
    counter = 0
    for start in sorted(nodes):
        if start in index_of:
            continue
        work = [(start, iter(sorted(edges.get(start, ()))))]
        index_of[start] = low[start] = counter
        counter += 1
        stack.append(start)
        on_stack.add(start)
        while work:
            node, children = work[-1]
            advanced = False
            for child in children:
                if child not in index_of:
                    index_of[child] = low[child] = counter
                    counter += 1
                    stack.append(child)
                    on_stack.add(child)
                    work.append((child, iter(sorted(edges.get(child, ())))))
                    advanced = True
                    break
                if child in on_stack:
                    low[node] = min(low[node], index_of[child])
            if advanced:
                continue
            work.pop()
            if work:
                parent = work[-1][0]
                low[parent] = min(low[parent], low[node])
            if low[node] == index_of[node]:
                component = []
                while True:
                    member = stack.pop()
                    on_stack.discard(member)
                    component.append(member)
                    if member == node:
                        break
                if len(component) > 1:
                    components.append(sorted(component))
    return sorted(components, key=lambda c: (-len(c), c))


def build_graph(root, depth=2, aliases=(), include_tests=False, commits=500, extra_ignore=()):
    root = Path(root).resolve()
    entries = list(iter_source_files(root, extra_ignore, include_tests))
    files = {relative for _, relative in entries}
    py_index = python_module_index(files)
    module = go_module(root)
    go_dirs = {}
    for relative in sorted(files):
        if relative.endswith(".go"):
            go_dirs.setdefault(posixpath.dirname(relative), relative)

    file_edges = defaultdict(set)
    unsupported = defaultdict(int)
    for full, relative in entries:
        language = language_of(relative)
        text = read_text(full)
        if text is None:
            continue
        if language == "python":
            targets = python_imports(relative, text, py_index)
        elif language == "js":
            targets = js_imports(relative, text, files, aliases)
        elif language == "go":
            targets = go_imports(relative, text, module, go_dirs)
        else:
            unsupported[language] += 1
            continue
        file_edges[relative].update(targets)

    file_churn = churn(root, commits)
    group_churn = defaultdict(int)
    nodes = set()
    for relative in files:
        group = group_of(relative, depth)
        nodes.add(group)
        group_churn[group] += file_churn.get(relative, 0)

    edges = defaultdict(set)
    weights = defaultdict(int)
    for source, targets in file_edges.items():
        a = group_of(source, depth)
        for target in targets:
            b = group_of(target, depth)
            if a != b:
                edges[a].add(b)
                weights[(a, b)] += 1

    fan_in = defaultdict(int)
    for a, targets in edges.items():
        for b in targets:
            fan_in[b] += 1

    metrics = {}
    for node in sorted(nodes):
        out_count, in_count = len(edges.get(node, ())), fan_in.get(node, 0)
        total = out_count + in_count
        metrics[node] = {
            "fan_out": out_count,
            "fan_in": in_count,
            "instability": round(out_count / total, 2) if total else None,
            "changes": group_churn.get(node, 0),
        }
    return {
        "root": str(root),
        "depth": depth,
        "files": len(files),
        "nodes": metrics,
        "edges": [{"from": a, "to": b, "imports": weights[(a, b)]} for a in sorted(edges) for b in sorted(edges[a])],
        "cycles": strongly_connected(nodes, edges),
        "unsupported_languages": dict(sorted(unsupported.items())),
        "git_history": bool(file_churn),
    }


def volatile_imports(graph, ratio=2.0, minimum=5):
    """Edges where the imported group changed at least `ratio` times as often as the importer."""
    found = []
    nodes = graph["nodes"]
    for edge in graph["edges"]:
        a, b = nodes[edge["from"]]["changes"], nodes[edge["to"]]["changes"]
        if b >= minimum and b >= ratio * max(a, 1):
            found.append({**edge, "from_changes": a, "to_changes": b})
    return sorted(found, key=lambda e: (-(e["to_changes"] / max(e["from_changes"], 1)), e["from"], e["to"]))


def to_text(graph, volatile, top, show_edges):
    lines = [f"Root: {graph['root']}", f"Files: {graph['files']}  Groups: {len(graph['nodes'])}  Edges: {len(graph['edges'])}  Depth: {graph['depth']}"]
    if graph["unsupported_languages"]:
        listed = ", ".join(f"{k} ({v} files)" for k, v in graph["unsupported_languages"].items())
        lines.append(f"Imports not resolved for: {listed}. Read those by hand.")
    if not graph["git_history"]:
        lines.append("No git history found: change counts are zero and volatility checks are skipped.")
    lines += ["", f"Cycles ({len(graph['cycles'])}):"]
    lines += [f"  {' <-> '.join(cycle)}" for cycle in graph["cycles"][:top]] or ["  none"]
    if graph["git_history"]:
        lines += ["", f"Imports of more volatile code ({len(volatile)}):"]
        lines += [f"  {e['from']} ({e['from_changes']} changes) -> {e['to']} ({e['to_changes']} changes)" for e in volatile[:top]] or ["  none"]
    ranked_in = sorted(graph["nodes"].items(), key=lambda kv: (-kv[1]["fan_in"], kv[0]))[:top]
    ranked_out = sorted(graph["nodes"].items(), key=lambda kv: (-kv[1]["fan_out"], kv[0]))[:top]
    lines += ["", "Most depended on (fan-in, changes):"]
    lines += [f"  {name}: {m['fan_in']}, {m['changes']}" for name, m in ranked_in if m["fan_in"]] or ["  none"]
    lines += ["", "Depends on most (fan-out, changes):"]
    lines += [f"  {name}: {m['fan_out']}, {m['changes']}" for name, m in ranked_out if m["fan_out"]] or ["  none"]
    if show_edges:
        lines += ["", "Edges (imports):"]
        lines += [f"  {e['from']} -> {e['to']} ({e['imports']})" for e in graph["edges"]]
    return "\n".join(lines) + "\n"


def parse_alias(value):
    if "=" not in value:
        raise argparse.ArgumentTypeError("use PREFIX=FOLDER/, for example @/=src/")
    prefix, folder = value.split("=", 1)
    return prefix, folder


def main(argv=None):
    utf8_stdout()
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("root", nargs="?", default=".", help="Codebase root (default: current folder)")
    parser.add_argument("--depth", type=int, default=2, help="Folder depth used to group files; 0 = one node per file (default 2)")
    parser.add_argument("--alias", type=parse_alias, action="append", default=[], help="JS/TS import alias PREFIX=FOLDER/, repeatable")
    parser.add_argument("--include-tests", action="store_true", help="Include test files in the graph")
    parser.add_argument("--ignore", action="append", default=[], help="Extra glob to skip, repeatable")
    parser.add_argument("--commits", type=int, default=500, help="Commits of history used for change counts (default 500)")
    parser.add_argument("--ratio", type=float, default=2.0, help="Volatility ratio that flags an import (default 2.0)")
    parser.add_argument("--min-changes", type=int, default=5, help="Ignore imported groups with fewer changes (default 5)")
    parser.add_argument("--top", type=int, default=15, help="Rows per section in text output (default 15)")
    parser.add_argument("--edges", action="store_true", help="List every edge in text output")
    parser.add_argument("--json", action="store_true", help="Print JSON")
    args = parser.parse_args(argv)
    if not Path(args.root).is_dir():
        parser.error(f"not a folder: {args.root}")

    graph = build_graph(args.root, args.depth, args.alias, args.include_tests, args.commits, args.ignore)
    volatile = volatile_imports(graph, args.ratio, args.min_changes) if graph["git_history"] else []
    if args.json:
        print(json.dumps({**graph, "volatile_imports": volatile}, indent=2))
    else:
        sys.stdout.write(to_text(graph, volatile, args.top, args.edges))
    return 0


if __name__ == "__main__":
    sys.exit(main())
