"""Manage a project's infra-expert knowledge folder.

The folder lives at .gti/infra-expert/ at the nearest git root and is committed
with the project. It holds access paths, MCP schemas, host aliases, learnings,
MCP gaps, and pointers to records. It never holds secret values.

Use python3 on macOS and Linux, and python or py -3 on Windows.
"""

import argparse
import datetime
import os
import re
import shutil
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parents[2]
TEMPLATE_DIR = SKILL_DIR / "assets" / "templates" / "project-knowledge"
FOLDER_PARTS = (".gti", "infra-expert")

ENTRY_HEADER = re.compile(r"^## \d{4}-\d{2}-\d{2} - .+$")
LONG_TOKEN = re.compile(r"[A-Za-z0-9+/=_-]{33,}")
SECRET_MARKERS = ("password=", "secret=", "token=")
SECRET_PREFIXES = ("sk-", "ghp_", "AKIA")
ENTRY_FIELDS = {
    "learnings.md": ("What", "Rule", "Source"),
    "mcp-gaps.md": ("Need", "Command", "Proposal", "Status"),
}


def fail(message, code):
    """Print an error and exit with the given status."""
    print(message, file=sys.stderr)
    raise SystemExit(code)


def nearest_git_root(start):
    """Nearest ancestor of start that holds a .git entry, directory or file, or None."""
    current = Path(start).resolve()
    for folder in (current, *current.parents):
        if (folder / ".git").exists():
            return folder
    return None


def knowledge_folder(start):
    """Return the folder at the nearest git root, or at start outside any repository."""
    root = nearest_git_root(start)
    base = root if root is not None else Path(start).resolve()
    candidate = base.joinpath(*FOLDER_PARTS)
    return candidate if candidate.is_dir() else None


def slugify(name):
    """Lowercase a name, turn non-alphanumeric runs into one hyphen, and cap it at 40 characters."""
    slug = re.sub(r"[^a-z0-9]+", "-", (name or "run").lower()).strip("-")
    return slug[:40].rstrip("-") or "run"


def folder_size(path):
    """Return the total size in bytes of the files under a folder."""
    total = 0
    for child in path.rglob("*"):
        if child.is_file():
            try:
                total += child.stat().st_size
            except OSError:
                pass
    return total


def human_size(num):
    """Format a byte count as a short human readable string."""
    value = float(num)
    for unit in ("B", "KiB", "MiB", "GiB"):
        if value < 1024 or unit == "GiB":
            if unit == "B":
                return str(int(value)) + " B"
            return "{:.1f} {}".format(value, unit)
        value /= 1024


def ensure_tmp_ignored(root):
    """Create <root>/.gti/.gitignore with one tmp/ line; never touch the root .gitignore."""
    gti = root / ".gti"
    gti.mkdir(parents=True, exist_ok=True)
    path = gti / ".gitignore"
    text = path.read_text(encoding="utf-8") if path.is_file() else ""
    if any(line.strip() == "tmp/" for line in text.splitlines()):
        return
    if text and not text.endswith("\n"):
        text += "\n"
    path.write_text(text + "tmp/\n", encoding="utf-8")


def is_secret_token(word):
    """Return True for a single word that looks like a credential."""
    core = word.strip("'\"(),;")
    if len(core) <= 32 or not LONG_TOKEN.fullmatch(core):
        return False
    if "//" in core or core.startswith(("/", ".")):
        return False
    return any(char.isdigit() for char in core) and any(char.isalpha() for char in core)


def looks_like_secret(text):
    """Apply simple heuristics to one field before it is written to a file."""
    for word in str(text).split():
        lowered = word.lower()
        if any(marker in lowered for marker in SECRET_MARKERS):
            return True
        if any(word.startswith(prefix) for prefix in SECRET_PREFIXES):
            return True
        if is_secret_token(word):
            return True
    return False


def ensure_not_secret(fields):
    """Refuse a write when any field looks like a secret."""
    for name, value in fields.items():
        if looks_like_secret(value):
            fail(
                "Refusing to write a value that looks like a secret in '" + name + "'. "
                "Store it where access.md says and write only its variable name or "
                "secret-store path as a reference.",
                1)


def resolve_folder(args):
    """Use --dir when given, otherwise find the folder at the nearest git root from the cwd."""
    if getattr(args, "dir", None):
        folder = Path(args.dir).resolve()
        if not folder.is_dir():
            fail("knowledge folder not found: " + str(folder), 2)
        return folder
    folder = knowledge_folder(Path.cwd())
    if folder is None:
        fail("no knowledge folder found; run 'knowledge.py init' or pass --dir", 2)
    return folder


def template_files():
    """Return the template files relative to the template folder."""
    if not TEMPLATE_DIR.is_dir():
        return []
    return sorted(path.relative_to(TEMPLATE_DIR) for path in TEMPLATE_DIR.rglob("*") if path.is_file())


def entry_block(header, fields):
    """Build one dated entry block with one field per line."""
    lines = [header] + ["- " + name + ": " + value for name, value in fields]
    return "\n".join(lines)


def append_block(path, block):
    """Append a block to a file, separated from earlier content by a blank line."""
    existing = path.read_text(encoding="utf-8") if path.is_file() else ""
    if existing:
        existing = existing.rstrip("\n") + "\n\n"
    path.write_text(existing + block + "\n", encoding="utf-8")


def one_line(text):
    """Keep an argument on a single line so the entry format stays valid."""
    return " ".join(str(text).split())


def cmd_find(args):
    """Locate the knowledge folder and print its absolute path."""
    folder = knowledge_folder(args.start)
    if folder is None:
        return 2
    print(folder)
    return 0


def cmd_init(args):
    """Copy the project template into <root>/.gti/infra-expert/."""
    relatives = template_files()
    if not relatives:
        fail("template folder not found: " + str(TEMPLATE_DIR), 1)
    if args.root:
        root = Path(args.root).resolve()
    else:
        root = nearest_git_root(Path.cwd()) or Path.cwd().resolve()
    target = root.joinpath(*FOLDER_PARTS)
    target.mkdir(parents=True, exist_ok=True)
    written = 0
    for rel in relatives:
        destination = target / rel
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists() and not args.force:
            continue
        shutil.copyfile(TEMPLATE_DIR / rel, destination)
        print(Path(*FOLDER_PARTS) / rel)
        written += 1
    if written == 0:
        print("no files written; use --force to overwrite existing files", file=sys.stderr)
    return 0


def cmd_tmp_list(base):
    """Print the run folders with size and modification date, newest first."""
    if not base.is_dir():
        return 0
    rows = []
    for folder in base.iterdir():
        if folder.is_dir():
            stamp = datetime.datetime.fromtimestamp(folder.stat().st_mtime)
            rows.append((folder.name, human_size(folder_size(folder)),
                         stamp.strftime("%Y-%m-%d %H:%M:%S")))
    for name, size, date in sorted(rows, key=lambda row: row[0], reverse=True):
        print(name + "  " + size + "  " + date)
    return 0


def cmd_tmp(args):
    """Create a per-run scratch folder under <root>/.gti/tmp/ or list existing ones."""
    start = Path(args.start).resolve()
    root = nearest_git_root(start) or start
    base = root / ".gti" / "tmp"
    if args.list:
        return cmd_tmp_list(base)
    ensure_tmp_ignored(root)
    base.mkdir(parents=True, exist_ok=True)
    name = datetime.datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + slugify(args.name)
    candidate = base / name
    suffix = 2
    while candidate.exists():
        candidate = base / (name + "-" + str(suffix))
        suffix += 1
    candidate.mkdir()
    print(candidate)
    return 0


def gti_dir(skill, *parts):
    """Folder for generated files: ~/.gti/<skill>/... (GTI_HOME replaces ~/.gti). Never the user's repository."""
    base = Path(os.environ.get("GTI_HOME") or Path.home() / ".gti").expanduser()
    folder = base.joinpath(skill, *parts)
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def learn_targets(args):
    """Return the repository learnings folder (or None outside a repository) and the project name.

    With --dir the folder must exist. Otherwise the folder is <nearest git root>/.gti/infra-expert/,
    created when missing, so a learning reaches the repository even before 'init'.
    """
    if getattr(args, "dir", None):
        folder = resolve_folder(args)
        return folder, folder.parent.parent.name or "project"
    root = nearest_git_root(Path.cwd())
    if root is None:
        return None, Path.cwd().resolve().name or "project"
    folder = root.joinpath(*FOLDER_PARTS)
    folder.mkdir(parents=True, exist_ok=True)
    return folder, root.name or "project"


def append_learning(path, block):
    """Append a learning, starting a missing file from the learnings template."""
    template = TEMPLATE_DIR / "learnings.md"
    if not path.is_file() and template.is_file():
        shutil.copyfile(template, path)
    append_block(path, block)
    print(path)


def cmd_learn(args):
    """Append a dated learning entry to the repository's learnings.md and to the copy in GTI home."""
    source = args.source or "unspecified"
    ensure_not_secret({
        "area": args.area, "what": args.what, "rule": args.rule, "source": source,
    })
    folder, project = learn_targets(args)
    today = datetime.date.today().isoformat()
    block = entry_block("## " + today + " - " + one_line(args.area), [
        ("What", one_line(args.what)),
        ("Rule", one_line(args.rule)),
        ("Source", one_line(source)),
    ])
    if folder is not None:
        append_learning(folder / "learnings.md", block)
    append_learning(gti_dir("infra-expert", project) / "learnings.md", block)
    return 0


def cmd_gap(args):
    """Append a dated MCP gap entry with status open to mcp-gaps.md."""
    ensure_not_secret({"need": args.need, "command": args.command, "proposal": args.proposal})
    folder = resolve_folder(args)
    today = datetime.date.today().isoformat()
    block = entry_block("## " + today + " - MCP gap", [
        ("Need", one_line(args.need)),
        ("Command", one_line(args.command)),
        ("Proposal", one_line(args.proposal)),
        ("Status", "open"),
    ])
    append_block(folder / "mcp-gaps.md", block)
    print(folder / "mcp-gaps.md")
    return 0


def validate_entries(path, fields, check_status=False):
    """Return a list of problems found in one entry file."""
    if not path.is_file():
        return ["missing file: " + path.name]
    blocks = []
    current = None
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            current = [line, []]
            blocks.append(current)
        elif current is not None:
            current[1].append(line)
    if not blocks:
        return [path.name + ": no dated entries"]
    problems = []
    for header, body in blocks:
        if not ENTRY_HEADER.fullmatch(header):
            problems.append(path.name + ": bad entry header: " + header)
        text = "\n".join(body)
        for field in fields:
            pattern = r"^- " + re.escape(field) + r": \S.*$"
            if not re.search(pattern, text, re.MULTILINE):
                problems.append(path.name + ": entry '" + header + "' missing '" + field + "'")
        if check_status:
            match = re.search(r"^- Status: (.*)$", text, re.MULTILINE)
            if match and match.group(1).strip() not in ("open", "added"):
                problems.append(path.name + ": entry '" + header + "' has an unknown status")
    return problems


def cmd_check(args):
    """Check that every template file exists and entries follow the format."""
    folder = resolve_folder(args)
    problems = []
    relatives = template_files()
    if not relatives:
        problems.append("template folder not found: " + str(TEMPLATE_DIR))
    for rel in relatives:
        if not (folder / rel).is_file():
            problems.append("missing file: " + str(rel))
    for name, fields in ENTRY_FIELDS.items():
        problems += validate_entries(folder / name, fields, check_status=(name == "mcp-gaps.md"))
    for problem in problems:
        print(problem, file=sys.stderr)
    return 1 if problems else 0


def add_folder_argument(parser):
    parser.add_argument("--dir", default=None,
                        help="Knowledge folder (default: find it at the nearest git root from the cwd)")


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)

    find_parser = commands.add_parser("find", help="Locate the knowledge folder")
    find_parser.add_argument("--start", default=".", help="Folder to start from (default: current folder)")
    find_parser.set_defaults(func=cmd_find)

    init_parser = commands.add_parser("init", help="Create the folder from the project template")
    init_parser.add_argument("--root", default=None,
                             help="Repository root (default: nearest git root of cwd, else cwd)")
    init_parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    init_parser.set_defaults(func=cmd_init)

    tmp_parser = commands.add_parser("tmp", help="Create or list per-run scratch folders under .gti/tmp/")
    tmp_parser.add_argument("--name", default=None,
                            help="Short task slug for the folder name (default: run)")
    tmp_parser.add_argument("--start", default=".", help="Folder to start from (default: current folder)")
    tmp_parser.add_argument("--list", action="store_true",
                            help="List existing run folders with size and date, newest first")
    tmp_parser.set_defaults(func=cmd_tmp)

    learn_parser = commands.add_parser(
        "learn", help="Append a dated learning to the repository folder and to ~/.gti/infra-expert/<project>/")
    learn_parser.add_argument("--area", required=True, help="Area, for example access or diagnose")
    learn_parser.add_argument("--what", required=True, help="What happened")
    learn_parser.add_argument("--rule", required=True, help="The rule that prevents a repeat")
    learn_parser.add_argument("--source", default=None, help="Where the lesson came from (default: unspecified)")
    add_folder_argument(learn_parser)
    learn_parser.set_defaults(func=cmd_learn)

    gap_parser = commands.add_parser("gap", help="Append a dated MCP gap entry")
    gap_parser.add_argument("--need", required=True, help="The capability that was missing")
    gap_parser.add_argument("--command", required=True, help="The exact command used instead")
    gap_parser.add_argument("--proposal", required=True, help="The MCP tool to add")
    add_folder_argument(gap_parser)
    gap_parser.set_defaults(func=cmd_gap)

    check_parser = commands.add_parser("check", help="Check files and entry formats")
    add_folder_argument(check_parser)
    check_parser.set_defaults(func=cmd_check)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
