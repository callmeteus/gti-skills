"""Keep the contract, forward-pass budget, and edit log of one task in a JSON file.

Commands:
  init    create the ledger with the mode, goal, and budget
  spend   record forward passes; fails with exit code 2 when over budget
  edit    record an edit with its metric before and after and the decision
  note    record a free-text observation or hypothesis
  status  print the budget and the log
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

OVER_BUDGET = 2


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def read(path):
    path = Path(path)
    if not path.exists():
        raise SystemExit(f"no ledger at {path}; run init first")
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, ledger):
    Path(path).write_text(json.dumps(ledger, indent=2), encoding="utf-8")


def spend(path, count, note):
    """Record `count` forward passes. Returns the remaining budget or exits when it would be exceeded."""
    ledger = read(path)
    remaining = ledger["budget"] - ledger["spent"]
    if count > remaining:
        print(f"over budget: asked for {count} forward passes, {remaining} left", file=sys.stderr)
        sys.exit(OVER_BUDGET)
    ledger["spent"] += count
    ledger["events"].append({"time": now(), "type": "forward", "count": count, "note": note})
    write(path, ledger)
    return ledger["budget"] - ledger["spent"]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--ledger", default="wsp-ledger.json", help="Ledger file (default wsp-ledger.json)")
    commands = parser.add_subparsers(dest="command", required=True)

    init = commands.add_parser("init", help="Create a new ledger")
    init.add_argument("--mode", choices=["read", "fix", "write"], required=True)
    init.add_argument("--goal", required=True, help="Goal in one sentence")
    init.add_argument("--budget", type=int, required=True, help="Forward passes allowed; 0 forbids running the network")
    init.add_argument("--forbidden", default="training, gradients, optimizers, fitting to data, search over weights",
                      help="Forbidden actions, comma separated")
    init.add_argument("--force", action="store_true", help="Overwrite an existing ledger")

    spend_cmd = commands.add_parser("spend", help="Record forward passes")
    spend_cmd.add_argument("--count", type=int, default=1)
    spend_cmd.add_argument("--note", default="", help="What was run and why")

    edit = commands.add_parser("edit", help="Record an edit and its keep or revert decision")
    edit.add_argument("--id", required=True, help="Short edit name, for example ablate-l15-l19")
    edit.add_argument("--file", default="", help="Checkpoint that holds the edit")
    edit.add_argument("--description", required=True, help="What changed and why")
    edit.add_argument("--fraction", type=float, default=None, help="Fraction of weights changed")
    edit.add_argument("--before", type=float, default=None, help="Practice metric before the edit")
    edit.add_argument("--after", type=float, default=None, help="Practice metric after the edit")
    edit.add_argument("--decision", choices=["keep", "revert", "pending"], required=True)

    note = commands.add_parser("note", help="Record an observation or hypothesis")
    note.add_argument("text")

    commands.add_parser("status", help="Print the budget and log")
    args = parser.parse_args()

    if args.command == "init":
        if Path(args.ledger).exists() and not args.force:
            raise SystemExit(f"{args.ledger} exists; pass --force to overwrite")
        write(args.ledger, {
            "mode": args.mode, "goal": args.goal, "budget": args.budget, "spent": 0,
            "forbidden": [item.strip() for item in args.forbidden.split(",") if item.strip()],
            "created": now(), "events": [],
        })
        print(f"ledger {args.ledger}: mode={args.mode} budget={args.budget}")
    elif args.command == "spend":
        remaining = spend(args.ledger, args.count, args.note)
        print(f"spent {args.count}; {remaining} forward passes left")
    elif args.command == "edit":
        ledger = read(args.ledger)
        ledger["events"].append({
            "time": now(), "type": "edit", "id": args.id, "file": args.file, "description": args.description,
            "fraction": args.fraction, "before": args.before, "after": args.after, "decision": args.decision,
        })
        write(args.ledger, ledger)
        print(f"recorded edit {args.id}: {args.decision}")
    elif args.command == "note":
        ledger = read(args.ledger)
        ledger["events"].append({"time": now(), "type": "note", "text": args.text})
        write(args.ledger, ledger)
        print("noted")
    else:
        ledger = read(args.ledger)
        print(f"mode={ledger['mode']} goal={ledger['goal']}")
        print(f"forward passes: {ledger['spent']} of {ledger['budget']} spent")
        for event in ledger["events"]:
            if event["type"] == "forward":
                print(f"  {event['time']} forward x{event['count']} {event['note']}")
            elif event["type"] == "edit":
                print(f"  {event['time']} edit {event['id']} [{event['decision']}] "
                      f"before={event['before']} after={event['after']} fraction={event['fraction']}")
            else:
                print(f"  {event['time']} note {event['text']}")


if __name__ == "__main__":
    main()
