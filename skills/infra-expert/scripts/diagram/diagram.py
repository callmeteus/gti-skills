"""Draw plain infrastructure diagrams from local, read-only inputs.

Subcommands:

- terraform --scan FILE: a graph of leaves and modules from terraform_scan.py JSON.
- compose FILE...: services, networks, published ports, volumes, depends_on edges.
- packages DIR: workspace packages and their internal dependency edges.
- hosts FILE: a topology from a Markdown host table.
- flow FILE: a flowchart from a small YAML or JSON description.

Every command writes <name>.mmd and <name>.html under the output folder. The
HTML page loads Mermaid from the same CDN as the review report and also shows
the source as text, so it reads offline. When mmdc is on PATH, --format svg|png
also writes an image. Generated files go to
~/.gti/infra-expert/<project>/diagrams/ (GTI_HOME replaces ~/.gti), never into
the user's repository.

Only the Python standard library is used, on Python 3.8 and later.
"""

import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
from collections import OrderedDict
from pathlib import Path


MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs"
REDACTED = "<redacted>"
LAYER_KEYS = ("foundation", "identity", "network", "storage", "data", "compute", "observability", "delivery")
SKIP_DIRS = {"node_modules", ".venv", "venv", ".git", "__pycache__", "dist", "build"}

SHAPES = {
    "step": "[{label}]",
    "decision": "{{{label}}}",
    "start": "([{label}])",
    "end": "([{label}])",
    "store": "[({label})]",
    "module": "[[{label}]]",
    "root": "([{label}])",
    "host": "[{label}]",
    "more": "[{label}]",
    "network": "[[{label}]]",
    "volume": "[({label})]",
}

CSS = """
:root { --bg: #f7f7f5; --surface: #fff; --text: #1d1f23; --muted: #5d6470; --line: #e2e3e0; --code: #f1f2ef; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #15171a; --surface: #1d2024; --text: #e7e8ea; --muted: #a0a6b0; --line: #30343a; --code: #262a30; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text);
  font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 40px 16px 64px; }
h1 { font-size: 1.75rem; margin: 0 0 4px; }
h2 { font-size: 1.15rem; margin: 32px 0 10px; }
p { margin: 0 0 16px; }
.meta, footer { color: var(--muted); font-size: 0.9rem; }
.diagram, .source { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 16px; }
pre { margin: 0; overflow-x: auto; white-space: pre; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.85rem; }
.source { background: var(--code); }
footer { margin-top: 32px; }
"""


def gti_dir(skill, *parts):
    """Folder for generated files: ~/.gti/<skill>/... (GTI_HOME replaces ~/.gti). Never the user's repository."""
    base = Path(os.environ.get("GTI_HOME") or Path.home() / ".gti").expanduser()
    folder = base.joinpath(skill, *parts)
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def project_name(start=None):
    """Name of the project being worked on: the git root's folder name, or the current folder's."""
    here = Path(start or Path.cwd()).resolve()
    for folder in (here, *here.parents):
        if (folder / ".git").exists():
            return folder.name or "project"
    return here.name or "project"


def slug(value):
    text = re.sub(r"[^A-Za-z0-9]+", "_", str(value)).strip("_").lower()
    return text or "n"


def safe_name(value):
    """File base name: keep hyphens, replace everything else that is not alphanumeric."""
    text = re.sub(r"[^A-Za-z0-9_-]+", "_", str(value)).strip("_")
    return text or "diagram"


SECRET_PATTERNS = [
    re.compile(r"(?i)\b(password|passwd|pwd|token|secret|api[_-]?key)\s*[=:]\s*[\"']?([^\s\"',;}\]]+)"),
    re.compile(r"\b(?:sk|rk)-[A-Za-z0-9_-]{16,}\b"),
    re.compile(r"\bAKIA[0-9A-Z]{12,}\b"),
    re.compile(r"\b[0-9a-fA-F]{32,}\b"),
    re.compile(r"\b(?=[A-Za-z0-9_-]*[A-Z])(?=[A-Za-z0-9_-]*[a-z])(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{32,}\b"),
    re.compile(r"\b(?=[a-z0-9]*\d)[a-z0-9]{32,}\b"),
]


def redact(value):
    """Replace secret-looking values with <redacted> before they reach a diagram."""
    if value is None:
        return ""
    text = str(value)
    text = SECRET_PATTERNS[0].sub(lambda m: "{}={}".format(m.group(1), REDACTED), text)
    for pattern in SECRET_PATTERNS[1:]:
        text = pattern.sub(REDACTED, text)
    return text


def mermaid_label(value):
    """Quote a label for Mermaid and neutralize characters that break its syntax."""
    text = redact(value)
    text = text.replace("\\", "\\\\").replace('"', "'")
    text = text.replace("\r", " ").replace("\n", " ").replace("\t", " ")
    return '"' + text + '"'


class Graph(object):
    """Small ordered graph that assigns stable, unique Mermaid node ids."""

    def __init__(self, title, direction="TB"):
        self.title = title
        self.direction = direction
        self.nodes = []
        self.edges = []
        self._ids = set()

    def unique_id(self, hint):
        base = slug(hint)
        if base[0].isdigit():
            base = "n" + base
        candidate = base
        number = 2
        while candidate in self._ids:
            candidate = "{}_{}".format(base, number)
            number += 1
        self._ids.add(candidate)
        return candidate

    def add_node(self, label, group="", kind="step", hint=None):
        node_id = self.unique_id(hint or label)
        self.nodes.append({"id": node_id, "label": label, "group": group, "kind": kind})
        return node_id

    def add_edge(self, source, target, label=""):
        self.edges.append({"source": source, "target": target, "label": label})


def cap_graph(graph, max_nodes):
    """Collapse nodes past max_nodes per group into one '+N more' node per group."""
    if max_nodes <= 0:
        return
    groups = OrderedDict()
    for node in graph.nodes:
        groups.setdefault(node["group"], []).append(node["id"])
    removed = {}
    additions = []
    for group, node_ids in groups.items():
        if len(node_ids) <= max_nodes:
            continue
        extra = node_ids[max_nodes:]
        collapse_id = graph.unique_id("more_" + (group or "ungrouped"))
        additions.append({"id": collapse_id, "label": "+{} more".format(len(extra)),
                          "group": group, "kind": "more"})
        for node_id in extra:
            removed[node_id] = collapse_id
    if not removed:
        return
    graph.nodes = [n for n in graph.nodes if n["id"] not in removed] + additions
    edges = []
    seen = set()
    for edge in graph.edges:
        source = removed.get(edge["source"], edge["source"])
        target = removed.get(edge["target"], edge["target"])
        if source == target:
            continue
        key = (source, target, str(edge.get("label") or ""))
        if key in seen:
            continue
        seen.add(key)
        edges.append({"source": source, "target": target, "label": edge.get("label") or ""})
    graph.edges = edges


def node_line(node):
    template = SHAPES.get(node.get("kind"), "[{label}]")
    return "{}{}".format(node["id"], template.format(label=mermaid_label(node["label"])))


def to_mermaid(graph):
    """Render a Graph as Mermaid flowchart source."""
    title = redact(graph.title).replace("\r", " ").replace("\n", " ")
    lines = ["%% {}".format(title), "flowchart {}".format(graph.direction)]
    groups = OrderedDict()
    for node in graph.nodes:
        groups.setdefault(node.get("group") or "", []).append(node)
    subgraphs = set()
    for group, nodes in groups.items():
        if not group:
            for node in nodes:
                lines.append("  " + node_line(node))
            continue
        name = "sg_" + slug(group)
        if name in subgraphs:
            name = graph.unique_id(name)
        subgraphs.add(name)
        lines.append("  subgraph {}[{}]".format(name, mermaid_label(group)))
        for node in nodes:
            lines.append("    " + node_line(node))
        lines.append("  end")
    for edge in graph.edges:
        source, target = edge["source"], edge["target"]
        if edge.get("label"):
            lines.append("  {} -->|{}| {}".format(source, mermaid_label(edge["label"]), target))
        else:
            lines.append("  {} --> {}".format(source, target))
    return "\n".join(lines)


def render_html(title, source):
    """Self-contained page: Mermaid from the CDN, with the source shown as text for offline reading."""
    safe_title = html.escape(str(title), quote=True)
    safe_source = html.escape(source, quote=True)
    return """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>{css}</style>
<script type="module">
  import mermaid from "{url}";
  mermaid.initialize({{ startOnLoad: true, securityLevel: "strict", theme: "neutral" }});
</script>
</head>
<body>
<main>
  <h1>{title}</h1>
  <p class="meta">Generated by the Infra Expert skill. Nothing in the repository or the cloud account was changed.</p>
  <div class="diagram"><pre class="mermaid">{source}</pre></div>
  <h2>Mermaid source</h2>
  <p class="meta">The source is also shown as text, so this page still reads without network access.</p>
  <pre class="source">{source}</pre>
  <footer>Diagram from local, read-only inputs. Secret-looking values are shown as &lt;redacted&gt;.</footer>
</main>
</body>
</html>
""".format(title=safe_title, css=CSS, url=MERMAID_URL, source=safe_source)


def strip_comment(line):
    """Remove a YAML or TOML comment that starts outside a quoted string."""
    quote = None
    escaped = False
    for index, char in enumerate(line):
        if escaped:
            escaped = False
            continue
        if char == "\\" and quote == '"':
            escaped = True
            continue
        if quote:
            if char == quote:
                quote = None
        elif char in "\"'":
            quote = char
        elif char == "#" and (index == 0 or line[index - 1].isspace()):
            return line[:index]
    return line


def split_top(text, separator=","):
    """Split on a separator that is not inside quotes or brackets."""
    parts = []
    buffer = []
    depth = 0
    quote = None
    escaped = False
    for char in text:
        if escaped:
            buffer.append(char)
            escaped = False
            continue
        if char == "\\" and quote == '"':
            buffer.append(char)
            escaped = True
            continue
        if quote:
            buffer.append(char)
            if char == quote:
                quote = None
            continue
        if char in "\"'":
            quote = char
            buffer.append(char)
            continue
        if char in "[{":
            depth += 1
            buffer.append(char)
            continue
        if char in "]}":
            depth -= 1
            buffer.append(char)
            continue
        if char == separator and depth == 0:
            parts.append("".join(buffer).strip())
            buffer = []
        else:
            buffer.append(char)
    parts.append("".join(buffer).strip())
    return [part for part in parts if part]


def parse_scalar(value):
    """Parse the small YAML and TOML subset the diagram inputs use."""
    value = str(value).strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    if value.startswith("[") and value.endswith("]"):
        inner = value[1:-1].strip()
        return [parse_scalar(item) for item in split_top(inner)] if inner else []
    if value.startswith("{") and value.endswith("}"):
        inner = value[1:-1].strip()
        result = {}
        for item in split_top(inner):
            key, _, item_value = item.partition(":")
            if not item_value:
                key, _, item_value = item.partition("=")
            result[key.strip().strip("\"'")] = parse_scalar(item_value)
        return result
    lowered = value.lower()
    if lowered in ("true", "false"):
        return lowered == "true"
    if lowered in ("null", "~", "none", ""):
        return None
    if re.fullmatch(r"-?\d+", value):
        return int(value)
    if re.fullmatch(r"-?\d+\.\d+", value):
        return float(value)
    return value


class MiniYaml(object):
    """Indentation-based reader for the mapping and sequence subset used here."""

    def __init__(self, text):
        self.lines = []
        for raw in text.splitlines():
            line = strip_comment(raw).rstrip()
            if not line.strip():
                continue
            indent = len(line) - len(line.lstrip(" "))
            self.lines.append((indent, line.strip()))
        self.position = 0

    def parse(self):
        if not self.lines:
            return {}
        return self.block(self.lines[0][0])

    def block(self, indent):
        if self.position >= len(self.lines):
            return None
        content = self.lines[self.position][1]
        if content == "-" or content.startswith("- "):
            return self.sequence(indent)
        return self.mapping(indent)

    def mapping(self, indent):
        result = {}
        while self.position < len(self.lines):
            current_indent, content = self.lines[self.position]
            if current_indent < indent or content == "-" or content.startswith("- "):
                break
            if current_indent > indent:
                self.position += 1
                continue
            key, separator, value = content.partition(":")
            if not separator:
                self.position += 1
                continue
            key = key.strip().strip("\"'")
            value = value.strip()
            self.position += 1
            if value:
                result[key] = parse_scalar(value)
            elif self.position < len(self.lines) and self.lines[self.position][0] > indent:
                result[key] = self.block(self.lines[self.position][0])
            else:
                result[key] = {}
        return result

    def sequence(self, indent):
        result = []
        while self.position < len(self.lines):
            current_indent, content = self.lines[self.position]
            if current_indent < indent:
                break
            if current_indent > indent:
                self.position += 1
                continue
            if content != "-" and not content.startswith("- "):
                break
            item = content[1:].strip()
            self.position += 1
            inline_map = bool(re.match(r'^[^:\[\]{}"\']+:\s', item)) or item.endswith(":")
            if not item:
                if self.position < len(self.lines) and self.lines[self.position][0] > indent:
                    result.append(self.block(self.lines[self.position][0]))
                else:
                    result.append(None)
            elif inline_map:
                node = {}
                key, _, value = item.partition(":")
                key = key.strip().strip("\"'")
                value = value.strip()
                if value:
                    node[key] = parse_scalar(value)
                elif self.position < len(self.lines) and self.lines[self.position][0] > indent:
                    node[key] = self.block(self.lines[self.position][0])
                else:
                    node[key] = {}
                while self.position < len(self.lines) and self.lines[self.position][0] > indent:
                    node.update(self.mapping(self.lines[self.position][0]))
                result.append(node)
            else:
                result.append(parse_scalar(item))
        return result


def parse_toml(text):
    """Read the section headers and key/value pairs needed from a pyproject.toml file."""
    result = {}
    section = result
    for raw in text.splitlines():
        line = strip_comment(raw).strip()
        if not line:
            continue
        if line.startswith("[[") and line.endswith("]]"):
            keys = [part.strip().strip("\"'") for part in line[2:-2].split(".")]
            section = result
            for key in keys:
                table = section.setdefault(key, [])
                if not table:
                    table.append({})
                section = table[-1]
            continue
        if line.startswith("[") and line.endswith("]"):
            keys = [part.strip().strip("\"'") for part in line[1:-1].split(".")]
            section = result
            for key in keys:
                section = section.setdefault(key, {})
            continue
        if "=" in line:
            key, _, value = line.partition("=")
            section[key.strip().strip("\"'")] = parse_scalar(value)
    return result


def load_structured(path):
    """Load a JSON file, or parse a small YAML subset when the extension is not .json."""
    path = Path(path)
    text = path.read_text(encoding="utf-8").lstrip("\ufeff")
    if path.suffix.lower() == ".json":
        return json.loads(text)
    if text.lstrip().startswith(("{", "[")):
        try:
            return json.loads(text)
        except ValueError:
            pass
    return MiniYaml(text).parse()


def layer_of_folder(folder):
    """Group a scan folder by its dominant layer, then by its path, then as 'other'."""
    resources = folder.get("resources") or {}
    if resources:
        return max(resources.items(), key=lambda item: item[1])[0]
    path = str(folder.get("path") or "").lower()
    for layer in LAYER_KEYS:
        if re.search(r"(^|/)" + layer + r"(/|$)", path):
            return layer
    return "other"


def module_target(folder, source):
    """Resolve a local module source to a folder relative to the scan root."""
    source = str(source or "").strip('"')
    if not source.startswith(("./", "../")):
        return None
    parts = [] if folder in ("", ".") else folder.split("/")
    for part in source.split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            if not parts:
                return None
            parts.pop()
        else:
            parts.append(part)
    return "/".join(parts) or "."


def build_terraform(data, title=None, direction=None):
    graph = Graph(title or "Terraform graph", direction or "TB")
    folders = sorted(data.get("folders") or [], key=lambda item: str(item.get("path") or ""))
    ids = {}
    for folder in folders:
        path = str(folder.get("path") or ".")
        label = path
        if folder.get("kind"):
            label = "{} ({})".format(path, folder["kind"])
        kind = "root" if folder.get("role") == "root" else "module"
        ids[path] = graph.add_node(label, group=layer_of_folder(folder), kind=kind, hint=path)
    for folder in folders:
        path = str(folder.get("path") or ".")
        source = ids.get(path)
        if not source:
            continue
        for module in folder.get("modules") or []:
            target = ids.get(module_target(path, module.get("source")))
            if target:
                graph.add_edge(source, target, label=module.get("name") or "")
    return graph


def build_compose(paths, title=None, direction=None):
    services = OrderedDict()
    networks = set()
    volumes = set()
    for path in paths:
        data = load_structured(path)
        for name, config in (data.get("services") or {}).items():
            services[name] = config or {}
        networks.update((data.get("networks") or {}).keys())
        volumes.update((data.get("volumes") or {}).keys())
    graph = Graph(title or "Compose services", direction or "TB")
    ids = {}
    for name, config in services.items():
        ports = [str(port) for port in (config.get("ports") or [])]
        label = str(name)
        if ports:
            label += "<br/>" + ", ".join(ports)
        ids[name] = graph.add_node(label, group="services", kind="step", hint=name)
    for name in sorted(networks):
        ids["network:" + name] = graph.add_node(name, group="networks", kind="network", hint="network " + name)
    for name in sorted(volumes):
        ids["volume:" + name] = graph.add_node(name, group="volumes", kind="volume", hint="volume " + name)
    for name, config in services.items():
        source = ids.get(name)
        if not source:
            continue
        nets = config.get("networks") or []
        if isinstance(nets, dict):
            nets = list(nets.keys())
        for net in nets:
            target = ids.get("network:" + str(net))
            if target:
                graph.add_edge(source, target, label="network")
        for mount in config.get("volumes") or []:
            head = str(mount).split(":", 1)[0]
            if head in volumes:
                graph.add_edge(source, ids["volume:" + head], label="mount")
        depends = config.get("depends_on") or []
        if isinstance(depends, dict):
            depends = list(depends.keys())
        for dependency in depends:
            target = ids.get(str(dependency))
            if target:
                graph.add_edge(source, target, label="depends on")
    return graph


def build_packages(root, title=None, direction=None):
    root = Path(root).expanduser()
    packages = {}
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(root)
        if any(part in SKIP_DIRS for part in relative.parts[:-1]):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        if path.name == "package.json":
            try:
                data = json.loads(text)
            except ValueError:
                continue
            name = data.get("name")
            deps = list((data.get("dependencies") or {}).keys())
            deps += list((data.get("devDependencies") or {}).keys())
            ecosystem = "npm"
        elif path.name == "pyproject.toml":
            data = parse_toml(text)
            project = data.get("project") or {}
            poetry = (data.get("tool") or {}).get("poetry") or {}
            name = project.get("name") or poetry.get("name")
            deps = []
            items = list(project.get("dependencies") or [])
            for group in (project.get("optional-dependencies") or {}).values():
                items.extend(group or [])
            for item in items:
                match = re.match(r"[A-Za-z0-9_.-]+", str(item))
                if match:
                    deps.append(match.group(0))
            for dep in (poetry.get("dependencies") or {}):
                if dep != "python":
                    deps.append(dep)
            ecosystem = "python"
        else:
            continue
        if not name:
            continue
        packages[str(name)] = {"deps": deps, "ecosystem": ecosystem}
    graph = Graph(title or "Package graph", direction or "TB")
    ids = {}
    for name in sorted(packages):
        ids[name] = graph.add_node(name, group=packages[name]["ecosystem"], kind="step", hint=name)
    for name in sorted(packages):
        for dependency in packages[name]["deps"]:
            if dependency in ids and dependency != name:
                graph.add_edge(ids[name], ids[dependency])
    return graph


def clean_cell(value):
    text = str(value or "").strip()
    if len(text) >= 2 and text[0] == text[-1] == "`":
        text = text[1:-1]
    return text.strip()


def markdown_table(path):
    """Read the Markdown table with Name and Kind columns as cell dictionaries."""
    blocks = []
    current = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("|"):
            current.append(line)
            continue
        if current:
            blocks.append(current)
            current = []
    if current:
        blocks.append(current)
    tables = []
    for block in blocks:
        rows = []
        for line in block:
            cells = [cell.strip() for cell in line.strip("|").split("|")]
            if cells and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
                continue
            rows.append(cells)
        if not rows:
            continue
        header = [clean_cell(cell).lower() for cell in rows[0]]
        tables.append([{header[index]: cells[index] for index in range(min(len(header), len(cells)))}
                       for cells in rows[1:]])
    for table in tables:
        if table and "name" in table[0] and "kind" in table[0]:
            return table
    return tables[0] if tables else []


def column(row, *names):
    for name in names:
        for key in row:
            if key == name or name in key:
                return row.get(key)
    return ""


def build_hosts(path, title=None, direction=None, group_by="group"):
    graph = Graph(title or "Host topology", direction or "TB")
    rows = markdown_table(path)
    for index, row in enumerate(rows, 1):
        name = clean_cell(column(row, "name")) or "host-{}".format(index)
        kind = clean_cell(column(row, "kind"))
        address = clean_cell(column(row, "address", "how to reach"))
        group = clean_cell(column(row, "group")) if group_by != "kind" else kind
        label = name
        if address:
            label += "<br/>" + address
        graph.add_node(label, group=group or "hosts", kind="host", hint=name)
    return graph


def build_flow(data, title=None, direction=None):
    graph = Graph(title or data.get("title") or "Flow", direction or data.get("direction") or "TB")
    lanes = {}
    for lane in data.get("lanes") or []:
        name = lane.get("name") or lane.get("label") or lane.get("id") or "lane"
        for node_id in lane.get("nodes") or []:
            lanes[str(node_id)] = str(name)
    ids = {}
    for node in data.get("nodes") or []:
        original = str(node.get("id") or "")
        label = node.get("label") or original or "node"
        kind = node.get("kind") or "step"
        if kind not in SHAPES:
            kind = "step"
        ids[original] = graph.add_node(label, group=lanes.get(original, ""),
                                       kind=kind, hint=original or label)
    for edge in data.get("edges") or []:
        source = ids.get(str(edge.get("from") or ""))
        target = ids.get(str(edge.get("to") or ""))
        if source and target:
            graph.add_edge(source, target, label=edge.get("label") or "")
    return graph


def build_parser():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--title", default=None, help="Title for the diagram and the HTML page")
    common.add_argument("--out", default=None, help="Output folder (default: ~/.gti/infra-expert/<project>/diagrams)")
    common.add_argument("--direction", choices=("LR", "TB"), default=None, help="Flowchart direction (default: TB)")
    common.add_argument("--max-nodes", type=int, default=40,
                        help="Keep at most this many nodes per group and collapse the rest into '+N more' (default: 40)")
    common.add_argument("--name", default=None, help="Base file name (default: the subcommand name)")
    common.add_argument("--format", choices=("svg", "png"), default="svg",
                        help="Image format written when mmdc is on PATH (default: svg)")
    subcommands = parser.add_subparsers(dest="command", required=True)
    terraform = subcommands.add_parser("terraform", parents=[common], help="Graph of leaves and modules from scan JSON")
    terraform.add_argument("--scan", required=True, help="JSON output of terraform_scan.py")
    compose = subcommands.add_parser("compose", parents=[common], help="Services, networks, ports, volumes, dependencies")
    compose.add_argument("files", nargs="+", help="One or more Compose YAML or JSON files")
    packages = subcommands.add_parser("packages", parents=[common], help="Workspace packages and internal dependencies")
    packages.add_argument("dir", help="Folder to search for package.json and pyproject.toml files")
    hosts = subcommands.add_parser("hosts", parents=[common], help="Topology from a Markdown host table")
    hosts.add_argument("file", help="Markdown file, for example .gti/infra-expert/hosts.md")
    hosts.add_argument("--group-by", choices=("group", "kind"), default="group",
                       help="Group hosts by the Group or the Kind column (default: group)")
    flow = subcommands.add_parser("flow", parents=[common], help="Flowchart from a small YAML or JSON file")
    flow.add_argument("file", help="Flow description with nodes, edges, and optional lanes")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    if args.command == "terraform":
        data = load_structured(args.scan)
        graph = build_terraform(data, args.title, args.direction)
    elif args.command == "compose":
        graph = build_compose(args.files, args.title, args.direction)
    elif args.command == "packages":
        graph = build_packages(args.dir, args.title, args.direction)
    elif args.command == "hosts":
        graph = build_hosts(args.file, args.title, args.direction, args.group_by)
    else:
        graph = build_flow(load_structured(args.file), args.title, args.direction)

    cap_graph(graph, args.max_nodes)
    source = to_mermaid(graph)
    out_dir = Path(args.out).expanduser() if args.out else gti_dir("infra-expert", project_name(), "diagrams")
    out_dir.mkdir(parents=True, exist_ok=True)
    name = safe_name(args.name or args.command)
    mmd = out_dir / (name + ".mmd")
    page = out_dir / (name + ".html")
    mmd.write_text(source + "\n", encoding="utf-8")
    page.write_text(render_html(graph.title, source), encoding="utf-8")
    print(mmd.resolve())
    print(page.resolve())

    mmdc = shutil.which("mmdc")
    if mmdc:
        image = out_dir / ("{}.{}".format(name, args.format))
        result = subprocess.run([mmdc, "-i", str(mmd), "-o", str(image), "-b", "white"],
                                capture_output=True, text=True, encoding="utf-8")
        if result.returncode == 0 and image.exists():
            print(image.resolve())
        else:
            print("mmdc failed: {}".format((result.stderr or "").strip()), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
