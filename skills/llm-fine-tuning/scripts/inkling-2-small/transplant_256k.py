#!/usr/bin/env python3
"""Step 6: move a 64K-trained adapter onto the 256K Tinker variant, without retraining.

Tinker serves Inkling 2 Small as two variants with hard caps on prompt + output:
  thinkingmachines/Inkling-2-Small                65,536 tokens  ($1.50/M train tokens)
  thinkingmachines/Inkling-2-Small:peft:262144   262,144 tokens  ($3.00/M train tokens)
Agent harnesses overflow 64K fast (a coding agent's first request with a large tool
set plus 16K of output room already did), so train on the cheaper 64K variant and
transplant: ServiceClient.create_training_client_from_state takes a base_model
override that must be "compatible with the checkpoint, e.g. a different context
length". Loading took 19 seconds for us; the only cost is one saved checkpoint.

The input is a TRAINING checkpoint (tinker://<run>/weights/<name>), not a sampler
path. The output is a TTL-free sampler path you can use as a model name on Tinker's
OpenAI- and Anthropic-compatible endpoints.

--needle runs a recall check at long context, the adapter against the base 256K
variant (130K + 250K prompts on both: about 760K prompt tokens, ~$0.25 at list prices).

Examples:
  python transplant_256k.py --run-dir <run> --checkpoint final
  python transplant_256k.py --state-path tinker://<run-id>:train:0/weights/final --needle 130000 250000
  python transplant_256k.py --run-dir <run> --dry-run

A bare --run-dir name resolves to ~/.gti/llm-fine-tuning/<project>/runs/<name>.
"""
import argparse
import json
import os
import random
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))
from inkling2 import CONTEXT_CAP, MODEL, MODEL_256K, TINKER_OAI_URL, load_dotenv, work_path  # noqa: E402

WORDS = ("amber basil cedar delta ember fjord granite harbor iris juniper kelp lantern meadow nectar "
         "orchid pebble quartz river saffron thistle umber velvet willow xenon yarrow zephyr").split()


def state_path_from_run(run_dir, name):
    ck = work_path(run_dir, "runs") / "checkpoints.jsonl"
    if not ck.exists():
        sys.exit(f"{ck} not found")
    records = [json.loads(l) for l in ck.read_text().splitlines() if l.strip()]
    match = [r for r in records if r.get("name") == name and r.get("state_path")]
    if not match:
        sys.exit(f"no training checkpoint {name!r} in {ck}; available: {[r.get('name') for r in records]}")
    return match[-1]["state_path"]


def haystack(target_tokens, needle, depth, seed=0):
    """Deterministic filler of about target_tokens Inkling 2 tokens with the needle at depth."""
    from tinker_cookbook.tokenizer_utils import get_tokenizer
    tok = get_tokenizer(MODEL)
    rng = random.Random(seed)
    para = " ".join(" ".join(rng.choice(WORDS) for _ in range(12)) + "." for _ in range(40))
    per = len(tok.encode(para))
    paras = [para] * max(1, target_tokens // per)
    paras.insert(int(len(paras) * depth), f"The secret codename is {needle}.")
    return "\n\n".join(paras)


def needle_test(model, sizes, key):
    needle = "apricot-lantern-42"
    rows = []
    with httpx.Client(timeout=1800) as client:
        for size in sizes:
            if size + 4096 > CONTEXT_CAP[MODEL_256K]:
                sys.exit(f"{size} + 4096 output tokens exceeds the 256K cap")
            text = haystack(size, needle, depth=0.12)
            question = text + "\n\nWhat is the secret codename? Reply with just the codename."
            for label, m in (("adapter", model), ("base 256K", MODEL_256K)):
                t0 = time.time()
                r = client.post(f"{TINKER_OAI_URL}/chat/completions", headers={"Authorization": f"Bearer {key}"},
                                json={"model": m, "messages": [{"role": "user", "content": question}],
                                      "max_tokens": 4096, "temperature": 1.0, "top_p": 0.95,
                                      "reasoning_effort": "high"})
                if r.status_code != 200:
                    rows.append({"size": size, "model": label, "result": f"HTTP {r.status_code}: {r.text[:120]}"})
                    continue
                content = r.json()["choices"][0]["message"].get("content") or ""
                rows.append({"size": size, "model": label, "found": needle in content,
                             "answer": content.strip()[:60], "seconds": round(time.time() - t0)})
            print(json.dumps(rows[-2:]), flush=True)
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--run-dir", type=Path, help="training run directory (reads checkpoints.jsonl)")
    src.add_argument("--state-path", help="tinker://<run>/weights/<name>")
    ap.add_argument("--checkpoint", default="final", help="checkpoint name in the run (default: final)")
    ap.add_argument("--name", default="transplant-256k", help="name of the saved sampler weights")
    ap.add_argument("--target-model", default=MODEL_256K)
    ap.add_argument("--needle", type=int, nargs="*", metavar="TOKENS",
                    help="also run a needle-recall check at these prompt sizes (e.g. 130000 250000)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    load_dotenv()
    path = args.state_path or state_path_from_run(args.run_dir, args.checkpoint)
    if "/sampler_weights/" in path:
        sys.exit("pass a training checkpoint (…/weights/<name>), not a sampler path")
    print(json.dumps({"from": path, "onto": args.target_model, "save_as": args.name}, indent=1))
    if args.dry_run:
        return
    key = os.environ.get("TINKER_API_KEY") or sys.exit("TINKER_API_KEY is not set")
    import tinker
    t0 = time.time()
    svc = tinker.ServiceClient()
    tc = svc.create_training_client_from_state(path, base_model=args.target_model).result()
    sampler = tc.save_weights_for_sampler(args.name).result().path
    print(f"loaded and saved in {time.time() - t0:.0f}s")
    print(f"sampler path: {sampler}")
    if args.needle:
        needle_test(sampler, args.needle, key)
    print("Next: python probe.py --dataset <name> --model " + sampler)


if __name__ == "__main__":
    main()
