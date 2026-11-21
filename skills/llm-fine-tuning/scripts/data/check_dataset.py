#!/usr/bin/env python3
"""Validate, measure, and split a chat dataset for supervised fine-tuning, for any model.

Offline. Reads one or more JSONL files whose lines are
    {"messages": [...], "tools": [...], "group": "<session id>"}   ("tools" and "group" optional)
normalizes them to OpenAI chat format (thinking in "reasoning_content"), checks the
structure of every row, splits by group with a fixed seed, and writes:

    <name>.train.jsonl  <name>.val.jsonl   normalized rows
    <name>.report.json                     counts, tokens, cost estimate, warnings, advice, sha256s

into ~/.gti/llm-fine-tuning/<project>/datasets/ (GTI_HOME replaces ~/.gti) unless
--out-dir says otherwise.

Tokens: with --tokenizer (a Hugging Face model id or local path; needs the
transformers package) every row is rendered through that model's chat template and
counted exactly. Without it, tokens are ESTIMATED as characters / 4 and the report
says so. Always measure with the target model's tokenizer before trusting a row
budget: rows sized for one tokenizer overflow another.

Advice lines flag the problems that ruin fine-tunes while the loss still falls:
most rows opening with a tool call, assistant turns without thinking, rows without
a system prompt, mixed tool sets, and too few optimizer steps.

Examples:
  python check_dataset.py --input rows.jsonl --name my-run
  python check_dataset.py --input rows.jsonl --name my-run --tokenizer Qwen/Qwen3-8B --max-tokens 32768
  python check_dataset.py --input rows.jsonl --name my-run --price-per-million 1.50 --batch-size 8 --epochs 1
Exit code 1 when rows are invalid or over budget (unless --skip-bad-rows / --drop-overlong).
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.chat_rows import (RowError, check_conversation, normalize_row, normalize_tools,  # noqa: E402
                              opens_with_tool_call, read_jsonl, sha256_file, split_of, write_json, write_jsonl)
from common.gti import gti_dir  # noqa: E402


def text_chars(messages, tools):
    n = sum(len(m.get("content") or "") + len(m.get("reasoning_content") or "") for m in messages)
    n += sum(len(tc["function"]["name"]) + len(tc["function"]["arguments"])
             for m in messages for tc in m.get("tool_calls", []))
    return n + (len(json.dumps(tools)) if tools else 0)


class TokenCounter:
    """Token counter: exact through a chat template, or an estimate."""

    def __init__(self, tokenizer=None):
        self.exact = False
        self.tok = None
        if tokenizer:
            try:
                from transformers import AutoTokenizer
            except ImportError:
                sys.exit("--tokenizer needs the transformers package (pip install transformers)")
            self.tok = AutoTokenizer.from_pretrained(tokenizer)
            self.exact = True

    def count(self, messages, tools):
        if not self.tok:
            return max(1, text_chars(messages, tools) // 4)
        ids = self.tok.apply_chat_template(messages, tools=tools or None, tokenize=True)
        if isinstance(ids, dict):
            ids = ids["input_ids"]
        return len(ids)


def analyze(inputs, *, seed="split-v1", val_fraction=0.05, counter=None, max_tokens=None,
            allow_no_tools=True, tools_file=None):
    """Returns (rows by split, report fields, errors, overlong). Pure apart from reading inputs."""
    counter = counter or TokenCounter()
    default_tools = normalize_tools(json.loads(Path(tools_file).read_text(encoding="utf-8"))) if tools_file else None
    rows = {"train": [], "val": []}
    meta, errors, overlong, warn = [], [], [], Counter()
    tool_sets = Counter()
    think_turns = assistant_turns = 0
    seen = set()
    duplicates = 0
    for path in inputs:
        for line_no, raw in read_jsonl(path):
            where = f"{path}:{line_no}"
            try:
                messages, repairs = normalize_row(raw.get("messages"))
                tools = normalize_tools(raw.get("tools")) or default_tools or []
                if not tools and not allow_no_tools:
                    raise RowError("no tool definitions (pass --tools-file, or drop --require-tools)")
                for w in repairs + check_conversation(messages):
                    warn[w] += 1
            except (RowError, KeyError, TypeError, AttributeError) as e:
                errors.append(f"{where}: {e}")
                continue
            n = counter.count(messages, tools)
            if max_tokens and n > max_tokens:
                overlong.append(f"{where}: {n} tokens")
                continue
            key = json.dumps(messages, sort_keys=True)
            if key in seen:
                duplicates += 1
            seen.add(key)
            for m in messages:
                if m["role"] == "assistant":
                    assistant_turns += 1
                    think_turns += bool(m.get("reasoning_content"))
            tool_sets[json.dumps(sorted(t["function"]["name"] for t in tools))] += 1
            group = str(raw.get("group") or raw.get("session") or where)
            split = split_of(group, seed, val_fraction)
            row = {"messages": messages}
            if tools:
                row["tools"] = tools
            rows[split].append(row)
            meta.append({"split": split, "group": group, "tokens": n,
                         "opens_with_tool_call": opens_with_tool_call(messages),
                         "has_system_prompt": messages[0]["role"] == "system"})
    by = {s: [m for m in meta if m["split"] == s] for s in ("train", "val")}
    with_system = [m for m in meta if m["has_system_prompt"]]
    tool_openers = sum(m["opens_with_tool_call"] for m in meta)
    report = {
        "rows": {s: len(rows[s]) for s in rows},
        "tokens": {s: sum(m["tokens"] for m in by[s]) for s in by},
        "tokens_exact": counter.exact,
        "row_tokens_max": max((m["tokens"] for m in meta), default=0),
        "row_tokens_mean": round(statistics.mean(m["tokens"] for m in meta)) if meta else 0,
        "groups": {s: len({m["group"] for m in by[s]}) for s in by},
        "train_val_group_overlap": sorted({m["group"] for m in by["train"]} & {m["group"] for m in by["val"]}),
        "rows_with_system_prompt": f"{len(with_system)}/{len(meta)}",
        "rows_opening_with_tool_call": f"{tool_openers}/{len(meta)}",
        "assistant_turns_with_thinking": f"{think_turns}/{assistant_turns}",
        "distinct_tool_sets": len(tool_sets),
        "duplicate_rows": duplicates,
        "dropped": {"invalid": len(errors), "overlong": len(overlong)},
        "warnings": dict(warn),
        "_counts": {"tool_openers": tool_openers, "think_turns": think_turns, "assistant_turns": assistant_turns,
                    "with_system": len(with_system), "rows": len(meta), "tool_rows": sum(
                        c for k, c in tool_sets.items() if k != "[]")},
    }
    return rows, report, errors, overlong


def advice_for(report, *, batch_size=None, epochs=1):
    c = report["_counts"]
    out = []
    if c["tool_rows"] and c["tool_openers"] / max(c["rows"], 1) > 0.9:
        out.append(f"{c['tool_openers']}/{c['rows']} rows open with a tool call. A fine-tune on this learns "
                   f"'session start = start working' and calls tools on a greeting. Add a conversational slice "
                   f"sampled from the base model itself (references/workflow/04-behaviour.md).")
    if c["think_turns"] and c["think_turns"] / max(c["assistant_turns"], 1) < 0.99:
        out.append(f"only {c['think_turns']}/{c['assistant_turns']} assistant turns carry thinking. On a thinking "
                   f"model, turns without thinking teach it to skip reasoning. Generate grounded thinking for "
                   f"them or drop those rows.")
    if c["with_system"] < c["rows"]:
        out.append(f"{c['rows'] - c['with_system']} rows have no system prompt. Train with the system prompt "
                   f"you will serve with.")
    if report["distinct_tool_sets"] > 1:
        out.append(f"{report['distinct_tool_sets']} different tool sets. Declare in every row the full tool set "
                   f"you will serve with; a single declared tool changes behaviour even in the base model.")
    if report["duplicate_rows"]:
        out.append(f"{report['duplicate_rows']} duplicate rows. Remove them unless the repetition is deliberate.")
    if batch_size:
        steps = -(-report["rows"]["train"] // batch_size) * epochs
        if steps < 100:
            out.append(f"only {steps} optimizer steps at batch {batch_size} x {epochs} epoch(s). Aim for at least "
                       f"~100: more data, a second epoch, or a smaller batch.")
    if not report["tokens_exact"]:
        out.append("token counts are estimates (characters / 4). Re-run with --tokenizer <target model> before "
                   "trusting a row budget or a cost.")
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", action="append", required=True, type=Path, help="JSONL file (repeatable)")
    ap.add_argument("--name", required=True, help="dataset name; files go to <out-dir>/<name>.*")
    ap.add_argument("--out-dir", type=Path, help="default: ~/.gti/llm-fine-tuning/<project>/datasets")
    ap.add_argument("--tokenizer", help="Hugging Face id or path for exact counts through the chat template")
    ap.add_argument("--max-tokens", type=int, help="row budget in tokens (the training context length)")
    ap.add_argument("--val-fraction", type=float, default=0.05)
    ap.add_argument("--seed", default="split-v1", help="split seed; keep it fixed across rebuilds")
    ap.add_argument("--tools-file", type=Path, help="JSON list of tool definitions for rows that have none")
    ap.add_argument("--require-tools", action="store_true", help="fail rows without tool definitions")
    ap.add_argument("--price-per-million", type=float, help="training price in USD per million tokens")
    ap.add_argument("--epochs", type=int, default=1)
    ap.add_argument("--batch-size", type=int, help="rows per optimizer step, for the step count advice")
    ap.add_argument("--drop-overlong", action="store_true", help="drop rows over --max-tokens instead of failing")
    ap.add_argument("--skip-bad-rows", action="store_true", help="drop invalid rows instead of failing")
    args = ap.parse_args()
    if not 0.0 < args.val_fraction < 0.5:
        ap.error("--val-fraction must be in (0, 0.5)")

    rows, report, errors, overlong = analyze(
        args.input, seed=args.seed, val_fraction=args.val_fraction, counter=TokenCounter(args.tokenizer),
        max_tokens=args.max_tokens, allow_no_tools=not args.require_tools, tools_file=args.tools_file)
    if errors and not args.skip_bad_rows:
        print("\n".join(errors[:40]), file=sys.stderr)
        sys.exit(f"{len(errors)} invalid rows (fix them, or pass --skip-bad-rows)")
    if overlong and not args.drop_overlong:
        print("\n".join(overlong[:40]), file=sys.stderr)
        sys.exit(f"{len(overlong)} rows exceed {args.max_tokens} tokens. Re-chunk them for the target model, "
                 f"or pass --drop-overlong")
    if not rows["train"] or not rows["val"]:
        sys.exit(f"split produced train={len(rows['train'])} val={len(rows['val'])}; "
                 f"add data or change --val-fraction / --seed")
    assert not report["train_val_group_overlap"]

    out_dir = args.out_dir or gti_dir("datasets")
    paths = {s: out_dir / f"{args.name}.{s}.jsonl" for s in ("train", "val")}
    for s in paths:
        write_jsonl(paths[s], rows[s])
    advice = advice_for(report, batch_size=args.batch_size, epochs=args.epochs)
    report.pop("_counts")
    report.update({
        "name": args.name, "seed": args.seed, "val_fraction": args.val_fraction, "tokenizer": args.tokenizer,
        "max_tokens": args.max_tokens, "epochs": args.epochs, "advice": advice,
        "files_sha256": {s: sha256_file(paths[s]) for s in paths}, "inputs": [str(p) for p in args.input],
    })
    if args.price_per_million:
        report["estimated_train_cost_usd"] = round(
            report["tokens"]["train"] * args.epochs / 1e6 * args.price_per_million, 2)
    write_json(out_dir / f"{args.name}.report.json", report)
    print(json.dumps({k: report[k] for k in ("name", "rows", "tokens", "tokens_exact", "row_tokens_max", "groups",
                                             "rows_opening_with_tool_call", "assistant_turns_with_thinking",
                                             "dropped") + (("estimated_train_cost_usd",)
                                                           if args.price_per_million else ())}, indent=1))
    for a in advice:
        print(f"ADVICE: {a}")
    print(f"wrote {paths['train']}, {paths['val']}, {args.name}.report.json")


if __name__ == "__main__":
    main()
