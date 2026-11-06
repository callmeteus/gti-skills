"""Print a skeleton of a codebase: imports, types, and signatures without function bodies.

The skeleton is small enough to read the whole codebase at once, with line numbers that
point back to the source. Python is parsed with ast. Brace languages (JavaScript,
TypeScript, Go, Java, Kotlin, C#, Rust, PHP, Swift, C, C++, Dart) keep declarations and
class, interface, struct, and impl members, and fold function and block bodies into "...".

Examples:
  python3 skeleton.py . > skeleton.txt
  python3 skeleton.py src --body-depth 1 --include-tests
"""

import argparse
import ast
import fnmatch
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from common.codebase import BRACE_LANGUAGES, iter_source_files, language_of, read_text, utf8_stdout  # noqa: E402

FOLD = "..."


def python_skeleton(text):
    """Return (line number, text) pairs for imports, top-level assignments, classes, and defs."""
    try:
        tree = ast.parse(text)
    except (SyntaxError, ValueError):
        return None
    lines = text.splitlines()
    out = []

    def header(node):
        start = node.lineno
        if getattr(node, "decorator_list", None):
            start = min(d.lineno for d in node.decorator_list)
        end = node.body[0].lineno - 1 if node.body else node.lineno
        end = max(end, node.lineno)
        for number in range(start, end + 1):
            line = lines[number - 1]
            if line.strip():
                out.append((number, line.rstrip()))
        doc = ast.get_docstring(node, clean=True)
        if doc:
            indent = " " * (node.col_offset + 4)
            out.append((node.body[0].lineno, f'{indent}"""{doc.splitlines()[0]}"""'))

    def visit(body, top):
        for node in body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                header(node)
                out.append((node.body[0].lineno, " " * (node.col_offset + 4) + FOLD))
            elif isinstance(node, ast.ClassDef):
                header(node)
                visit(node.body, False)
            elif top and isinstance(node, (ast.Import, ast.ImportFrom, ast.Assign, ast.AnnAssign)):
                first = lines[node.lineno - 1].rstrip()
                out.append((node.lineno, first if node.end_lineno == node.lineno else first + " " + FOLD))
            elif not top and isinstance(node, (ast.Assign, ast.AnnAssign)):
                out.append((node.lineno, lines[node.lineno - 1].rstrip()))

    visit(tree.body, True)
    return out


CONTAINER = re.compile(
    r"\b(class|interface|struct|enum|impl|trait|namespace|module|object|record|protocol|extension|union)\b"
    r"|\btype\s+\w+\s+(struct|interface)\b|\bextern\s+\"C\""
)


def scan_braces(text):
    """Yield (line number, open body blocks at line start, line), skipping braces in strings and comments.

    A block is a container when the line that opens it (or the previous non-empty line, for
    braces on their own line) declares a class, interface, struct, enum, impl, trait,
    namespace, or similar. Every other block is a body: functions, control flow, literals.
    """
    stack = []
    in_block_comment = False
    header = ""
    for number, line in enumerate(text.splitlines(), 1):
        bodies_at_start = sum(1 for container in stack if not container)
        stripped = line.strip()
        if stripped and stripped not in ("{", "}"):
            header = line
        index, quote = 0, None
        while index < len(line):
            char = line[index]
            pair = line[index:index + 2]
            if in_block_comment:
                if pair == "*/":
                    in_block_comment = False
                    index += 1
            elif quote:
                if char == "\\":
                    index += 1
                elif char == quote:
                    quote = None
            elif pair == "//":
                break
            elif pair == "/*":
                in_block_comment = True
                index += 1
            elif char in "\"'`":
                quote = char
            elif char == "{":
                stack.append(bool(CONTAINER.search(header)))
            elif char == "}" and stack:
                stack.pop()
            index += 1
        yield number, bodies_at_start, line


def brace_skeleton(text, body_depth=0):
    out = []
    folded = False
    for number, bodies, line in scan_braces(text):
        if not line.strip():
            continue
        if bodies <= body_depth:
            out.append((number, line.rstrip()))
            folded = False
        elif not folded:
            out.append((number, " " * (len(line) - len(line.lstrip())) + FOLD))
            folded = True
    return out


def skeleton(root, body_depth=0, include_tests=False, only=(), ignore=()):
    files = []
    total_lines = kept_lines = 0
    for full, relative in iter_source_files(root, ignore, include_tests):
        if only and not any(fnmatch.fnmatch(relative, p) for p in only):
            continue
        text = read_text(full)
        if text is None:
            continue
        language = language_of(relative)
        if language == "python":
            lines = python_skeleton(text)
        elif language in BRACE_LANGUAGES:
            lines = brace_skeleton(text, body_depth)
        else:
            lines = None
        if lines is None:
            lines = [(1, f"{FOLD} not summarized ({language}); read the file")]
        total_lines += text.count("\n") + 1
        kept_lines += len(lines)
        files.append((relative, lines))
    return files, total_lines, kept_lines


def main(argv=None):
    utf8_stdout()
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("root", nargs="?", default=".", help="Codebase root (default: current folder)")
    parser.add_argument("--body-depth", type=int, default=0, help="Levels of function or block bodies to keep in brace languages (default 0)")
    parser.add_argument("--include-tests", action="store_true", help="Include test files")
    parser.add_argument("--only", action="append", default=[], help="Glob of files to include, repeatable")
    parser.add_argument("--ignore", action="append", default=[], help="Extra glob to skip, repeatable")
    args = parser.parse_args(argv)
    if not Path(args.root).is_dir():
        parser.error(f"not a folder: {args.root}")

    files, total, kept = skeleton(args.root, args.body_depth, args.include_tests, args.only, args.ignore)
    for relative, lines in files:
        sys.stdout.write(f"== {relative} ==\n")
        for number, line in lines:
            sys.stdout.write(f"{number:>5}| {line}\n")
        sys.stdout.write("\n")
    ratio = f"{kept / total:.0%}" if total else "0%"
    sys.stderr.write(f"{len(files)} files, {kept} of {total} lines kept ({ratio})\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
