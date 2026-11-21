#!/usr/bin/env python3
"""Write synthetic {"messages", "tools", "group"} rows for a dry run of the pipeline.

Offline and free. The rows look like agent sessions (system prompt with a working
directory, four tools, thinking on every assistant turn, tool calls and results) so
prepare_dataset.py and the train.py smoke test exercise every code path. Do not train
on them.

A bare --out name is written to ~/.gti/llm-fine-tuning/<project>/data/.

Example:
  python make_synthetic_rows.py --out demo-rows.jsonl --sessions 24
"""
import argparse
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from inkling2 import work_path, write_jsonl  # noqa: E402

TOOLS = [
    {"type": "function", "function": {"name": "Bash", "description": "Run a shell command and return its output.",
     "parameters": {"type": "object", "properties": {"command": {"type": "string"}}, "required": ["command"]}}},
    {"type": "function", "function": {"name": "Read", "description": "Read a file from the working directory.",
     "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}}},
    {"type": "function", "function": {"name": "Edit", "description": "Replace a string in a file.",
     "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "old": {"type": "string"},
                                                     "new": {"type": "string"}}, "required": ["path", "old", "new"]}}},
    {"type": "function", "function": {"name": "Grep", "description": "Search files for a regular expression.",
     "parameters": {"type": "object", "properties": {"pattern": {"type": "string"}}, "required": ["pattern"]}}},
]
SYSTEM = ("You are a coding agent working in the user's terminal. Read before you change, run the tests "
          "after you change, and report failures plainly.\n\n# Environment\n\nWorking directory: {cwd}")
TASKS = ["The CSV export drops the last row. Find out why and fix it.", "Add a --dry-run flag to the deploy script.",
         "Tests in test_parser.py fail since yesterday. Investigate.", "Rename the config loader and update callers."]
FILES = ["src/export.py", "src/parser.py", "scripts/deploy.sh", "src/config.py", "tests/test_parser.py"]


def session(rng, i, long_results):
    cwd = f"/home/{rng.choice(['ana', 'kofi', 'li', 'sam'])}/{rng.choice(['work', 'src', 'code'])}/proj-{i:03d}"
    msgs = [{"role": "system", "content": SYSTEM.format(cwd=cwd)}, {"role": "user", "content": rng.choice(TASKS)}]
    for step in range(rng.randint(3, 7)):
        f = rng.choice(FILES)
        name = rng.choice(["Read", "Bash", "Grep"])
        args = {"Read": {"path": f}, "Bash": {"command": f"python -m pytest {rng.choice(FILES)} -q"},
                "Grep": {"pattern": "def load_"}}[name]
        msgs.append({"role": "assistant", "content": [
            {"type": "thinking", "thinking": f"Step {step + 1}: I need to look at {f} before changing anything; "
                                             f"{name} gives me the ground truth."}],
            "tool_calls": [{"id": f"c{i}_{step}", "type": "function",
                            "function": {"name": name, "arguments": json.dumps(args)}}]})
        body = "\n".join(f"line {n}: value = compute({n})" for n in range(rng.randint(5, 400 if long_results else 40)))
        msgs.append({"role": "tool", "tool_call_id": f"c{i}_{step}", "content": body})
    msgs.append({"role": "assistant", "content": [
        {"type": "thinking", "thinking": "The evidence points at an off-by-one in the loop bound; I have read "
                                         "enough to explain it, and the fix is one line."},
        {"type": "text", "text": "Found it: the loop stops one row early. I changed the bound; tests pass."}]})
    return {"messages": msgs, "tools": TOOLS, "group": f"synthetic-{i:03d}"}


def chat(rng, i):
    return {"messages": [
        {"role": "system", "content": SYSTEM.format(cwd=f"/home/dev/proj-chat-{i}")},
        {"role": "user", "content": "Hey there!"},
        {"role": "assistant", "content": [
            {"type": "thinking", "thinking": "A greeting with no task. No reason to touch the repo; say hello and ask."},
            {"type": "text", "text": "Hi! What are we working on today?"}]}],
        "tools": TOOLS, "group": f"synthetic-chat-{i:03d}"}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--sessions", type=int, default=24)
    ap.add_argument("--chats", type=int, default=3)
    ap.add_argument("--long-results", action="store_true", help="bigger tool outputs (longer rows)")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()
    rng = random.Random(args.seed)
    args.out = work_path(args.out, "data")
    rows = [session(rng, i, args.long_results) for i in range(args.sessions)] + [chat(rng, i) for i in range(args.chats)]
    write_jsonl(args.out, rows)
    print(f"wrote {len(rows)} synthetic rows -> {args.out}")


if __name__ == "__main__":
    main()
