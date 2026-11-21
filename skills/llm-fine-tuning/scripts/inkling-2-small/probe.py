#!/usr/bin/env python3
"""Step 5: behaviour probe for the base model, a Tinker checkpoint, or any served copy.

Asks three kinds of question and counts what comes back:
  greeting           "Hey there!"                         -> should be text, no tool call
  no-tool question   a conceptual question, files not needed -> should be text
  task               a real task                           -> should call a tool
Also counts literal think tags leaking into visible text.

Loss curves do not show this. A fine-tune on agent transcripts (which nearly always
open with a tool call) learns "session start = start working" and reaches for tools
on a greeting; run this on the base first, then on every saved checkpoint.

Declare the SAME system prompt and tool set the rows were trained with (default: the
first train row of --dataset). With a single tool declared, the base model itself
calls `ls` on a greeting about half the time; that is base behaviour, not your
fine-tune.

Goes through an OpenAI-compatible endpoint: Tinker's by default (sampler paths work
as model names), or your own server with --base-url. Sampling: temperature 1.0,
top-p 0.95.

Examples:
  python probe.py --dataset my-run --model thinkingmachines/Inkling-2-Small
  python probe.py --dataset my-run --model tinker://<run-id>:train:0/sampler_weights/000040 -n 6
  python probe.py --dataset my-run --model my-model --base-url http://localhost:30000/v1 --api-key-env NONE
Exit code 1 on FAIL.
"""
import argparse
import json
import os
import sys
from collections import Counter
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))
from inkling2 import TINKER_OAI_URL, dataset_paths, load_dotenv, normalize_tools  # noqa: E402

PROBES = {
    "greeting": {"prompt": "Hey there!", "expect": "text"},
    "no-tool question": {"prompt": "Quick question, no need to look at any files: what's the difference "
                                   "between a list and a tuple in Python?", "expect": "text"},
    "task": {"prompt": "Find out which tests in this repo are failing and why.", "expect": "tool"},
}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", required=True, help="base model name, tinker://.../sampler_weights/<name>, or a served name")
    ap.add_argument("--dataset", help="dataset prefix; the first train row supplies system prompt and tools")
    ap.add_argument("--system-prompt-file", type=Path)
    ap.add_argument("--tools-file", type=Path, help="JSON list of tool definitions")
    ap.add_argument("--probes-file", type=Path, help='JSON {"name": {"prompt": "...", "expect": "text"|"tool"}}')
    ap.add_argument("--base-url", default=TINKER_OAI_URL)
    ap.add_argument("--api-key-env", default="TINKER_API_KEY", help="env var with the API key ('NONE' for none)")
    ap.add_argument("-n", type=int, default=4, help="samples per probe")
    ap.add_argument("--effort", default="high",
                    help="reasoning_effort: a preset (none|minimal|low|medium|high|xhigh) or a float; "
                         "high = 0.9, the default training effort")
    ap.add_argument("--max-tokens", type=int, default=900)
    ap.add_argument("--allow", type=int, default=0, help="tool calls / think leaks tolerated on text probes")
    args = ap.parse_args()
    load_dotenv()

    system, tools = None, []
    if args.dataset:
        with dataset_paths(args.dataset)["train"].open() as f:
            row = json.loads(f.readline())
        if row["messages"][0]["role"] == "system":
            system = row["messages"][0]["content"]
        tools = row["tools"]
    if args.system_prompt_file:
        system = args.system_prompt_file.read_text().strip()
    if args.tools_file:
        tools = normalize_tools(json.loads(args.tools_file.read_text()))
    if not tools:
        sys.exit("no tools declared: pass --dataset or --tools-file (probe with the tool set you trained on)")
    probes = json.loads(args.probes_file.read_text()) if args.probes_file else PROBES
    if args.api_key_env == "NONE":
        key = "none"
    else:
        key = os.environ.get(args.api_key_env) or sys.exit(f"{args.api_key_env} is not set")
    try:
        effort = float(args.effort)
    except ValueError:
        effort = args.effort

    print(f"model: {args.model}  effort: {effort}  tools: {len(tools)}  samples/probe: {args.n}")
    bad, tool_misses = 0, []
    with httpx.Client(timeout=600) as client:
        for name, spec in probes.items():
            kinds, examples = Counter(), []
            for _ in range(args.n):
                msgs = ([{"role": "system", "content": system}] if system else []) + \
                       [{"role": "user", "content": spec["prompt"]}]
                body = {"model": args.model, "messages": msgs, "tools": tools, "max_tokens": args.max_tokens,
                        "temperature": 1.0, "top_p": 0.95, "reasoning_effort": effort}
                r = client.post(f"{args.base_url.rstrip('/')}/chat/completions", json=body,
                                headers={"Authorization": f"Bearer {key}"})
                if r.status_code != 200:
                    kinds["http_error"] += 1
                    examples.append(r.text[:100])
                    continue
                m = r.json()["choices"][0]["message"]
                calls, content = m.get("tool_calls") or [], m.get("content") or ""
                kinds["tool" if calls else "text"] += 1
                if "<think>" in content or "</think>" in content:
                    kinds["think_leak"] += 1
                examples.append(calls[0]["function"]["name"] if calls else content[:70].replace("\n", " "))
            print(f"--- {name:18s} expect {spec['expect']:4s} {dict(kinds)}")
            for e in examples[:3]:
                print(f"      {e!r}")
            if spec["expect"] == "text":
                bad += kinds["tool"] + kinds["think_leak"]
            elif kinds["tool"] == 0:
                tool_misses.append(name)
            if kinds["http_error"] == args.n:
                sys.exit(f"every request for {name!r} failed; check the model path, key and endpoint")
    verdict = "PASS" if bad <= args.allow and not tool_misses else "FAIL"
    print(f"{verdict}: {bad} tool calls or think leaks on text probes (allowed {args.allow}); "
          f"task probes with no tool call: {tool_misses or 'none'}")
    sys.exit(0 if verdict == "PASS" else 1)


if __name__ == "__main__":
    main()
