#!/usr/bin/env python3
"""Step 2: validate, measure and split a {"messages", "tools"} dataset for Inkling 2 Small.

Offline. Reads one or more JSONL files whose lines are
    {"messages": [...], "tools": [...], "group": "<session id>"}   ("group" optional)
normalizes them (OpenAI-style ``reasoning_content`` becomes a thinking part; tool-call
arguments become JSON strings), renders EVERY row with the exact training rendering
(tml_v0, H200K tokenizer, effort, tools declared, loss on all assistant messages) and
writes:

    <name>.train.jsonl  <name>.val.jsonl   rows the trainer reads
    <name>.manifest.json                   per-row source, split, group, tokens, loss tokens
    <name>.report.json                     totals, cost estimate, warnings, sha256s, provenance

into ~/.gti/llm-fine-tuning/<project>/datasets/ unless --out-dir says otherwise. An
--input given as a bare file name that does not exist in the current folder is read
from ~/.gti/llm-fine-tuning/<project>/data/.

The split is by group (whole sessions, never chunks of one session on both sides),
seeded, so rebuilds and other runs hold out the same sessions. Rows without a group
are their own group; if your rows are windows of longer sessions, give them the
session id as "group" or the split leaks.

Rows from tinker-ai-skill's build_dataset.py are accepted as they are.

Examples:
  python prepare_dataset.py --input path/to/rows.jsonl --name my-run
  python prepare_dataset.py --input path/to/rows.jsonl --input conversational.jsonl \\
      --name my-run --val-fraction 0.05 --seed my-seed
  python prepare_dataset.py --input path/to/rows.jsonl --name my-run-256k --model thinkingmachines/Inkling-2-Small:peft:262144
"""
import argparse
import hashlib
import json
import statistics
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from inkling2 import (CONTEXT_CAP, EFFORT, MODEL, MODEL_256K, TRAIN_PRICE, Renderer, RowError,  # noqa: E402
                      check_conversation, dataset_paths, normalize_row, normalize_tools, read_jsonl,
                      sha256_file, work_dir, work_path, write_json, write_jsonl)


def split_of(group, seed, val_fraction):
    h = int(hashlib.sha256(f"{seed}:{group}".encode()).hexdigest()[:12], 16) / float(1 << 48)
    return "val" if h < val_fraction else "train"


def opens_with_tool_call(messages):
    """True if the first assistant message after the first user message calls a tool."""
    seen_user = False
    for m in messages:
        if m["role"] == "user":
            seen_user = True
        elif m["role"] == "assistant" and seen_user:
            return bool(m.get("tool_calls"))
    return False


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", action="append", required=True, type=Path, help="JSONL file (repeatable)")
    ap.add_argument("--name", required=True, help="dataset name; files go to <out-dir>/<name>.*")
    ap.add_argument("--out-dir", type=Path, help="default: ~/.gti/llm-fine-tuning/<project>/datasets")
    ap.add_argument("--model", default=MODEL, choices=[MODEL, MODEL_256K],
                    help="Tinker variant you will train on; sets the row budget (default: the 64K variant)")
    ap.add_argument("--max-len", type=int, help="row budget in tokens (default: the variant's cap)")
    ap.add_argument("--effort", type=float, default=EFFORT, help="thinking effort rendered into every row (0.9 = high)")
    ap.add_argument("--val-fraction", type=float, default=0.05)
    ap.add_argument("--seed", default="inkling2-split-v1", help="split seed; keep it fixed across rebuilds")
    ap.add_argument("--tools-file", type=Path,
                    help="JSON list of tool definitions to declare on rows that have none")
    ap.add_argument("--allow-no-tools", action="store_true",
                    help="permit rows with no tool definitions (not recommended: tool use regressed for us)")
    ap.add_argument("--drop-overlong", action="store_true", help="drop rows over the budget instead of failing")
    ap.add_argument("--skip-bad-rows", action="store_true", help="drop structurally invalid rows instead of failing")
    args = ap.parse_args()
    if not 0.0 < args.val_fraction < 0.5:
        ap.error("--val-fraction must be in (0, 0.5)")
    max_len = args.max_len or CONTEXT_CAP[args.model]
    if max_len > CONTEXT_CAP[args.model]:
        ap.error(f"--max-len {max_len} exceeds the {args.model} cap of {CONTEXT_CAP[args.model]}")
    default_tools = normalize_tools(json.loads(args.tools_file.read_text())) if args.tools_file else None
    args.out_dir = args.out_dir or work_dir("datasets")
    args.input = [p if p.exists() else work_path(p, "data") for p in args.input]

    renderer = Renderer(model_name=args.model, effort=args.effort)
    rows = {"train": [], "val": []}
    manifest, errors, overlong = [], [], []
    warn = Counter()
    think_turns = assistant_turns = 0
    for path in args.input:
        for line_no, raw in read_jsonl(path):
            where = f"{path}:{line_no}"
            try:
                messages, repairs = normalize_row(raw.get("messages"))
                tools = normalize_tools(raw.get("tools")) or default_tools or []
                if not tools and not args.allow_no_tools:
                    raise RowError("no tool definitions (pass --tools-file, or --allow-no-tools)")
                for w in repairs + check_conversation(messages):
                    warn[w] += 1
            except (RowError, KeyError, TypeError, AttributeError) as e:
                errors.append(f"{where}: {e}")
                continue
            ids, mask = renderer.render(messages, tools)
            n, n_loss = len(ids), sum(mask[1:])
            if n > max_len:
                overlong.append(f"{where}: {n} tokens")
                continue
            if n_loss == 0:
                errors.append(f"{where}: no loss tokens")
                continue
            for m in messages:
                if m["role"] == "assistant":
                    assistant_turns += 1
                    think_turns += any(p["type"] == "thinking" for p in m["content"])
            group = str(raw.get("group") or raw.get("session") or where)
            split = split_of(group, args.seed, args.val_fraction)
            rows[split].append({"messages": messages, "tools": tools})
            manifest.append({"source": where, "group": group, "split": split, "index": len(rows[split]) - 1,
                             "tokens": n, "loss_tokens": n_loss, "tools": len(tools),
                             "opens_with_tool_call": opens_with_tool_call(messages),
                             "has_system_prompt": messages[0]["role"] == "system"})
    if errors and not args.skip_bad_rows:
        print("\n".join(errors[:40]), file=sys.stderr)
        sys.exit(f"{len(errors)} invalid rows (fix them, or pass --skip-bad-rows)")
    if overlong and not args.drop_overlong:
        print("\n".join(overlong[:40]), file=sys.stderr)
        sys.exit(f"{len(overlong)} rows exceed {max_len} tokens with the Inkling 2 tokenizer. Re-chunk them "
                 f"for this model (tinker-ai-skill: build_dataset.py --model {MODEL} --max-len {max_len}), "
                 f"or pass --drop-overlong")
    if not rows["val"] or not rows["train"]:
        sys.exit(f"split produced train={len(rows['train'])} val={len(rows['val'])}; "
                 f"add data or change --val-fraction / --seed")

    paths = dataset_paths(args.out_dir / args.name)
    write_jsonl(paths["train"], rows["train"])
    write_jsonl(paths["val"], rows["val"])
    write_json(paths["manifest"], manifest)

    by = {s: [m for m in manifest if m["split"] == s] for s in ("train", "val")}
    tokens = {s: sum(m["tokens"] for m in by[s]) for s in by}
    openers = [m for m in manifest if m["has_system_prompt"]]
    tool_openers = sum(m["opens_with_tool_call"] for m in openers)
    advice = []
    if openers and tool_openers / len(openers) > 0.9:
        advice.append(f"{tool_openers}/{len(openers)} rows open with a tool call. A fine-tune on this learns "
                      f"'session start = start working' and calls tools on a greeting. Add a conversational "
                      f"slice (conversational_slice.py) before training.")
    if assistant_turns and think_turns / assistant_turns < 0.99:
        advice.append(f"only {think_turns}/{assistant_turns} assistant turns carry thinking. Inkling 2 is a "
                      f"thinking model; turns without thinking teach it to skip reasoning. Generate grounded "
                      f"thinking for them or drop those rows.")
    if sum(1 for m in manifest if not m["has_system_prompt"]) > 0:
        advice.append("some rows have no system prompt. Train with the system prompt you will serve with.")
    report = {
        "name": args.name, "model": args.model, "max_len": max_len, "effort": args.effort,
        "seed": args.seed, "val_fraction": args.val_fraction,
        "rows": {s: len(rows[s]) for s in rows}, "tokens": tokens,
        "loss_tokens": {s: sum(m["loss_tokens"] for m in by[s]) for s in by},
        "row_tokens_max": max(m["tokens"] for m in manifest),
        "row_tokens_mean": round(statistics.mean(m["tokens"] for m in manifest)),
        "groups": {s: len({m["group"] for m in by[s]}) for s in by},
        "val_groups": sorted({m["group"] for m in by["val"]}),
        "train_val_group_overlap": sorted({m["group"] for m in by["train"]} & {m["group"] for m in by["val"]}),
        "rows_opening_with_tool_call": f"{tool_openers}/{len(openers)}",
        "assistant_turns_with_thinking": f"{think_turns}/{assistant_turns}",
        "estimated_train_cost_per_epoch_usd": round(tokens["train"] / 1e6 * TRAIN_PRICE[args.model], 2),
        "dropped": {"invalid": len(errors), "overlong": len(overlong)},
        "warnings": dict(warn), "advice": advice,
        "template_provenance": renderer.provenance,
        "files_sha256": {s: sha256_file(paths[s]) for s in ("train", "val")},
        "inputs": [str(p) for p in args.input],
    }
    assert not report["train_val_group_overlap"]
    write_json(paths["report"], report)
    print(json.dumps({k: report[k] for k in ("name", "model", "max_len", "effort", "rows", "tokens", "loss_tokens",
                                             "row_tokens_max", "groups", "rows_opening_with_tool_call",
                                             "assistant_turns_with_thinking", "estimated_train_cost_per_epoch_usd",
                                             "dropped")}, indent=1))
    for a in advice:
        print(f"ADVICE: {a}")
    print(f"wrote {paths['train']}, {paths['val']}, {paths['report'].name}, {paths['manifest'].name}")


if __name__ == "__main__":
    main()
