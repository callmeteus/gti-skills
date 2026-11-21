#!/usr/bin/env python3
"""Step 4: LoRA SFT of Inkling 2 Small on Tinker. Default is an OFFLINE smoke test;
nothing talks to the service (or costs money) unless --train is given.

The smoke test verifies the dataset report (provenance and sha256 of both splits),
renders every row, prints the decoded head of the first row (read it), the resolved
configuration, steps, tokens and the estimated training cost.

Adapter presets (references/adapter-shape.md):
  --adapter release   rank 32, attention projections + unembedding, experts frozen.
                      Merges EXACTLY into the released NVFP4/MXFP8 checkpoint
                      (merge/merge_lossless.py). The default.
  --adapter full      rank 8, all linear layers including the experts. Lower NLL,
                      but the expert LoRA cannot be merged into 4-bit experts without
                      requantizing: serve it on Tinker.
Any preset field can be overridden (--lora-rank, --train-mlp/--no-train-mlp, ...).

Defaults are the recipe that shipped Tess-4.5-594B-A17B: LR 1e-4 (Tinker's get_lr has
no calibration for Inkling), batch 8 rows, 1 epoch, linear decay, eval and checkpoint
every 20 steps, W&B on.

Examples:
  python train.py --dataset my-run                   # offline smoke test
  python train.py --dataset my-run --train           # launch (asks nothing; confirm cost first)
  python train.py --dataset my-run --train --learning-rate 3e-4 --log-dir my-run-lr3e-4
  python train.py --dataset my-run --adapter full --train

A bare --dataset name resolves to ~/.gti/llm-fine-tuning/<project>/datasets/<name>, and
runs go to ~/.gti/llm-fine-tuning/<project>/runs/ (a bare --log-dir name too).
"""
import argparse
import asyncio
import json
import os
import random
import sys
import time
from pathlib import Path

import chz
from tinker_cookbook.supervised.types import SupervisedDataset, SupervisedDatasetBuilder

sys.path.insert(0, str(Path(__file__).resolve().parent))
from inkling2 import (ADAPTERS, CONTEXT_CAP, TRAIN_PRICE, Renderer, dataset_paths, load_dotenv,  # noqa: E402
                      sha256_file, work_dir, work_path)

load_dotenv()


def load_report(prefix):
    paths = dataset_paths(prefix)
    if not paths["report"].exists():
        sys.exit(f"{paths['report']} not found; run prepare_dataset.py first")
    return paths, json.loads(paths["report"].read_text())


def verify_build(renderer, prefix):
    """Fail before any service call if the data or the rendering changed since the build."""
    paths, report = load_report(prefix)
    if report["template_provenance"] != renderer.provenance:
        sys.exit("dataset was rendered with\n  " + json.dumps(report["template_provenance"]) +
                 "\nlive rendering is\n  " + json.dumps(renderer.provenance) +
                 "\nRebuild the dataset with prepare_dataset.py in this environment.")
    for split in ("train", "val"):
        if sha256_file(paths[split]) != report["files_sha256"][split]:
            sys.exit(f"{paths[split]} changed since the build; rebuild the dataset")
    if report["train_val_group_overlap"]:
        sys.exit(f"groups in both splits: {report['train_val_group_overlap'][:5]}")
    return report


class JsonlDataset(SupervisedDataset):
    def __init__(self, path, split, batch_size, renderer, max_len):
        self.path, self.split, self.batch_size, self.renderer, self.max_len = Path(path), split, batch_size, renderer, max_len
        self.offsets = []
        with self.path.open("rb") as f:
            while True:
                offset = f.tell()
                if not f.readline():
                    break
                self.offsets.append(offset)
        self.order = list(range(len(self.offsets)))

    def __len__(self):
        return (len(self.order) + self.batch_size - 1) // self.batch_size

    def set_epoch(self, seed=0):
        # Rows of one session are adjacent in the file; shuffle so a batch is not
        # eight windows of the same session.
        self.order = list(range(len(self.offsets)))
        if self.split == "train":
            random.Random(seed).shuffle(self.order)

    def rows(self, index):
        with self.path.open("rb") as f:
            for row in self.order[index * self.batch_size:(index + 1) * self.batch_size]:
                f.seek(self.offsets[row])
                line = json.loads(f.readline())
                yield line["messages"], line["tools"]

    def get_batch(self, index):
        if index < 0 or index >= len(self):
            raise IndexError(index)
        return [self.renderer.datum(m, self.max_len, tools=t) for m, t in self.rows(index)]


@chz.chz
class Builder(SupervisedDatasetBuilder):
    dataset: str
    batch_size: int = 8
    effort: float = 0.9
    model_name: str = "thinkingmachines/Inkling-2-Small"

    def __call__(self):
        renderer = Renderer(model_name=self.model_name, effort=self.effort)
        report = verify_build(renderer, self.dataset)
        paths = dataset_paths(self.dataset)
        max_len = report["max_len"]
        return (JsonlDataset(paths["train"], "train", self.batch_size, renderer, max_len),
                JsonlDataset(paths["val"], "val", self.batch_size, renderer, max_len))


def head_of(text, head=700, tail=700, user=300):
    """The prompt prefix up to the first user turn: its start (system prompt), its end
    (tool declaration and the 'Thinking effort level' line), then the first user turn."""
    k = text.find("<|message_user|>")
    if k < 0:
        return text[:head + tail]
    prefix = text[:k]
    if len(prefix) > head + tail:
        prefix = prefix[:head] + f"\n[... {len(prefix) - head - tail:,} characters ...]\n" + prefix[-tail:]
    return prefix + text[k:k + user]


def smoke_test(builder, hp, report):
    train_ds, val_ds = builder()
    renderer, stats, sample = train_ds.renderer, {}, None
    for ds in (train_ds, val_ds):
        ds.set_epoch(0)
        lengths, loss = [], 0
        for b in range(len(ds)):
            for messages, tools in ds.rows(b):
                ids, mask = renderer.render(messages, tools=tools)
                assert len(ids) <= report["max_len"] and sum(mask[1:]) > 0, (ds.split, b, len(ids))
                lengths.append(len(ids))
                loss += sum(mask[1:])
                if sample is None:
                    sample = head_of(renderer.tokenizer.decode(ids[:40000]))
        first = [d.model_input.length for d in ds.get_batch(0)]  # exercise the Datum path
        stats[ds.split] = {"rows": len(lengths), "batches": len(ds), "tokens": sum(lengths),
                           "loss_tokens": loss, "max_row": max(lengths), "first_batch_lengths": first}
    steps = stats["train"]["batches"] * hp["epochs"]
    train_tokens = stats["train"]["tokens"] * hp["epochs"]
    print("---- decoded head of the first train row (read it: system prompt, tool declaration, effort line, user turn) ----")
    print(sample)
    print("---- resolved configuration ----")
    print(json.dumps({"model": builder.model_name, "rendering": renderer.provenance, **hp,
                      "steps_per_epoch": stats["train"]["batches"], "total_steps": steps,
                      "evals": steps // hp["eval_every"], "val_tokens_per_eval": stats["val"]["tokens"],
                      "train_tokens_all_epochs": train_tokens,
                      "estimated_train_cost_usd": round(train_tokens / 1e6 * TRAIN_PRICE[builder.model_name], 2),
                      "train": stats["train"], "val": stats["val"], "offline": True}, indent=1))
    if steps < 50:
        print(f"NOTE: only {steps} optimizer steps. Consider more data, a second epoch or a smaller batch.")
    print("SMOKE TEST OK. Show the user the estimated cost before running with --train.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dataset", required=True, help="dataset name (my-run) or path prefix")
    ap.add_argument("--adapter", choices=sorted(ADAPTERS), default="release")
    ap.add_argument("--lora-rank", type=int)
    ap.add_argument("--train-attn", action=argparse.BooleanOptionalAction, default=None)
    ap.add_argument("--train-mlp", action=argparse.BooleanOptionalAction, default=None,
                    help="LoRA on the MoE experts (on in --adapter full; breaks the exact merge)")
    ap.add_argument("--train-unembed", action=argparse.BooleanOptionalAction, default=None)
    ap.add_argument("--learning-rate", type=float, default=1e-4)
    ap.add_argument("--lr-schedule", choices=["constant", "linear"], default="linear")
    ap.add_argument("--epochs", type=int, default=1)
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--eval-every", type=int, default=20)
    ap.add_argument("--save-every", type=int, default=20)
    ap.add_argument("--wandb-project", default="inkling2-sft")
    ap.add_argument("--no-wandb", action="store_true")
    ap.add_argument("--log-dir", type=Path, help="new run directory (default: <work folder>/runs/<dataset>-<hyperparameters>)")
    ap.add_argument("--train", action="store_true", help="start the Tinker job (default: offline smoke test)")
    args = ap.parse_args()

    _, report = load_report(args.dataset)
    model = report["model"]
    if model not in CONTEXT_CAP:
        sys.exit(f"dataset report names model {model!r}; expected one of {sorted(CONTEXT_CAP)}")
    preset = dict(ADAPTERS[args.adapter])
    for key in ("lora_rank", "train_attn", "train_mlp", "train_unembed"):
        if getattr(args, key) is not None:
            preset[key] = getattr(args, key)
    if not (preset["train_attn"] or preset["train_mlp"] or preset["train_unembed"]):
        ap.error("at least one of attn/mlp/unembed must be trained")
    if args.learning_rate <= 0 or preset["lora_rank"] < 1 or args.epochs < 1 or args.batch_size < 1:
        ap.error("invalid hyperparameter")
    modules = [k for k in ("attn", "mlp", "unembed") if preset[f"train_{k}"]]
    hp = {"adapter": args.adapter, "lora_rank": preset["lora_rank"], "lora_modules": modules,
          "mergeable_into_release_checkpoint": not preset["train_mlp"],
          "learning_rate": args.learning_rate, "lr_schedule": args.lr_schedule, "epochs": args.epochs,
          "batch_size": args.batch_size, "effort": report["effort"], "eval_every": args.eval_every,
          "save_every": args.save_every}
    builder = Builder(dataset=str(args.dataset), batch_size=args.batch_size, effort=report["effort"], model_name=model)
    if not args.train:
        smoke_test(builder, hp, report)
        return

    name = Path(args.dataset).name
    tag = (f"{name}-r{preset['lora_rank']}-{'+'.join(modules)}-lr{args.learning_rate:g}-{args.lr_schedule}"
           f"-e{args.epochs}-b{args.batch_size}")
    log_dir = work_path(args.log_dir, "runs") if args.log_dir else work_dir("runs") / tag
    if log_dir.exists():
        ap.error(f"{log_dir} exists; choose a new --log-dir")
    if not os.environ.get("TINKER_API_KEY"):
        ap.error("TINKER_API_KEY is not set (put it in .env)")
    wandb_project = None if args.no_wandb else args.wandb_project
    if wandb_project and not os.environ.get("WANDB_API_KEY"):
        ap.error("WANDB_API_KEY is not set (put it in .env, or pass --no-wandb)")
    train_ds, _ = builder()  # verifies provenance and checksums before any service client exists

    import tinker
    from tinker_cookbook.supervised import train
    # train.Config has no LoRA module switches; pass them through the SDK call the cookbook makes.
    _create = tinker.ServiceClient.create_lora_training_client

    def _create_with_modules(self, base_model, rank=32, **kw):
        kw.update(train_attn=preset["train_attn"], train_mlp=preset["train_mlp"],
                  train_unembed=preset["train_unembed"])
        return _create(self, base_model, rank=rank, **kw)
    tinker.ServiceClient.create_lora_training_client = _create_with_modules
    # The cookbook logs a full colorized example each step (~50K tokens of text); keep a one-liner.
    train.colorize_example = lambda datum, *a, **k: f"[example: {datum.model_input.length} tokens]"
    config = train.Config(
        model_name=model, log_path=str(log_dir), dataset_builder=builder,
        recipe_name="finetune_inkling_2_small",
        renderer_name=train_ds.renderer.renderer_name,
        learning_rate=args.learning_rate, lr_schedule=args.lr_schedule,
        num_epochs=args.epochs, lora_rank=preset["lora_rank"],
        eval_every=args.eval_every, save_every=args.save_every,
        wandb_project=wandb_project,
        wandb_name=f"{tag}-{time.strftime('%Y%m%d-%H%M%S')}",
    )
    print(json.dumps({"model": config.model_name, "renderer_name": config.renderer_name,
                      "rendering": train_ds.renderer.provenance, "log_path": config.log_path, **hp,
                      "steps_per_epoch": len(train_ds), "wandb_project": config.wandb_project,
                      "wandb_name": config.wandb_name}, indent=1))
    asyncio.run(train.main(config))


if __name__ == "__main__":
    main()
