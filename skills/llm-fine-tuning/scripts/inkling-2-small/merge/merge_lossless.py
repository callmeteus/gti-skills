#!/usr/bin/env python3
"""Step 7: merge a Tinker LoRA into the released Inkling 2 Small checkpoint, exactly.

The released checkpoint (thinkingmachines/Inkling-2-Small, ~394 GB) stores its routed
experts in NVFP4 (layers 0-39) and MXFP8 (layers 40-47). Attention projections,
router, embeddings and the unembedding head are BF16. An adapter trained with the
experts frozen (train.py --adapter release) touches only BF16 tensors, so the merge
is exact:

    W  <-  bf16( fp32(W) + (alpha / r) * B @ A )

Every other tensor is copied byte for byte and every shard keeps its exact size, so
the result is a drop-in replacement for the base: same format, same serving recipes,
and an upload to the Hugging Face Hub deduplicates the unchanged bytes against the
base repository. An adapter that includes expert LoRA (--adapter full) is refused:
merging into 4-bit experts means requantizing, which erases most of a small update.

Tinker's `tinker checkpoint download tinker://<run>/weights/<name>` already gives a
PEFT-shaped directory (adapter_model.safetensors with fp32 tensors named
language_model.layers.N.attn.<proj>.lora_{A,B}.weight and language_model.lm_head,
plus adapter_config.json with r and lora_alpha).

Needs: disk for the base and the merged copy (~790 GB), RAM for one shard plus its
copy (a 96 GB machine was comfortable), no GPU. The patch itself took 8 minutes on
16 CPUs; downloading the base is the slow part.

Subcommands:
  check     inspect an adapter (and optionally the base index): rank, alpha, modules,
            whether every module has an exact BF16 target. Cheap; run it first.
  merge     write the merged checkpoint and MERGE_REPORT.json
  selftest  build a tiny synthetic checkpoint + adapter and verify the math and the
            byte-for-byte guarantees (no network, a few seconds)

Examples:
  python merge_lossless.py selftest
  python merge_lossless.py check --adapter-dir ./adapters/<run>_weights_final --base-index ./base/model.safetensors.index.json
  python merge_lossless.py merge --base-dir ./base --adapter-dir ./adapters/<run>_weights_final --out-dir ./merged
"""
import argparse
import json
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path

ATTN_PROJS = ("wq_du", "wk_dv", "wv_dv", "wo_ud", "wr_du", "gate_attn")
PREFIXES = ("base_model.model.",)  # tolerated in front of adapter module names


def module_name(key):
    """adapter tensor key -> module name without the lora_A/B suffix and known prefixes."""
    m = key.rsplit(".lora_", 1)[0]
    for p in PREFIXES:
        if m.startswith(p):
            m = m[len(p):]
    return m


def hf_target(module):
    """language_model.layers.N.attn.wq_du -> model.llm.layers.N.attn.wq_du.weight"""
    if module == "language_model.lm_head":
        return "model.llm.unembed.weight"
    parts = module.split(".")
    if len(parts) == 5 and parts[:2] == ["language_model", "layers"] and parts[3] == "attn" and parts[4] in ATTN_PROJS:
        return f"model.llm.layers.{parts[2]}.attn.{parts[4]}.weight"
    raise KeyError(f"no exact merge target for adapter module {module!r}: the routed experts are NVFP4/MXFP8. "
                   f"Train with the experts frozen (train.py --adapter release / --no-train-mlp), or serve this "
                   f"adapter on Tinker")


def adapter_info(adapter_dir):
    from safetensors import safe_open
    adir = Path(adapter_dir)
    if any(adir.glob("*.age")):
        sys.exit(f"{adir} holds age-encrypted files; decrypt them with `age -d` first")
    cfg = json.loads((adir / "adapter_config.json").read_text())
    with safe_open(str(adir / "adapter_model.safetensors"), "pt") as f:
        keys = list(f.keys())
    modules = sorted({module_name(k) for k in keys})
    r, alpha = int(cfg["r"]), float(cfg["lora_alpha"])
    return {"r": r, "lora_alpha": alpha, "scaling": alpha / r, "modules": modules, "keys": keys}


def plan_merge(adapter_dir, weight_map):
    info = adapter_info(adapter_dir)
    plan, problems = {}, []
    for m in info["modules"]:
        try:
            target = hf_target(m)
        except KeyError as e:
            problems.append(str(e))
            continue
        if weight_map is not None and target not in weight_map:
            problems.append(f"{target} (from {m}) is not in the base index")
            continue
        plan[m] = target
    return info, plan, problems


def merge_checkpoint(base_dir, adapter_dir, out_dir, force=False, commit=lambda: None, log=print):
    """Exact merge of an attention(+unembed)-only adapter into a copy of a base checkpoint.

    A pure function of three directories (the Modal app wraps it). Returns the report,
    also written to <out_dir>/MERGE_REPORT.json.
    """
    import torch
    from safetensors import safe_open
    from safetensors.torch import save_file

    base_dir, adir, odir = Path(base_dir), Path(adapter_dir), Path(out_dir)
    weight_map = json.loads((base_dir / "model.safetensors.index.json").read_text())["weight_map"]
    info, plan, problems = plan_merge(adir, weight_map)
    if problems:
        raise KeyError("; ".join(problems[:5]) + (f" (+{len(problems) - 5} more)" if len(problems) > 5 else ""))
    key_of = {}
    for k in info["keys"]:
        key_of.setdefault(module_name(k), {})["A" if ".lora_A" in k else "B"] = k
    by_shard = {}
    for m, target in plan.items():
        by_shard.setdefault(weight_map[target], []).append((m, target))

    odir.mkdir(parents=True, exist_ok=True)
    report = {"adapter": str(adir), "r": info["r"], "lora_alpha": info["lora_alpha"], "scaling": info["scaling"],
              "modules": len(plan), "shards_patched": len(by_shard), "tensors": {}, "copied": [],
              "started": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    t0 = time.time()
    with safe_open(str(adir / "adapter_model.safetensors"), "pt") as af:
        for shard, items in sorted(by_shard.items()):
            src, dst = base_dir / shard, odir / shard
            if dst.exists() and not force and dst.stat().st_size == src.stat().st_size \
                    and (odir / f".{shard}.done").exists():
                log(f"skip {shard} (done)")
                continue
            targets = {t: m for m, t in items}
            tensors = {}
            with safe_open(str(src), "pt") as sf:
                meta = sf.metadata()
                for k in sf.keys():
                    w = sf.get_tensor(k)
                    if k in targets:
                        ks = key_of[targets[k]]
                        A = af.get_tensor(ks["A"]).to(torch.float32)
                        B = af.get_tensor(ks["B"]).to(torch.float32)
                        if w.dtype != torch.bfloat16:
                            raise TypeError(f"{k} is {w.dtype}, expected bfloat16")
                        delta = info["scaling"] * (B @ A)
                        if tuple(delta.shape) != tuple(w.shape):
                            raise ValueError(f"{k}: delta {tuple(delta.shape)} vs weight {tuple(w.shape)}")
                        w32 = w.to(torch.float32)
                        merged = (w32 + delta).to(torch.bfloat16)
                        report["tensors"][k] = {"shape": list(w.shape),
                                                "rel_delta": (delta.norm() / w32.norm()).item(),
                                                "frac_elements_changed": (merged != w).float().mean().item()}
                        w = merged
                    tensors[k] = w.contiguous()
            tmp = dst.with_name(dst.name + ".tmp")
            save_file(tensors, str(tmp), metadata=meta)
            os.replace(tmp, dst)
            (odir / f".{shard}.done").touch()
            del tensors
            log(f"patched {shard}: {len(items)} tensors, {dst.stat().st_size / 1e9:.2f} GB, {time.time() - t0:.0f}s")
            commit()
    for src in sorted(base_dir.rglob("*")):
        rel = src.relative_to(base_dir)
        if src.is_dir() or rel.parts[0] == ".cache" or (src.name.startswith(".") and src.name != ".gitattributes"):
            continue
        if str(rel) in by_shard:
            continue
        dst = odir / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if dst.exists() and dst.stat().st_size == src.stat().st_size and not force:
            continue
        shutil.copyfile(src, dst)
        report["copied"].append(str(rel))
    mismatched = {str(p.relative_to(base_dir)): ((odir / p.relative_to(base_dir)).stat().st_size, p.stat().st_size)
                  for p in base_dir.rglob("*.safetensors")
                  if (odir / p.relative_to(base_dir)).stat().st_size != p.stat().st_size}
    for marker in odir.glob(".*.done"):
        marker.unlink()
    report.update({"size_mismatches": mismatched, "seconds": round(time.time() - t0, 1),
                   "finished": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
    (odir / "MERGE_REPORT.json").write_text(json.dumps(report, indent=1))
    commit()
    if mismatched:
        raise RuntimeError(f"{len(mismatched)} shards changed size: {list(mismatched)[:3]}")
    return report


def summarize(report):
    s = {k: v for k, v in report.items() if k not in ("tensors", "copied")}
    rel = sorted(t["rel_delta"] for t in report["tensors"].values())
    s["rel_delta_min_median_max"] = [rel[0], rel[len(rel) // 2], rel[-1]] if rel else None
    s["files_copied"] = len(report["copied"])
    return s


# ---------------------------------------------------------------- selftest
def selftest():
    import torch
    from safetensors.torch import load_file, save_file
    torch.manual_seed(0)
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        base, adapter, out = tmp / "base", tmp / "adapter", tmp / "merged"
        base.mkdir(); adapter.mkdir()
        shard1 = {"model.llm.layers.0.attn.wq_du.weight": torch.randn(8, 6).to(torch.bfloat16),
                  "model.llm.layers.0.mlp.experts.w1.weight": torch.randint(0, 255, (16, 3), dtype=torch.uint8),
                  "model.llm.layers.0.mlp.experts.w1.weight_scale": torch.randn(16, 1).to(torch.float8_e4m3fn)}
        shard2 = {"model.llm.layers.1.attn.wo_ud.weight": torch.randn(6, 8).to(torch.bfloat16),
                  "model.llm.unembed.weight": torch.randn(10, 6).to(torch.bfloat16),
                  "model.llm.embed.weight": torch.randn(10, 6).to(torch.bfloat16)}
        save_file(shard1, str(base / "model-00001-of-00002.safetensors"), metadata={"format": "pt"})
        save_file(shard2, str(base / "model-00002-of-00002.safetensors"), metadata={"format": "pt"})
        wm = {k: "model-00001-of-00002.safetensors" for k in shard1}
        wm.update({k: "model-00002-of-00002.safetensors" for k in shard2})
        (base / "model.safetensors.index.json").write_text(json.dumps({"metadata": {}, "weight_map": wm}))
        (base / "config.json").write_text('{"model_type": "inkling2"}')
        r, alpha = 4, 8.0
        lora = {}
        for mod, (o, i) in {"language_model.layers.0.attn.wq_du": (8, 6), "language_model.layers.1.attn.wo_ud": (6, 8),
                            "language_model.lm_head": (10, 6)}.items():
            lora[f"{mod}.lora_A.weight"] = torch.randn(r, i) * 0.1
            lora[f"{mod}.lora_B.weight"] = torch.randn(o, r) * 0.1
        save_file(lora, str(adapter / "adapter_model.safetensors"))
        (adapter / "adapter_config.json").write_text(json.dumps({"r": r, "lora_alpha": alpha}))

        report = merge_checkpoint(base, adapter, out, log=lambda *_: None)
        m1 = load_file(str(out / "model-00001-of-00002.safetensors"))
        m2 = load_file(str(out / "model-00002-of-00002.safetensors"))
        merged = {**m1, **m2}
        targets = {"model.llm.layers.0.attn.wq_du.weight": "language_model.layers.0.attn.wq_du",
                   "model.llm.layers.1.attn.wo_ud.weight": "language_model.layers.1.attn.wo_ud",
                   "model.llm.unembed.weight": "language_model.lm_head"}
        src = {**shard1, **shard2}
        for k, mod in targets.items():
            want = (src[k].float() + (alpha / r) * (lora[f"{mod}.lora_B.weight"] @ lora[f"{mod}.lora_A.weight"])).to(torch.bfloat16)
            assert merged[k].dtype == torch.bfloat16 and torch.equal(merged[k], want), k
            assert not torch.equal(merged[k], src[k]), f"{k} unchanged"
        for k in set(src) - set(targets):
            assert merged[k].dtype == src[k].dtype and torch.equal(merged[k].view(torch.uint8), src[k].view(torch.uint8)), k
        for name in ("model-00001-of-00002.safetensors", "model-00002-of-00002.safetensors"):
            assert (out / name).stat().st_size == (base / name).stat().st_size, name
        assert (out / "config.json").read_bytes() == (base / "config.json").read_bytes()
        assert not report["size_mismatches"] and report["modules"] == 3

        lora["language_model.layers.0.mlp.experts.w1.lora_A.weight"] = torch.randn(r, 3)
        lora["language_model.layers.0.mlp.experts.w1.lora_B.weight"] = torch.randn(16, r)
        save_file(lora, str(adapter / "adapter_model.safetensors"))
        try:
            merge_checkpoint(base, adapter, tmp / "refused", log=lambda *_: None)
        except KeyError as e:
            assert "NVFP4" in str(e)
        else:
            raise AssertionError("an expert adapter must be refused")
    print("SELFTEST OK: exact bf16(fp32(W) + (alpha/r)·B@A) on 3 BF16 targets; expert, scale and embedding "
          "tensors byte-identical; shard sizes identical; expert LoRA refused")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("check")
    p.add_argument("--adapter-dir", type=Path, required=True)
    p.add_argument("--base-index", type=Path, help="model.safetensors.index.json of the base (download it alone first)")
    p = sub.add_parser("merge")
    p.add_argument("--base-dir", type=Path, required=True)
    p.add_argument("--adapter-dir", type=Path, required=True)
    p.add_argument("--out-dir", type=Path, required=True)
    p.add_argument("--force", action="store_true", help="redo shards that already exist")
    sub.add_parser("selftest")
    args = ap.parse_args()
    if args.cmd == "selftest":
        selftest()
    elif args.cmd == "check":
        wm = json.loads(args.base_index.read_text())["weight_map"] if args.base_index else None
        info, plan, problems = plan_merge(args.adapter_dir, wm)
        print(json.dumps({"r": info["r"], "lora_alpha": info["lora_alpha"], "scaling": info["scaling"],
                          "modules": len(info["modules"]), "mergeable_exactly": len(plan),
                          "problems": problems[:10], "n_problems": len(problems)}, indent=1))
        sys.exit(1 if problems else 0)
    else:
        if args.out_dir.resolve() == args.base_dir.resolve():
            sys.exit("--out-dir must differ from --base-dir")
        report = merge_checkpoint(args.base_dir, args.adapter_dir, args.out_dir, force=args.force)
        print(json.dumps(summarize(report), indent=1))


if __name__ == "__main__":
    main()
