"""Summarize every tensor in a checkpoint without running the network.

For each tensor: shape, dtype, statistics, and the fraction of zeros. For 2D
tensors also: the largest row and column norms, the top singular values, the
effective rank, and optionally the absolute mass per contiguous input group
(for example per input channel of a flattened grid).
"""

import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "common"))
import weights_io  # noqa: E402


def summarize(name, array, args):
    if not (np.issubdtype(array.dtype, np.number) or array.dtype == np.bool_):
        return {"name": name, "shape": list(array.shape), "dtype": str(array.dtype), "count": 0,
                "value": array.ravel()[:1].tolist()}
    values = array.astype(np.float64)
    entry = {
        "name": name,
        "shape": list(array.shape),
        "dtype": str(array.dtype),
        "count": int(array.size),
        "mean": float(values.mean()) if array.size else 0.0,
        "std": float(values.std()) if array.size else 0.0,
        "min": float(values.min()) if array.size else 0.0,
        "max": float(values.max()) if array.size else 0.0,
        "zero_fraction": float(np.mean(values == 0)) if array.size else 0.0,
        "frobenius": float(np.linalg.norm(values)),
    }
    if values.ndim != 2 or values.size == 0:
        return entry

    matrix = values if args.layout == "out_in" else values.T
    row_norms = np.linalg.norm(matrix, axis=1)
    col_norms = np.linalg.norm(matrix, axis=0)
    top = args.top
    entry["top_output_units"] = [[int(i), float(row_norms[i])] for i in np.argsort(-row_norms)[:top]]
    entry["top_input_units"] = [[int(i), float(col_norms[i])] for i in np.argsort(-col_norms)[:top]]

    if args.svd and min(matrix.shape) <= args.max_svd_dim:
        singular = np.linalg.svd(matrix, compute_uv=False)
        energy = singular**2 / max(float((singular**2).sum()), 1e-12)
        entry["singular_values"] = [float(s) for s in singular[: args.svd]]
        entry["top_singular_energy"] = float(energy[: args.svd].sum())
        probabilities = energy[energy > 0]
        entry["effective_rank"] = float(np.exp(-(probabilities * np.log(probabilities)).sum()))

    if args.input_groups and matrix.shape[1] % args.input_groups == 0:
        groups = np.abs(matrix).reshape(matrix.shape[0], args.input_groups, -1).sum(axis=(0, 2))
        share = groups / max(float(groups.sum()), 1e-12)
        entry["input_group_mass"] = [float(s) for s in share]
    return entry


def print_entry(entry):
    print(f"{entry['name']}  shape={entry['shape']}  dtype={entry['dtype']}  n={entry['count']}")
    if "value" in entry:
        print(f"  non-numeric: {entry['value']}")
        return
    print(
        f"  mean={entry['mean']:.4g} std={entry['std']:.4g} min={entry['min']:.4g} "
        f"max={entry['max']:.4g} zeros={entry['zero_fraction']:.2%} fro={entry['frobenius']:.4g}"
    )
    if "top_output_units" in entry:
        print("  top output units (index, norm): " + ", ".join(f"{i}:{n:.3g}" for i, n in entry["top_output_units"]))
        print("  top input units (index, norm):  " + ", ".join(f"{i}:{n:.3g}" for i, n in entry["top_input_units"]))
    if "singular_values" in entry:
        values = ", ".join(f"{s:.3g}" for s in entry["singular_values"])
        print(f"  singular values: {values}")
        print(f"  top-k energy={entry['top_singular_energy']:.2%} effective rank={entry['effective_rank']:.1f}")
    if "input_group_mass" in entry:
        print("  input group mass: " + ", ".join(f"g{i}={s:.1%}" for i, s in enumerate(entry["input_group_mass"])))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("weights", help="Checkpoint: .npz, .npy, .safetensors, .pt, or .pth")
    parser.add_argument("--tensor", default=None, help="Regular expression; only matching tensor names are shown")
    parser.add_argument("--layout", choices=["out_in", "in_out"], default="out_in",
                        help="Weight matrix layout: out_in as in PyTorch Linear (default), in_out as in JAX or numpy")
    parser.add_argument("--top", type=int, default=5, help="Number of largest row and column norms to list (default 5)")
    parser.add_argument("--svd", type=int, default=0, help="Number of singular values to list; 0 skips SVD (default 0)")
    parser.add_argument("--max-svd-dim", type=int, default=4096,
                        help="Skip SVD when the smaller matrix side is larger than this (default 4096)")
    parser.add_argument("--input-groups", type=int, default=0,
                        help="Split the input dimension into N equal contiguous groups and report the share of mass per group")
    parser.add_argument("--json", action="store_true", help="Print JSON instead of text")
    args = parser.parse_args()

    tensors = weights_io.load(args.weights)
    pattern = re.compile(args.tensor) if args.tensor else None
    entries = [summarize(name, array, args) for name, array in tensors.items() if not pattern or pattern.search(name)]
    if args.json:
        print(json.dumps({"weights": args.weights, "tensors": entries}, indent=2))
        return
    total = sum(entry["count"] for entry in entries)
    print(f"{args.weights}: {len(entries)} tensors, {total} values")
    for entry in entries:
        print_entry(entry)


if __name__ == "__main__":
    main()
