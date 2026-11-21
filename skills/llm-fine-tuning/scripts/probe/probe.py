#!/usr/bin/env python3
"""Behaviour probe for a base model, a fine-tuned checkpoint, or any served copy.

Loss curves do not show whether a fine-tune still behaves. This asks a few prompts
several times each through an OpenAI-compatible /chat/completions endpoint and
counts what comes back:

  greeting           "Hey there!"                              -> text, no tool call
  no-tool question   a conceptual question, no files needed     -> text, no tool call
  task               a real task (only when tools are declared) -> at least one tool call

It also counts literal <think> tags leaking into visible text.

Declare the SAME system prompt and tool set the rows were trained with (default: the
first train row of --dataset, as written by check_dataset.py). With a single tool
declared, even a base model reaches for it on a greeting; that is base behaviour.
Run the probe on the base first (the baseline), then on every saved checkpoint, then
on the merged or served copy.

Standard library only. Results are written as JSON to
~/.gti/llm-fine-tuning/<project>/probes/ (GTI_HOME replaces ~/.gti). API keys come
from the environment or from ~/.gti/llm-fine-tuning/.env.

Examples:
  python probe.py --base-url https://api.example.com/v1 --model base-model --dataset my-run
  python probe.py --base-url http://localhost:8000/v1 --model my-finetune --api-key-env NONE --dataset my-run -n 12
  python probe.py --base-url http://localhost:8000/v1 --model my-finetune --api-key-env NONE \\
      --system-prompt-file system.txt --tools-file tools.json --probes-file probes.json --reasoning-effort high
Exit code 1 on FAIL.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.chat_rows import normalize_tools, write_json  # noqa: E402
from common.gti import gti_dir, load_dotenv, slug, stamp, work_path  # noqa: E402

PROBES_WITH_TOOLS = {
    "greeting": {"prompt": "Hey there!", "expect": "text"},
    "no-tool question": {"prompt": "Quick question, no need to look at any files: what's the difference "
                                   "between a list and a tuple in Python?", "expect": "text"},
    "task": {"prompt": "Find out which tests in this repo are failing and why.", "expect": "tool"},
}
PROBES_NO_TOOLS = {k: v for k, v in PROBES_WITH_TOOLS.items() if v["expect"] == "text"}


def chat(base_url, key, body, timeout=600):
    req = urllib.request.Request(base_url.rstrip("/") + "/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return 200, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")[:200]
    except urllib.error.URLError as e:
        return 0, str(e.reason)[:200]


def run_probes(base_url, key, model, system, tools, probes, n=4, max_tokens=900, effort=None,
               temperature=1.0, top_p=0.95, allow=0):
    results, bad, tool_misses = {}, 0, []
    for name, spec in probes.items():
        kinds, examples = Counter(), []
        for _ in range(n):
            msgs = ([{"role": "system", "content": system}] if system else []) + \
                   [{"role": "user", "content": spec["prompt"]}]
            body = {"model": model, "messages": msgs, "max_tokens": max_tokens,
                    "temperature": temperature, "top_p": top_p}
            if tools:
                body["tools"] = tools
            if effort is not None:
                body["reasoning_effort"] = effort
            status, data = chat(base_url, key, body)
            if status != 200:
                kinds["http_error"] += 1
                examples.append(f"HTTP {status}: {data}")
                continue
            m = data["choices"][0]["message"]
            calls, content = m.get("tool_calls") or [], m.get("content") or ""
            kinds["tool" if calls else "text"] += 1
            if "<think>" in content or "</think>" in content:
                kinds["think_leak"] += 1
            examples.append(calls[0]["function"]["name"] if calls else content[:70].replace("\n", " "))
        results[name] = {"expect": spec["expect"], "counts": dict(kinds), "examples": examples[:3]}
        if kinds["http_error"] == n:
            results[name]["all_failed"] = True
        if spec["expect"] == "text":
            bad += kinds["tool"] + kinds["think_leak"]
        elif kinds["tool"] == 0:
            tool_misses.append(name)
    all_failed = [k for k, v in results.items() if v.get("all_failed")]
    verdict = "ERROR" if all_failed else ("PASS" if bad <= allow and not tool_misses else "FAIL")
    return {"model": model, "base_url": base_url, "samples_per_probe": n, "effort": effort,
            "tools": len(tools), "verdict": verdict, "bad_on_text_probes": bad, "allowed": allow,
            "task_probes_without_tool_call": tool_misses, "all_requests_failed": all_failed, "probes": results}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base-url", required=True, help="OpenAI-compatible root, ending in /v1")
    ap.add_argument("--model", required=True, help="model name the endpoint expects")
    ap.add_argument("--api-key-env", default="OPENAI_API_KEY", help="env var with the API key ('NONE' for none)")
    ap.add_argument("--dataset", help="dataset name or path prefix from check_dataset.py; its first train row "
                                      "supplies the system prompt and tools")
    ap.add_argument("--system-prompt-file", type=Path)
    ap.add_argument("--tools-file", type=Path, help="JSON list of tool definitions")
    ap.add_argument("--probes-file", type=Path, help='JSON {"name": {"prompt": "...", "expect": "text"|"tool"}}')
    ap.add_argument("-n", type=int, default=4, help="samples per probe (use 12 before concluding from one miss)")
    ap.add_argument("--reasoning-effort", help="sent as reasoning_effort when given (preset or number)")
    ap.add_argument("--temperature", type=float, default=1.0)
    ap.add_argument("--top-p", type=float, default=0.95)
    ap.add_argument("--max-tokens", type=int, default=900)
    ap.add_argument("--allow", type=int, default=0, help="tool calls or think leaks tolerated on text probes")
    ap.add_argument("--out", type=Path, help="result JSON (default: <work folder>/probes/<model>-<time>.json)")
    args = ap.parse_args()
    load_dotenv()

    system, tools = None, []
    if args.dataset:
        train = work_path(args.dataset, "datasets")
        train = train.with_name(train.name + ".train.jsonl")
        with train.open(encoding="utf-8") as f:
            row = json.loads(f.readline())
        if row["messages"][0]["role"] == "system":
            system = row["messages"][0]["content"]
        tools = row.get("tools") or []
    if args.system_prompt_file:
        system = args.system_prompt_file.read_text(encoding="utf-8").strip()
    if args.tools_file:
        tools = normalize_tools(json.loads(args.tools_file.read_text(encoding="utf-8")))
    probes = (json.loads(args.probes_file.read_text(encoding="utf-8")) if args.probes_file
              else PROBES_WITH_TOOLS if tools else PROBES_NO_TOOLS)
    if any(p.get("expect") == "tool" for p in probes.values()) and not tools:
        sys.exit("a probe expects a tool call but no tools are declared: pass --dataset or --tools-file")
    if args.api_key_env == "NONE":
        key = "none"
    else:
        key = os.environ.get(args.api_key_env) or sys.exit(f"{args.api_key_env} is not set")
    effort = args.reasoning_effort
    if effort is not None:
        try:
            effort = float(effort)
        except ValueError:
            pass

    print(f"model: {args.model}  effort: {effort}  tools: {len(tools)}  samples/probe: {args.n}")
    result = run_probes(args.base_url, key, args.model, system, tools, probes, n=args.n,
                        max_tokens=args.max_tokens, effort=effort, temperature=args.temperature,
                        top_p=args.top_p, allow=args.allow)
    for name, r in result["probes"].items():
        print(f"--- {name:18s} expect {r['expect']:4s} {r['counts']}")
        for e in r["examples"]:
            print(f"      {e!r}")
    out = args.out or gti_dir("probes") / f"{slug(args.model)}-{stamp()}.json"
    write_json(out, result)
    if result["verdict"] == "ERROR":
        sys.exit(f"every request failed for {result['all_requests_failed']}; check the model, key and endpoint")
    print(f"{result['verdict']}: {result['bad_on_text_probes']} tool calls or think leaks on text probes "
          f"(allowed {args.allow}); task probes with no tool call: "
          f"{result['task_probes_without_tool_call'] or 'none'}")
    print(f"wrote {out}")
    sys.exit(0 if result["verdict"] == "PASS" else 1)


if __name__ == "__main__":
    main()
