#!/usr/bin/env python3
"""File-based mailboxes, a findings board, and task locks for a Maestro team run.

Every agent in a team run talks through one team folder, by default
~/.gti/maestro/<project>/team/. Nothing here starts an agent or reaches the network:
the script only appends JSON lines and creates lock files, so any harness that can run
a shell command can take part.

Layout:
    team.json              members, goal, status, and the message budget
    inbox/<member>.jsonl   direct messages to one member, append-only
    findings.jsonl         the shared board: findings, ruled-out paths, hypotheses
    log.jsonl              every message and post, for Maestro and the central
    cursors/<member>.json  how far each member has read
    locks/<task>.lock      who holds which task

Every command prints one JSON object. Exit codes: 0 ok, 2 bad input,
3 task held by another member, 4 message budget spent, 5 team closed or missing.
"""

import argparse
import json
import os
import random
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

MESSAGE_KINDS = ("question", "answer", "finding", "handoff", "blocker", "status", "request")
POST_KINDS = ("finding", "ruled-out", "hypothesis", "decision", "progress")
MAESTRO = "maestro"
TEXT_MAX = 2000
DEFAULT_BUDGET = 40
LOCK_WAIT_SECONDS = 5.0
LOCK_STALE_SECONDS = 30.0
NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")


class TeamError(Exception):
    """An error with the exit code the command should return."""

    def __init__(self, message, code=2):
        super().__init__(message)
        self.code = code


# region paths and time


def now():
    """Returns the current UTC time as an ISO 8601 string."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def default_team_dir():
    """Resolves the team folder from MAESTRO_TEAM, then MAESTRO_HOME or GTI_HOME, then ~/.gti."""
    explicit = os.environ.get("MAESTRO_TEAM")
    if explicit:
        return Path(explicit)
    home = os.environ.get("MAESTRO_HOME")
    if home:
        base = Path(home)
    else:
        base = Path(os.environ.get("GTI_HOME") or Path.home() / ".gti") / "maestro"
    return base / Path.cwd().name / "team"


def check_name(value, label):
    """Rejects member and task names that could escape the team folder."""
    if not value or not NAME.match(value):
        raise TeamError(f"invalid {label}: {value!r} (letters, digits, '.', '_', '-'; max 64)")
    return value


# endregion

# region file primitives


class FileLock:
    """A cross-platform lock made with an exclusive create, so appends from several agents never interleave."""

    def __init__(self, target):
        self.path = Path(f"{target}.lock")

    def __enter__(self):
        deadline = time.monotonic() + LOCK_WAIT_SECONDS
        while True:
            try:
                fd = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.close(fd)
                return self
            except FileExistsError:
                # A writer that died leaves its lock; take it over after a while.
                try:
                    if time.time() - self.path.stat().st_mtime > LOCK_STALE_SECONDS:
                        self.path.unlink()
                        continue
                except FileNotFoundError:
                    continue
                if time.monotonic() > deadline:
                    raise TeamError(f"timed out waiting for {self.path.name}", 2)
                time.sleep(0.02 + random.random() * 0.03)

    def __exit__(self, *exc):
        try:
            self.path.unlink()
        except FileNotFoundError:
            pass


def append_line(path, record):
    """Appends one JSON line under the file lock."""
    path.parent.mkdir(parents=True, exist_ok=True)
    line = json.dumps(record, ensure_ascii=False) + "\n"
    with FileLock(path):
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(line)


def read_lines(path):
    """Reads a JSON lines file, skipping lines that do not parse."""
    if not path.exists():
        return []
    records = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return records


def read_json(path, fallback):
    """Reads one JSON file or returns the fallback when it is missing."""
    if not path.exists():
        return fallback
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path, value):
    """Writes one JSON file through a temporary file, so a reader never sees half of it."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f"{path.name}.{os.getpid()}.tmp")
    with open(temp, "w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
    os.replace(temp, path)


# endregion

# region team


def load_team(root):
    """Loads team.json and refuses a missing or closed team."""
    team = read_json(root / "team.json", None)
    if team is None:
        raise TeamError(f"no team at {root}; Maestro opens it with 'open'", 5)
    return team


def require_open(team):
    if team.get("status") != "open":
        raise TeamError("the team is closed; report to Maestro in your own chat", 5)


def require_member(team, name):
    if name != MAESTRO and name not in team["members"]:
        raise TeamError(f"{name!r} is not a member of this team", 2)


def sent_count(root, sender):
    return sum(1 for item in read_lines(root / "log.jsonl") if item.get("from") == sender)


def check_text(text):
    text = (text or "").strip()
    if not text:
        raise TeamError("empty text", 2)
    if len(text) > TEXT_MAX:
        raise TeamError(f"text is {len(text)} characters; the limit is {TEXT_MAX}. Write the detail to a file and pass it with --ref", 2)
    return text


def new_id(prefix):
    return f"{prefix}-{int(time.time() * 1000)}-{random.randint(0, 0xFFFF):04x}"


def cmd_open(root, args):
    members = [check_name(item.strip(), "member") for item in args.members.split(",") if item.strip()]
    if not members:
        raise TeamError("--members needs at least one name", 2)
    if MAESTRO in members:
        raise TeamError("'maestro' is reserved for the orchestrator", 2)
    existing = read_json(root / "team.json", None)
    team = {
        "goal": args.goal,
        "run": args.run,
        "members": sorted(set(members) | set(existing["members"] if existing else [])),
        "budget": args.budget,
        "status": "open",
        "opened": existing["opened"] if existing else now(),
    }
    for folder in ("inbox", "cursors", "locks"):
        (root / folder).mkdir(parents=True, exist_ok=True)
    write_json(root / "team.json", team)
    return {"ok": True, "team": str(root), **team}


def cmd_send(root, args):
    team = load_team(root)
    require_open(team)
    sender = check_name(args.sender, "sender")
    recipient = check_name(args.to, "recipient")
    require_member(team, sender)
    require_member(team, recipient)
    if sender == recipient:
        raise TeamError("a member cannot message itself", 2)
    if sender != MAESTRO and sent_count(root, sender) >= team["budget"]:
        raise TeamError(f"{sender} has used its {team['budget']} messages; send what is left to Maestro in your result", 4)
    record = {
        "id": new_id("m"),
        "ts": now(),
        "from": sender,
        "to": recipient,
        "kind": args.kind,
        "text": check_text(args.text),
    }
    if args.ref:
        record["ref"] = args.ref
    if args.reply_to:
        record["replyTo"] = args.reply_to
    append_line(root / "inbox" / f"{recipient}.jsonl", record)
    append_line(root / "log.jsonl", {**record, "channel": "direct"})
    return {"ok": True, "message": record}


def cmd_post(root, args):
    team = load_team(root)
    require_open(team)
    sender = check_name(args.sender, "sender")
    require_member(team, sender)
    if sender != MAESTRO and sent_count(root, sender) >= team["budget"]:
        raise TeamError(f"{sender} has used its {team['budget']} messages", 4)
    record = {
        "id": new_id("f"),
        "ts": now(),
        "from": sender,
        "kind": args.kind,
        "text": check_text(args.text),
    }
    for field in ("ref", "evidence", "task"):
        value = getattr(args, field)
        if value:
            record[field] = value
    append_line(root / "findings.jsonl", record)
    append_line(root / "log.jsonl", {**record, "channel": "board"})
    return {"ok": True, "post": record}


def cmd_read(root, args):
    team = load_team(root)
    reader = check_name(args.reader, "reader")
    require_member(team, reader)
    cursor_path = root / "cursors" / f"{reader}.json"
    cursor = read_json(cursor_path, {"inbox": 0, "board": 0})
    inbox = read_lines(root / "inbox" / f"{reader}.jsonl")
    board = [item for item in read_lines(root / "findings.jsonl") if item.get("from") != reader]
    start_inbox = 0 if args.all else cursor["inbox"]
    start_board = 0 if args.all else cursor["board"]
    result = {
        "ok": True,
        "status": team["status"],
        "messages": inbox[start_inbox:],
        "board": board[start_board:],
    }
    if not args.peek:
        write_json(cursor_path, {"inbox": len(inbox), "board": len(board)})
    return result


def lock_path(root, task):
    return root / "locks" / f"{check_name(task, 'task')}.lock"


def cmd_claim(root, args):
    team = load_team(root)
    require_open(team)
    owner = check_name(args.owner, "member")
    require_member(team, owner)
    path = lock_path(root, args.task)
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        holder = read_json(path, {})
        if holder.get("owner") == owner:
            return {"ok": True, "task": args.task, "owner": owner, "already": True}
        raise TeamError(f"task {args.task} is held by {holder.get('owner', 'another member')}; pick another task or message the holder", 3)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump({"task": args.task, "owner": owner, "since": now()}, handle)
    append_line(root / "log.jsonl", {"id": new_id("c"), "ts": now(), "from": owner, "channel": "lock", "kind": "claim", "task": args.task})
    return {"ok": True, "task": args.task, "owner": owner}


def cmd_release(root, args):
    team = load_team(root)
    owner = check_name(args.owner, "member")
    require_member(team, owner)
    path = lock_path(root, args.task)
    holder = read_json(path, None)
    if holder is None:
        return {"ok": True, "task": args.task, "released": False, "reason": "not held"}
    if holder.get("owner") != owner and owner != MAESTRO:
        raise TeamError(f"task {args.task} is held by {holder.get('owner')}, not {owner}", 3)
    path.unlink()
    kind = "done" if args.done else "release"
    append_line(root / "log.jsonl", {"id": new_id("c"), "ts": now(), "from": owner, "channel": "lock", "kind": kind, "task": args.task})
    return {"ok": True, "task": args.task, "released": True, "done": bool(args.done)}


def cmd_status(root, _args):
    team = load_team(root)
    log = read_lines(root / "log.jsonl")
    locks = []
    lock_dir = root / "locks"
    if lock_dir.exists():
        for path in sorted(lock_dir.glob("*.lock")):
            holder = read_json(path, {})
            locks.append(holder)
    members = {}
    for name in [MAESTRO, *team["members"]]:
        inbox = read_lines(root / "inbox" / f"{name}.jsonl")
        cursor = read_json(root / "cursors" / f"{name}.json", {"inbox": 0, "board": 0})
        members[name] = {
            "sent": sum(1 for item in log if item.get("from") == name and item.get("channel") != "lock"),
            "unread": max(0, len(inbox) - cursor["inbox"]),
        }
    return {
        "ok": True,
        "team": str(root),
        "goal": team.get("goal"),
        "status": team["status"],
        "budget": team["budget"],
        "members": members,
        "locks": locks,
        "findings": len(read_lines(root / "findings.jsonl")),
        "last": log[-10:],
    }


def cmd_close(root, _args):
    team = load_team(root)
    team["status"] = "closed"
    team["closed"] = now()
    write_json(root / "team.json", team)
    return {"ok": True, "status": "closed"}


# endregion


def build_parser():
    parser = argparse.ArgumentParser(description="Mailboxes, findings board, and task locks for a Maestro team run.")
    parser.add_argument("--team", help="Team folder (default: MAESTRO_TEAM, else ~/.gti/maestro/<cwd name>/team)")
    sub = parser.add_subparsers(dest="command", required=True)

    opened = sub.add_parser("open", help="Maestro only: create or extend the team")
    opened.add_argument("--members", required=True, help="Comma-separated worker names, for example w2.1,w2.2")
    opened.add_argument("--goal", default="", help="One sentence the whole team works toward")
    opened.add_argument("--run", default=None, help="Run id from run.json")
    opened.add_argument("--budget", type=int, default=DEFAULT_BUDGET, help="Messages and posts each worker may send")

    send = sub.add_parser("send", help="Send a direct message to one member or to maestro")
    send.add_argument("--from", dest="sender", required=True)
    send.add_argument("--to", required=True)
    send.add_argument("--kind", choices=MESSAGE_KINDS, default="status")
    send.add_argument("--text", required=True)
    send.add_argument("--ref", help="Path to a file with the detail")
    send.add_argument("--reply-to", dest="reply_to")

    post = sub.add_parser("post", help="Post to the shared findings board")
    post.add_argument("--from", dest="sender", required=True)
    post.add_argument("--kind", choices=POST_KINDS, default="finding")
    post.add_argument("--text", required=True)
    post.add_argument("--evidence", help="Command, output line, or file:line that proves it")
    post.add_argument("--ref", help="Path to a file with the detail")
    post.add_argument("--task", help="Task id the post is about")

    read = sub.add_parser("read", help="Read new messages and board posts")
    read.add_argument("--as", dest="reader", required=True)
    read.add_argument("--all", action="store_true", help="Read from the start, not from the cursor")
    read.add_argument("--peek", action="store_true", help="Do not move the cursor")

    claim = sub.add_parser("claim", help="Take a task lock")
    claim.add_argument("--as", dest="owner", required=True)
    claim.add_argument("--task", required=True)

    release = sub.add_parser("release", help="Give a task lock back")
    release.add_argument("--as", dest="owner", required=True)
    release.add_argument("--task", required=True)
    release.add_argument("--done", action="store_true", help="The task is finished, not abandoned")

    sub.add_parser("status", help="Members, unread counts, locks, and the last messages")
    sub.add_parser("close", help="Maestro only: close the team; later sends are refused")
    return parser


COMMANDS = {
    "open": cmd_open,
    "send": cmd_send,
    "post": cmd_post,
    "read": cmd_read,
    "claim": cmd_claim,
    "release": cmd_release,
    "status": cmd_status,
    "close": cmd_close,
}


def main(argv=None):
    args = build_parser().parse_args(argv)
    root = Path(args.team) if args.team else default_team_dir()
    try:
        result = COMMANDS[args.command](root, args)
        code = 0
    except TeamError as error:
        result = {"ok": False, "error": str(error)}
        code = error.code
    sys.stdout.write(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    return code


if __name__ == "__main__":
    sys.exit(main())
