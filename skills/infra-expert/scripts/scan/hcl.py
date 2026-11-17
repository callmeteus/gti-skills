"""Minimal HCL block reader shared by the scan scripts.

It finds top-level blocks (resource, data, module, variable, output, locals,
provider, terraform, moved, import, removed, check) with their labels, line
range, and raw body. Braces inside strings, interpolations, comments, and
heredocs are skipped. It does not evaluate expressions; the scans only need
the shape of each file.
"""

import re
import subprocess
from pathlib import Path

SKIP_DIRS = {".git", ".terraform", ".terragrunt-cache", "node_modules", ".venv", "vendor", "dist", "build"}
BLOCK_START = re.compile(r'^([a-z_][a-z0-9_]*)((?:\s+"[^"\n]*"|\s+[A-Za-z_][\w-]*)*)\s*\{', re.MULTILINE)
HEREDOC = re.compile(r"<<-?\s*([A-Za-z_][A-Za-z0-9_]*)\s*\n")


def tracked(root):
    """Return the set of files git tracks under root, or None outside a git repository."""
    result = subprocess.run(["git", "-C", str(root), "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
                            capture_output=True)
    if result.returncode != 0:
        return None
    return {(Path(root) / name).resolve() for name in result.stdout.decode("utf-8", "replace").split("\0") if name}


def walk(root, suffixes, only=None):
    """Yield files under root with one of the suffixes, skipping caches, vendored code, and,
    when `only` is a set, any file not in it (pass tracked(root) to skip gitignored secrets)."""
    root = Path(root)
    for path in sorted(root.rglob("*")):
        if not path.name.endswith(tuple(suffixes)) or not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.relative_to(root).parts):
            continue
        if only is not None and path.resolve() not in only:
            continue
        yield path


def matching_brace(text, start):
    """Return the index just after the brace that closes the one at text[start]."""
    depth = 0
    i = start
    n = len(text)
    while i < n:
        c = text[i]
        if c == '"':
            i = skip_string(text, i)
            continue
        if c == "#" or text.startswith("//", i):
            end = text.find("\n", i)
            i = n if end < 0 else end
            continue
        if text.startswith("/*", i):
            end = text.find("*/", i + 2)
            i = n if end < 0 else end + 2
            continue
        if text.startswith("<<", i):
            match = HEREDOC.match(text, i)
            if match:
                marker = re.compile(r"^\s*" + re.escape(match.group(1)) + r"\s*$", re.MULTILINE)
                end = marker.search(text, match.end())
                i = n if not end else end.end()
                continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return n


def skip_string(text, start):
    """Return the index just after the string that opens at text[start], following ${ } nesting."""
    i = start + 1
    n = len(text)
    while i < n:
        c = text[i]
        if c == "\\":
            i += 2
            continue
        if c == '"':
            return i + 1
        if text.startswith("${", i) or text.startswith("%{", i):
            i = matching_brace(text, i + 1)
            continue
        if c == "\n":
            return i
        i += 1
    return n


def strip_comments(text):
    """Remove comments, keeping strings intact, so bodies can be compared."""
    out = []
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        if c == '"':
            end = skip_string(text, i)
            out.append(text[i:end])
            i = end
        elif c == "#" or text.startswith("//", i):
            end = text.find("\n", i)
            i = n if end < 0 else end
        elif text.startswith("/*", i):
            end = text.find("*/", i + 2)
            i = n if end < 0 else end + 2
        else:
            out.append(c)
            i += 1
    return "".join(out)


def blocks(text):
    """Yield top-level blocks as dicts: kind, labels, line, end_line, body."""
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        if c in " \t\r\n":
            i += 1
            continue
        if c == "#" or text.startswith("//", i):
            end = text.find("\n", i)
            i = n if end < 0 else end
            continue
        if text.startswith("/*", i):
            end = text.find("*/", i + 2)
            i = n if end < 0 else end + 2
            continue
        match = BLOCK_START.match(text, i)
        if not match:
            end = text.find("\n", i)
            i = n if end < 0 else end + 1
            continue
        open_brace = match.end() - 1
        close = matching_brace(text, open_brace)
        labels = re.findall(r'"([^"\n]*)"|([A-Za-z_][\w-]*)', match.group(2))
        yield {
            "kind": match.group(1),
            "labels": [quoted or bare for quoted, bare in labels],
            "line": text.count("\n", 0, i) + 1,
            "end_line": text.count("\n", 0, close) + 1,
            "body": text[open_brace + 1:close - 1],
        }
        i = close


def attribute(body, name):
    """Return the raw value of a top-level `name = value` line in a block body, or None."""
    match = re.search(r"^\s*" + re.escape(name) + r"\s*=\s*(.+?)\s*$", body, re.MULTILINE)
    return match.group(1) if match else None


def nested(body, kind):
    """Return the bodies of nested blocks named kind (for example ingress or backend)."""
    found = []
    for match in re.finditer(r"(?m)^\s*" + re.escape(kind) + r'(?:\s+"[^"\n]*")*\s*\{', body):
        open_brace = match.end() - 1
        found.append(body[open_brace + 1:matching_brace(body, open_brace) - 1])
    return found
