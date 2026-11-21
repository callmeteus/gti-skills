#!/usr/bin/env python3
"""Step 8: prove the merged checkpoint is the model you trained, token by token.

Both sides score the same rendered token ids (the training rendering of your
validation rows), so an exact merge must reproduce the Tinker-served adapter's
per-token logprobs up to kernel noise. What we saw for an exact merge served by
SGLang on two B300: NLL 0.647 merged vs 0.644 on Tinker, mean |delta logprob| 0.07,
against 0.14 between either and the base model.

  render   val rows -> ids + loss mask JSONL                        (offline)
  tinker   per-token logprobs from a tinker:// sampler or base model (TINKER_API_KEY)
  sglang   per-token logprobs from an SGLang server (/generate with input_ids)
  compare  two logprob files -> masked NLL per side, per-token differences

Run `tinker` on the base model too: the merged copy should sit much closer to the
adapter than to the base.

Bare file names (val16.jsonl) live in ~/.gti/llm-fine-tuning/<project>/check/.

Examples:
  python merge_check.py render --dataset my-run --rows 16 --out val16.jsonl
  python merge_check.py tinker --rows val16.jsonl --model tinker://<run-id>:train:0/sampler_weights/final --out tinker.jsonl
  python merge_check.py tinker --rows val16.jsonl --model thinkingmachines/Inkling-2-Small --out base.jsonl
  python merge_check.py sglang --rows val16.jsonl --url http://localhost:30000 --out merged.jsonl
  python merge_check.py compare tinker.jsonl merged.jsonl --rows val16.jsonl
"""
import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from inkling2 import Renderer, dataset_paths, load_dotenv, read_jsonl, work_path  # noqa: E402


def digest(ids):
    return hashlib.sha256(json.dumps(ids).encode()).hexdigest()[:16]


def rows_of(path):
    return [r for _, r in read_jsonl(path)]


def cmd_render(args):
    report = json.loads(dataset_paths(args.dataset)["report"].read_text())
    renderer = Renderer(model_name=report["model"], effort=report["effort"])
    args.out.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with args.out.open("w") as f:
        for i, (_, row) in enumerate(read_jsonl(dataset_paths(args.dataset)["val"])):
            if args.rows and n >= args.rows:
                break
            ids, mask = renderer.render(row["messages"], tools=row.get("tools"))
            if args.max_tokens and len(ids) > args.max_tokens:
                continue
            f.write(json.dumps({"row": i, "ids": ids, "mask": mask, "digest": digest(ids)}) + "\n")
            n += 1
    print(f"wrote {n} rows -> {args.out} ({renderer.provenance['renderer']}, effort {renderer.effort})")


def cmd_tinker(args):
    load_dotenv()
    import tinker
    from tinker import types
    svc = tinker.ServiceClient()
    sc = (svc.create_sampling_client(model_path=args.model) if args.model.startswith("tinker://")
          else svc.create_sampling_client(base_model=args.model))
    rows = rows_of(args.rows)
    futures = [(r, sc.compute_logprobs(types.ModelInput.from_ints(r["ids"]))) for r in rows]
    t0 = time.time()
    with args.out.open("w") as f:
        for r, fut in futures:
            lps = fut.result()
            assert len(lps) == len(r["ids"]), (len(lps), len(r["ids"]))
            f.write(json.dumps({"row": r["row"], "digest": r["digest"], "logprobs": lps}) + "\n")
    print(f"tinker: {len(rows)} rows, {sum(len(r['ids']) for r in rows):,} tokens in {time.time() - t0:.0f}s -> {args.out}")


def cmd_sglang(args):
    import httpx
    rows = rows_of(args.rows)
    t0 = time.time()
    with args.out.open("w") as f, httpx.Client(timeout=1800) as client:
        for r in rows:
            body = {"input_ids": r["ids"], "sampling_params": {"max_new_tokens": 0, "temperature": 0},
                    "return_logprob": True, "logprob_start_len": 0}
            resp = client.post(args.url.rstrip("/") + "/generate", json=body)
            resp.raise_for_status()
            toks = resp.json()["meta_info"]["input_token_logprobs"]  # [[logprob, token_id, text?], ...]
            lps = [None if t[0] is None else float(t[0]) for t in toks]
            if [t[1] for t in toks][1:] != r["ids"][1:]:
                sys.exit(f"row {r['row']}: server token ids differ from the rendered ids")
            if len(lps) != len(r["ids"]):
                sys.exit(f"row {r['row']}: got {len(lps)} logprobs for {len(r['ids'])} ids")
            f.write(json.dumps({"row": r["row"], "digest": r["digest"], "logprobs": lps}) + "\n")
            print(f"  row {r['row']}: {len(lps):,} tokens, {time.time() - t0:.0f}s", flush=True)
    print(f"sglang: {len(rows)} rows in {time.time() - t0:.0f}s -> {args.out}")


def cmd_compare(args):
    a = {r["digest"]: r for r in rows_of(args.a)}
    b = {r["digest"]: r for r in rows_of(args.b)}
    masks = {r["digest"]: r["mask"] for r in rows_of(args.rows)} if args.rows else None
    common = sorted(set(a) & set(b))
    if not common:
        sys.exit("no rows in common (were both scored from the same render file?)")
    n = nll_a = nll_b = absdiff = maxdiff = gt1 = 0
    for d in common:
        la, lb = a[d]["logprobs"], b[d]["logprobs"]
        mask = masks[d] if masks else [1] * len(la)
        for i in range(1, min(len(la), len(lb))):
            if la[i] is None or lb[i] is None or not mask[i]:
                continue
            diff = abs(la[i] - lb[i])
            n += 1; nll_a -= la[i]; nll_b -= lb[i]; absdiff += diff
            maxdiff = max(maxdiff, diff); gt1 += diff > 1.0
    n = max(n, 1)
    print(json.dumps({"rows": len(common), "scored_tokens": n, "nll_a": nll_a / n, "nll_b": nll_b / n,
                      "mean_abs_logprob_diff": absdiff / n, "max_abs_logprob_diff": maxdiff,
                      "frac_diff_gt_1": gt1 / n, "masked_to_loss_tokens": bool(masks),
                      "a": str(args.a), "b": str(args.b)}, indent=1))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("render"); p.add_argument("--dataset", required=True)
    p.add_argument("--rows", type=int, default=16, help="first N val rows (0 = all)")
    p.add_argument("--max-tokens", type=int, default=0, help="skip rows longer than this")
    p.add_argument("--out", type=Path, required=True); p.set_defaults(fn=cmd_render)
    p = sub.add_parser("tinker"); p.add_argument("--rows", type=Path, required=True)
    p.add_argument("--model", required=True); p.add_argument("--out", type=Path, required=True); p.set_defaults(fn=cmd_tinker)
    p = sub.add_parser("sglang"); p.add_argument("--rows", type=Path, required=True)
    p.add_argument("--url", required=True, help="SGLang server root (not /v1)")
    p.add_argument("--out", type=Path, required=True); p.set_defaults(fn=cmd_sglang)
    p = sub.add_parser("compare"); p.add_argument("a", type=Path); p.add_argument("b", type=Path)
    p.add_argument("--rows", type=Path, help="the render file; restricts the comparison to loss tokens")
    p.set_defaults(fn=cmd_compare)
    args = ap.parse_args()
    for key in ("rows", "out", "a", "b"):
        if isinstance(getattr(args, key, None), Path):
            setattr(args, key, work_path(getattr(args, key), "check"))
    args.fn(args)


if __name__ == "__main__":
    main()
