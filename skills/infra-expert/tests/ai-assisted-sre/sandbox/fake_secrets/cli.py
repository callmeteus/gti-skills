"""CLI for the fake secret store: ``secret list|get|set|delete``."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Sequence

from .store import SecretStore


def build_parser() -> argparse.ArgumentParser:
    """Return the argument parser for the secret CLI."""

    parser = argparse.ArgumentParser(prog="secret", description="Fake ACME secret store")
    parser.add_argument("--store", type=Path, default=None, help="store JSON file")
    sub = parser.add_subparsers(dest="action", required=True)
    sub.add_parser("list", help="list paths and keys").add_argument("path", nargs="?", default="/")
    get = sub.add_parser("get", help="print one value")
    get.add_argument("path")
    get.add_argument("key")
    setting = sub.add_parser("set", help="create or replace one value")
    setting.add_argument("path")
    setting.add_argument("key")
    setting.add_argument("value")
    delete = sub.add_parser("delete", help="remove one value")
    delete.add_argument("path")
    delete.add_argument("key")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Run the secret CLI and return a process exit code."""

    args = build_parser().parse_args(argv)
    store = SecretStore(args.store)
    if args.action == "list":
        keys = store.list(args.path)
        print("\n".join(keys) if keys else "(no keys)")
        return 0
    value = store.get(args.path, args.key)
    if args.action == "get":
        if value is None:
            print(f"secret not found: {args.path} {args.key}")
            return 1
        print(value)
        return 0
    if args.action == "set":
        store.set(args.path, args.key, args.value)
        print(f"stored {args.key} at {args.path}")
        return 0
    store.delete(args.path, args.key)
    print(f"deleted {args.key} at {args.path}")
    return 0


if __name__ == "__main__":  # pragma: no cover - exercised through __main__.py
    raise SystemExit(main())
