#!/usr/bin/env python3
"""Optional: run the merge, the Hub upload and a scale-to-zero SGLang server on Modal.

You need ~790 GB of fast disk for the base and the merged copy, a fat pipe to the Hub,
and 2-8 large GPUs to serve. If you have none of those, this is the route we used for
our release: everything happens inside Modal, next to the data.

Setup (once):
  pip install modal && modal setup
  modal secret create huggingface HF_TOKEN=<token with write access>
  tinker checkpoint download tinker://<run-id>:train:0/weights/final -o ./adapters
  modal volume create inkling2-merge --version 2
  modal volume put inkling2-merge ./adapters/<dir> adapters/my-adapter

Stages (run each detached, in order):
  modal run --detach modal_app.py::download_base            # ~394 GB; 24 min at ~270 MB/s for us
  modal run --detach modal_app.py::merge --adapter my-adapter --out my-model     # ~8 min
  modal run --detach modal_app.py::upload --src my-model --repo you/my-model   # private by default
  modal deploy modal_app.py                                  # the server; serves merged/$INKLING2_SERVE_SRC

Configuration by environment variable at deploy/run time:
  INKLING2_VOLUME (inkling2-merge), INKLING2_HF_SECRET (huggingface),
  INKLING2_BASE_REVISION (pin a commit of the base repo),
  INKLING2_SERVE_SRC (merged/<name> to serve), INKLING2_SERVE_NAME (model name clients send),
  INKLING2_SERVE_GPU (B300:2; B200:4 and H200:8 also fit), INKLING2_CONTEXT (1048576, the full window),
  INKLING2_DSPARK (1 = bundled DSpark speculative decoding on), INKLING2_SCALEDOWN (600 s).

The server is OpenAI-compatible at https://<workspace>--<app>-serve.modal.run/v1 and
scales to zero; a cold start loads ~394 GB (4-5 min) and captures CUDA graphs (~6 min)
after GPU capacity is found, which for B300 took us up to half an hour. Warm it with
GET /health before a run.
"""
import json
import os
import shutil
import subprocess
import time
from pathlib import Path

import modal

APP = os.environ.get("INKLING2_APP", "inkling2-merge")
VOLUME = os.environ.get("INKLING2_VOLUME", "inkling2-merge")
HF_SECRET = os.environ.get("INKLING2_HF_SECRET", "huggingface")
BASE_REPO = "thinkingmachines/Inkling-2-Small"
BASE_DIR = "/vol/base/Inkling-2-Small"
SGLANG_IMAGE = os.environ.get("INKLING2_SGLANG_IMAGE", "lmsysorg/sglang:dev-inkling-2-small")
SERVE_SRC = os.environ.get("INKLING2_SERVE_SRC", "my-model")
SERVE_NAME = os.environ.get("INKLING2_SERVE_NAME", SERVE_SRC)
SERVE_GPU = os.environ.get("INKLING2_SERVE_GPU", "B300:2")
SERVE_TP = int(SERVE_GPU.split(":")[1]) if ":" in SERVE_GPU else 1
SERVE_CONTEXT = int(os.environ.get("INKLING2_CONTEXT", "1048576"))
SERVE_DSPARK = os.environ.get("INKLING2_DSPARK", "1") == "1"
SERVE_SCALEDOWN = int(os.environ.get("INKLING2_SCALEDOWN", "600"))
PORT = 30000

app = modal.App(APP)
vol = modal.Volume.from_name(VOLUME, create_if_missing=True, version=2)
image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("huggingface_hub[hf_xet]>=1.0", "safetensors>=0.5", "numpy")
    .pip_install("torch", extra_index_url="https://download.pytorch.org/whl/cpu")
    .env({"HF_XET_HIGH_PERFORMANCE": "1"})
    .add_local_python_source("merge_lossless")
)
sglang_image = modal.Image.from_registry(SGLANG_IMAGE)
secrets = [modal.Secret.from_name(HF_SECRET)]


@app.function(image=image, volumes={"/vol": vol}, cpu=16, memory=32768, timeout=24 * 3600, secrets=secrets)
def download_base(revision: str = os.environ.get("INKLING2_BASE_REVISION", "")):
    """Snapshot the base repo into the volume; record the commit and verify file sizes."""
    from huggingface_hub import HfApi, snapshot_download
    info = HfApi().model_info(BASE_REPO, revision=revision or None, files_metadata=True)
    expected = {s.rfilename: s.size for s in info.siblings}
    t0 = time.time()
    snapshot_download(BASE_REPO, revision=info.sha, local_dir=BASE_DIR, max_workers=16)
    sizes = {n: os.path.getsize(os.path.join(BASE_DIR, n)) for n in expected}
    bad = {n: (sizes[n], expected[n]) for n in expected if expected[n] is not None and sizes[n] != expected[n]}
    report = {"repo": BASE_REPO, "sha": info.sha, "files": len(sizes), "bytes": sum(sizes.values()),
              "seconds": round(time.time() - t0), "size_mismatches": bad}
    Path("/vol/base/MANIFEST.json").write_text(json.dumps(report, indent=1))
    vol.commit()
    print(json.dumps(report, indent=1))
    if bad:
        raise SystemExit(f"{len(bad)} files have unexpected sizes")


@app.function(image=image, volumes={"/vol": vol}, cpu=16, memory=98304, timeout=24 * 3600)
def merge(adapter: str, out: str, force: bool = False):
    """Exact merge of adapters/<adapter> into a copy of the base at merged/<out>."""
    from merge_lossless import merge_checkpoint, summarize
    report = merge_checkpoint(BASE_DIR, Path("/vol/adapters") / adapter, Path("/vol/merged") / out,
                              force=force, commit=vol.commit, log=lambda m: print(m, flush=True))
    print(json.dumps(summarize(report), indent=1))


@app.function(image=image, volumes={"/vol": vol}, cpu=16, memory=32768, timeout=24 * 3600, secrets=secrets)
def upload(src: str, repo: str, public: bool = False):
    """Upload merged/<src> to the Hub. Xet dedups chunks shared with the base repo, so only
    the patched tensors travel: 394 GB went up in about 5 minutes for us."""
    from huggingface_hub import HfApi
    api = HfApi()
    folder = Path("/vol/merged") / src
    api.create_repo(repo, repo_type="model", private=not public, exist_ok=True)
    t0 = time.time()
    api.upload_folder(repo_id=repo, folder_path=str(folder), repo_type="model",
                      ignore_patterns=["MERGE_REPORT.json", ".cache/*", ".*.done"],
                      commit_message="Inkling 2 Small with a LoRA merged exactly into the BF16 attention and unembedding")
    print(json.dumps({"repo": repo, "seconds": round(time.time() - t0), "private": not public}, indent=1))


def serve_command():
    launcher = ["sglang", "serve"] if shutil.which("sglang") else ["python3", "-m", "sglang.launch_server"]
    cmd = launcher + ["--model-path", f"/vol/merged/{SERVE_SRC}",
           "--served-model-name", SERVE_NAME, "--tp", str(SERVE_TP), "--ep", str(SERVE_TP),
           "--attention-backend", "fa4", "--bf16-gemm-backend", "torch", "--dtype", "bfloat16",
           "--page-size", "128", "--grammar-backend", "xgrammar", "--reasoning-parser", "inkling",
           "--tool-call-parser", "inkling2", "--context-length", str(SERVE_CONTEXT),
           "--host", "0.0.0.0", "--port", str(PORT)]
    if SERVE_DSPARK:
        # Roughly 2x per-stream decode, but the draft and its graphs shrink the KV-cache
        # pool: size the number of concurrent long sessions to what is left.
        cmd += ["--speculative-algorithm", "DSPARK", "--max-running-requests", "64"]
    return cmd


@app.function(image=sglang_image, volumes={"/vol": vol}, gpu=SERVE_GPU, timeout=3600,
              scaledown_window=SERVE_SCALEDOWN, max_containers=1, min_containers=0)
@modal.concurrent(max_inputs=64)
@modal.web_server(port=PORT, startup_timeout=3600)
def serve():
    cmd = serve_command()
    print("launch:", " ".join(cmd), flush=True)
    subprocess.Popen(cmd)
