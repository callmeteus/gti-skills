"""Shared helpers for the untangle-codebase scripts: file walking, languages, and git churn.

Standard library only. Nothing here runs project code or uses the network.
"""

import fnmatch
import os
import subprocess
import sys
from collections import Counter
from pathlib import Path, PurePosixPath

SKIP_DIRS = {
    ".git", ".hg", ".svn", "node_modules", "bower_components", "vendor", "third_party",
    "dist", "build", "out", "target", ".next", ".nuxt", ".svelte-kit", ".turbo", ".cache",
    "coverage", "__pycache__", ".venv", "venv", "env", ".tox", ".mypy_cache", ".pytest_cache",
    ".gradle", ".idea", ".vscode", "Pods", "DerivedData", ".untangle",
}

SKIP_FILES = [
    "*.min.js", "*.map", "*.lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
    "*.generated.*", "*_pb2.py", "*.pb.go", "*.d.ts",
]

LANGUAGES = {
    ".py": "python",
    ".js": "js", ".jsx": "js", ".mjs": "js", ".cjs": "js",
    ".ts": "js", ".tsx": "js", ".mts": "js", ".cts": "js",
    ".vue": "js", ".svelte": "js",
    ".go": "go",
    ".java": "java", ".kt": "java", ".kts": "java", ".scala": "java",
    ".cs": "csharp",
    ".rs": "rust",
    ".rb": "ruby",
    ".php": "php",
    ".swift": "swift",
    ".c": "c", ".h": "c", ".cc": "c", ".cpp": "c", ".hpp": "c",
    ".dart": "dart",
}

BRACE_LANGUAGES = {"js", "go", "java", "csharp", "rust", "php", "swift", "c", "dart"}


def utf8_stdout():
    """Print UTF-8 on every platform, so non-ASCII paths do not crash a Windows console."""
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")


def language_of(path):
    return LANGUAGES.get(Path(path).suffix.lower())


def is_test_path(relative):
    lowered = relative.lower()
    name = PurePosixPath(lowered).name
    return (
        "/tests/" in f"/{lowered}" or "/test/" in f"/{lowered}" or "/__tests__/" in f"/{lowered}"
        or name.startswith("test_") or name.endswith("_test.py") or name.endswith("_test.go")
        or ".test." in name or ".spec." in name or name.endswith("test.java") or name.endswith("tests.cs")
    )


def iter_source_files(root, extra_ignore=(), include_tests=True):
    """Yield (absolute Path, posix relative path) for source files, sorted, without following symlinks."""
    root = Path(root).resolve()
    patterns = list(SKIP_FILES) + list(extra_ignore)
    for directory, dirnames, filenames in os.walk(root, followlinks=False):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS and not (Path(directory) / d).is_symlink())
        for name in sorted(filenames):
            full = Path(directory) / name
            if full.is_symlink() or language_of(name) is None:
                continue
            relative = full.relative_to(root).as_posix()
            if any(fnmatch.fnmatch(relative, p) or fnmatch.fnmatch(name, p) for p in patterns):
                continue
            if not include_tests and is_test_path(relative):
                continue
            yield full, relative


def read_text(path, limit=2 * 1024 * 1024):
    try:
        if path.stat().st_size > limit:
            return None
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None


def group_of(relative, depth):
    """Folder prefix used to group files; depth 0 means the file itself."""
    parts = PurePosixPath(relative).parts
    if depth <= 0 or len(parts) <= 1:
        return relative
    return "/".join(parts[: min(depth, len(parts) - 1)])


def git_commits(root, commits=500, since=None):
    """Return a list of commits, each a list of changed posix paths. Empty when git is unavailable."""
    command = ["git", "-C", str(root), "log", "--no-merges", "--name-only", "--format=%x00", f"--max-count={commits}"]
    if since:
        command.append(f"--since={since}")
    try:
        result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", check=False)
    except OSError:
        return []
    if result.returncode != 0:
        return []
    history = []
    current = None
    for line in result.stdout.splitlines():
        line = line.strip()
        if line == "\x00":
            current = []
            history.append(current)
        elif line and current is not None:
            current.append(line)
    return [files for files in history if files]


def git_prefix(root):
    """Path of root relative to the repository top level, posix, '' at the top. None outside git."""
    try:
        result = subprocess.run(["git", "-C", str(root), "rev-parse", "--show-prefix"], capture_output=True, text=True, check=False)
    except OSError:
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip().rstrip("/")


def churn(root, commits=500, since=None):
    """Counter of change counts per file, keyed by path relative to root."""
    prefix = git_prefix(root)
    counts = Counter()
    if prefix is None:
        return counts
    for files in git_commits(root, commits, since):
        for path in files:
            if prefix:
                if not path.startswith(prefix + "/"):
                    continue
                path = path[len(prefix) + 1:]
            counts[path] += 1
    return counts
