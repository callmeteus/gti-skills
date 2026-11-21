#!/usr/bin/env python3
"""Step 3 (recommended): self-distil a conversational slice from the base model.

Why: agent transcripts nearly always open with a tool call (112 of our 113 fresh
sessions did) and contain almost no plain conversation, so a fine-tune learns
"session start = start working" and calls tools on "Hey there!". These rows teach the
opposite, in the base model's OWN voice and thinking: greetings, capability questions,
conceptual questions with follow-ups, planning talk with "don't touch anything yet",
ambiguous asks that deserve a clarifying question, and, in some scenarios, a final
user turn that IS a task, where a tool call is the right move and ends the row.

Mechanics per conversation:
  * system prompt and tool set taken from a random row of YOUR dataset, so the slice
    is conditioned exactly like the rest of training (the full tool set is the
    temptation being trained against);
  * user turns from scripted, seeded scenario banks;
  * assistant turns sampled from the base at the training effort through the exact
    training renderer, with the full history including earlier thinking;
  * acceptance: clean stop, non-empty thinking, non-empty text; on turns that must be
    text any tool call is rejected and resampled (--max-tries), otherwise the
    conversation is dropped; a tool call on a task turn is kept and ends the row (no
    tool results are invented).

Costs money (Tinker sampling). --dry-run prints sample scenarios and an upper-bound
cost estimate without calling the service. 132 conversations cost us a few dollars.

Output: <out>.jsonl rows {"messages", "tools", "group"} and <out>.manifest.json. A bare
--out stem goes to ~/.gti/llm-fine-tuning/<project>/data/. Feed the file to
prepare_dataset.py as another --input.

Examples:
  python conversational_slice.py --source-rows path/to/rows.jsonl --n 150 --out conversational --dry-run
  python conversational_slice.py --source-rows path/to/rows.jsonl --n 150 --out conversational
"""
import argparse
import asyncio
import json
import random
import sys
import time
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from inkling2 import (CONTEXT_CAP, EFFORT, MODEL, SAMPLE_PRICE, Renderer, load_dotenv, normalize_tools,  # noqa: E402
                      read_jsonl, work_path, write_json, write_jsonl)

GREETINGS = ["Hey there!", "Hi!", "Hello!", "Hey, good morning.", "Yo!", "Morning! Coffee first, then code.",
             "Hi, just opened the terminal.", "Hey, you there?", "Hello hello.", "Hey! Long day.", "Good evening."]
CAPABILITY_QS = ["What can you actually do in here?", "Quick one: what tools do you have access to?",
                 "Before we start, what are you good at and what should I not expect from you?",
                 "How do you usually approach a bug report?", "Can you run commands, or just suggest them?",
                 "Do you remember anything from previous sessions, or do we start fresh each time?",
                 "What's your process when I give you a vague task?"]
CLOSINGS = ["Thanks, that's all for now.", "Great, thanks!", "Perfect. I'll be back with an actual task later.",
            "Cool, that clears it up. Talk soon.", "Nice. Nothing else right now.", "Got it, thanks. Signing off."]
FOLLOWUPS = ["Can you give a short example?", "And what's the downside?", "Shorter version please, two sentences.",
             "When would you NOT do that?", "How does that compare to the alternative?", "Any gotchas I should know?",
             "Okay, and in Rust?", "Why does that happen under the hood?", "Give me a mental model for it."]
CONCEPT_QS = ["Quick question, no need to look at any files: what's the difference between a list and a tuple in Python?",
              "Conceptual question only: when should I reach for asyncio instead of threads?",
              "Explain git rebase vs merge like I'm a junior dev. No repo needed.",
              "What is a LoRA adapter, in plain terms?", "How does a TCP handshake work?",
              "What does 'idempotent' mean for an HTTP endpoint, and why do I care?",
              "In SQL, what's the practical difference between an inner join and a left join?",
              "Why do people say 'don't use floats for money'?", "What's a race condition? Keep it short.",
              "Explain what a Docker image layer is.", "What does `set -euo pipefail` do in bash?",
              "What's the difference between authentication and authorization?",
              "What is backpressure in a streaming system?", "What's the difference between a process and a thread?",
              "What's a good rule of thumb for when to write a test?", "What's the difference between `==` and `is` in Python?",
              "What is a mutex and when do I need one?", "Explain what a reverse proxy does.",
              "What does 'eventually consistent' mean?", "How do JWTs work and what's the common mistake with them?"]
PLANNING = ["I'm thinking about migrating this service from Flask to FastAPI. Don't touch anything yet, just talk me through what to consider.",
            "We might move our tests from unittest to pytest. No changes yet, I just want your take on whether it's worth it.",
            "I'm considering splitting this repo into two packages. Don't look at the code yet; what would you want to know first?",
            "I want to containerize this project eventually. Hold off on any commands; what's your rough plan?",
            "We keep getting flaky CI runs. Don't run anything yet, just tell me how you'd approach diagnosing that.",
            "I'm debating Postgres vs SQLite for this small app. No code changes, just opinions.",
            "Should we pin dependencies or use ranges here? Just discuss, don't edit anything.",
            "I'm tempted to rewrite the parser. Talk me out of it or into it, no tools."]
PLANNING_FOLLOWUPS = ["What would you check first once I give the go-ahead?", "How long would a first pass take, roughly?",
                      "What's the riskiest part?", "Okay. What would you NOT change?"]
AMBIGUOUS = ["fix the thing", "can you make it faster", "it's broken again", "clean this up", "deploy it", "the tests"]
CLARIFIED_TASKS = ["Sorry: the failing test is tests/test_cli.py::test_units_flag. Find out why it fails.",
                   "I mean the login endpoint is slow. Start by finding where it spends its time.",
                   "The build is broken. Run it and show me the first error.",
                   "Run the test suite and tell me which tests fail."]
GO_TASKS = ["Okay, go ahead: start by showing me the repo layout.", "Alright, take a look at the project structure now.",
            "Fine, let's do it. Begin by listing the test files.", "Okay, start: find where the config is loaded."]
NO_TASK_YET = ["No task yet, just saying hi before I dig in.", "Nothing to do yet. I'll give you the real task in a minute.",
               "Just warming up. Don't start anything."]


def scenario(rng):
    """(kind, [(user_text, expect)]) with expect 'text' (no tool call allowed) or 'any'."""
    kind = rng.choice(["greeting_chat", "greeting_question", "direct_question", "planning", "ambiguous", "chat_then_task"])
    if kind == "greeting_chat":
        turns = [(rng.choice(GREETINGS), "text"), (rng.choice(CAPABILITY_QS), "text"), (rng.choice(CLOSINGS), "text")]
    elif kind == "greeting_question":
        turns = [(rng.choice(GREETINGS), "text"), (rng.choice(CONCEPT_QS), "text"), (rng.choice(FOLLOWUPS), "text")]
        if rng.random() < 0.6:
            turns.append((rng.choice(CLOSINGS), "text"))
    elif kind == "direct_question":
        turns = [(rng.choice(CONCEPT_QS), "text"), (rng.choice(FOLLOWUPS), "text")]
        if rng.random() < 0.5:
            turns.append((rng.choice(FOLLOWUPS), "text"))
    elif kind == "planning":
        turns = [(rng.choice(PLANNING), "text"), (rng.choice(PLANNING_FOLLOWUPS), "text")]
        turns.append((rng.choice(GO_TASKS), "any") if rng.random() < 0.5 else (rng.choice(CLOSINGS), "text"))
    elif kind == "ambiguous":
        turns = [(rng.choice(AMBIGUOUS), "text"), (rng.choice(CLARIFIED_TASKS), "any")]
    else:
        turns = [(rng.choice(GREETINGS) + " " + rng.choice(NO_TASK_YET), "text"), (rng.choice(GO_TASKS), "any")]
    return kind, turns


def load_contexts(path, limit=2000):
    """(system prompt or None, tools) pairs from the user's rows."""
    seen, out = set(), []
    for _, row in read_jsonl(path):
        msgs = row.get("messages") or []
        system = msgs[0]["content"] if msgs and msgs[0].get("role") == "system" else None
        tools = normalize_tools(row.get("tools"))
        if not tools:
            continue
        key = (system, json.dumps(tools, sort_keys=True))
        if key not in seen:
            seen.add(key)
            out.append((system, tools))
        if len(out) >= limit:
            break
    if not out:
        sys.exit(f"no rows with tool definitions in {path}")
    return out


def to_dataset_message(msg, counter):
    """Parsed cookbook message -> dataset assistant message."""
    parts, content = [], msg.get("content")
    if isinstance(content, str):
        if content.strip():
            parts.append({"type": "text", "text": content})
    else:
        for p in content or []:
            if p.get("type") == "thinking" and (p.get("thinking") or "").strip():
                parts.append({"type": "thinking", "thinking": p["thinking"]})
            elif p.get("type") == "text" and (p.get("text") or "").strip():
                parts.append({"type": "text", "text": p["text"]})
    out, calls = {"role": "assistant", "content": parts}, []
    for tc in msg.get("tool_calls") or []:
        counter[0] += 1
        fn = tc.function if hasattr(tc, "function") else None
        name = fn.name if fn else tc["function"]["name"]
        args = fn.arguments if fn else tc["function"]["arguments"]
        calls.append({"id": getattr(tc, "id", None) or f"call_{counter[0]:04d}", "type": "function",
                      "function": {"name": name, "arguments": args if isinstance(args, str) else json.dumps(args)}})
    if calls:
        out["tool_calls"] = calls
    return out


async def build_one(i, client, renderer, contexts, args, stats):
    import tinker
    rng = random.Random(f"{args.seed}:{i}")
    kind, turns = scenario(rng)
    system, tools = rng.choice(contexts)
    messages = [{"role": "system", "content": system}] if system else []
    usage, counter = Counter(), [0]
    params = tinker.SamplingParams(max_tokens=args.max_tokens, temperature=1.0, top_p=0.95,
                                   stop=renderer.renderer.get_stop_sequences())
    for text, expect in turns:
        messages.append({"role": "user", "content": text})
        accepted = None
        for _ in range(args.max_tries):
            prompt = renderer.generation_prompt(messages, tools)
            result = await client.sample_async(prompt=prompt, num_samples=1, sampling_params=params)
            seq = result.sequences[0]
            usage["prompt"] += prompt.length
            usage["output"] += len(seq.tokens)
            msg, termination = renderer.renderer.parse_response(seq.tokens)  # (Message, ParseTermination)
            dm = to_dataset_message(msg, counter)
            has_think = any(p["type"] == "thinking" for p in dm["content"])
            has_text = any(p["type"] == "text" for p in dm["content"])
            if "MALFORMED" in str(termination):
                stats["reject:malformed_or_truncated"] += 1
            elif not has_think:
                stats["reject:no_thinking"] += 1
            elif expect == "text" and dm.get("tool_calls"):
                stats["reject:tool_call_on_text_turn"] += 1
            elif not has_text and not dm.get("tool_calls"):
                stats["reject:empty"] += 1
            else:
                accepted = dm
                break
        if accepted is None:
            stats["conversations_dropped"] += 1
            return None, usage
        messages.append(accepted)
        if accepted.get("tool_calls"):
            break
    stats[f"scenario:{kind}"] += 1
    return {"messages": messages, "tools": tools, "group": f"conversational:{args.seed}:{i}",
            "meta": {"scenario": kind}}, usage


async def run(args, renderer, contexts):
    import tinker
    client = await tinker.ServiceClient().create_sampling_client_async(base_model=args.model)
    stats, totals = Counter(), Counter()
    sem = asyncio.Semaphore(args.concurrency)

    async def guarded(i):
        async with sem:
            try:
                row, usage = await build_one(i, client, renderer, contexts, args, stats)
            except Exception as e:  # record and keep going
                stats[f"error:{type(e).__name__}"] += 1
                return None
            totals.update(usage)
            return row

    t0 = time.time()
    rows = [r for r in await asyncio.gather(*(guarded(i) for i in range(args.n))) if r]
    out_rows, manifest = [], []
    for r in rows:
        ids, mask = renderer.render(r["messages"], r["tools"])
        if sum(mask[1:]) == 0 or len(ids) > CONTEXT_CAP[MODEL]:
            stats["reject:size"] += 1
            continue
        out_rows.append({"messages": r["messages"], "tools": r["tools"], "group": r["group"]})
        manifest.append({**r["meta"], "group": r["group"], "tokens": len(ids), "loss_tokens": sum(mask[1:]),
                         "user_turns": sum(1 for m in r["messages"] if m["role"] == "user"),
                         "ends_with_tool_call": bool(r["messages"][-1].get("tool_calls"))})
    write_jsonl(f"{args.out}.jsonl", out_rows)
    cost = totals["prompt"] / 1e6 * SAMPLE_PRICE["prompt"] + totals["output"] / 1e6 * SAMPLE_PRICE["output"]
    report = {"model": args.model, "effort": args.effort, "rendering": renderer.provenance, "requested": args.n,
              "conversations": len(out_rows), "ending_with_tool_call": sum(m["ends_with_tool_call"] for m in manifest),
              "stats": dict(stats), "sampled_tokens": dict(totals), "cost_usd_at_list_prices": round(cost, 2),
              "seconds": round(time.time() - t0), "rows": manifest}
    write_json(f"{args.out}.manifest.json", report)
    print(json.dumps({k: v for k, v in report.items() if k != "rows"}, indent=1))
    print(f"wrote {args.out}.jsonl ({len(out_rows)} conversations). Next: add it with "
          f"prepare_dataset.py --input {args.out}.jsonl")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source-rows", type=Path, required=True,
                    help="your dataset rows (JSONL); system prompts and tool sets are drawn from them")
    ap.add_argument("--out", required=True, help="output stem (writes <out>.jsonl and <out>.manifest.json)")
    ap.add_argument("--n", type=int, default=150, help="conversations to attempt (~10%% of your rows is a good start)")
    ap.add_argument("--model", default=MODEL, help="sample from the base model you will fine-tune")
    ap.add_argument("--effort", type=float, default=EFFORT, help="must equal the dataset's training effort")
    ap.add_argument("--seed", default="conversational-v1")
    ap.add_argument("--max-tries", type=int, default=3)
    ap.add_argument("--max-tokens", type=int, default=1400)
    ap.add_argument("--concurrency", type=int, default=8)
    ap.add_argument("--dry-run", action="store_true", help="show scenarios and a cost bound; no service calls")
    args = ap.parse_args()
    load_dotenv()
    args.out = str(work_path(args.out, "data"))
    renderer = Renderer(model_name=args.model, effort=args.effort)
    contexts = load_contexts(args.source_rows)
    if args.dry_run:
        rng = random.Random(args.seed)
        for _ in range(3):
            kind, turns = scenario(rng)
            print(f"[{kind}] " + " | ".join(f"{t} ({e})" for t, e in turns))
        prefix = max(renderer.generation_prompt(([{"role": "system", "content": s}] if s else []) +
                                                [{"role": "user", "content": "hi"}], t).length
                     for s, t in contexts[:50])
        calls = args.n * 4 * args.max_tries
        bound = calls * ((prefix + 3 * args.max_tokens) / 1e6 * SAMPLE_PRICE["prompt"] +
                         args.max_tokens / 1e6 * SAMPLE_PRICE["output"])
        typical = bound / args.max_tries / 1.5
        print(json.dumps({"contexts": len(contexts), "largest_prompt_prefix_tokens": prefix,
                          "upper_bound_usd": round(bound, 2), "typical_usd": round(typical, 2)}, indent=1))
        return
    asyncio.run(run(args, renderer, contexts))


if __name__ == "__main__":
    main()
