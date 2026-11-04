"""Create a zero-initialized MLP and run budgeted forward passes on it.

Tensors are named layers.<i>.weight with shape [out, in] and layers.<i>.bias
with shape [out], as in PyTorch nn.Linear. The layer sizes and activations
are stored in the checkpoint under the key "spec" as a JSON string array.

Commands:
  init     write an all-zero MLP for the given sizes and activations
  forward  run inputs from a .npy file through the MLP and save the outputs;
           every call spends one forward pass from the ledger first
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "common"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "budget"))
import weights_io  # noqa: E402

ACTIVATIONS = {
    "relu": lambda x: np.maximum(x, 0.0),
    "tanh": np.tanh,
    "sigmoid": lambda x: 1.0 / (1.0 + np.exp(-x)),
    "none": lambda x: x,
}


def zeros(sizes, activations):
    if len(activations) != len(sizes) - 1:
        raise SystemExit(f"{len(sizes) - 1} layers need {len(sizes) - 1} activations, got {len(activations)}")
    for name in activations:
        if name not in ACTIVATIONS:
            raise SystemExit(f"unknown activation {name}; use one of {', '.join(ACTIVATIONS)}")
    tensors = {}
    for i, (fan_in, fan_out) in enumerate(zip(sizes[:-1], sizes[1:])):
        tensors[f"layers.{i}.weight"] = np.zeros((fan_out, fan_in), dtype=np.float32)
        tensors[f"layers.{i}.bias"] = np.zeros(fan_out, dtype=np.float32)
    tensors["spec"] = np.array([json.dumps({"sizes": sizes, "activations": activations})])
    return tensors


def forward(tensors, inputs):
    spec = json.loads(str(tensors["spec"][0]))
    hidden = inputs.astype(np.float64)
    for i, name in enumerate(spec["activations"]):
        hidden = hidden @ tensors[f"layers.{i}.weight"].astype(np.float64).T + tensors[f"layers.{i}.bias"]
        hidden = ACTIVATIONS[name](hidden)
    return hidden


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)

    init = commands.add_parser("init", help="Write an all-zero MLP")
    init.add_argument("--sizes", required=True, help="Comma separated layer sizes, for example 600,32,32,6")
    init.add_argument("--activations", required=True, help="One per layer, for example tanh,tanh,none")
    init.add_argument("--out", required=True, help="Output .npz file")

    run = commands.add_parser("forward", help="Run a budgeted forward pass")
    run.add_argument("--weights", required=True, help="MLP .npz file created by init")
    run.add_argument("--inputs", required=True, help=".npy file of shape [batch, in]")
    run.add_argument("--out", required=True, help=".npy file for the outputs")
    run.add_argument("--ledger", required=True, help="Ledger to spend one forward pass from")
    run.add_argument("--note", default="", help="Why this pass is spent")
    args = parser.parse_args()

    if args.command == "init":
        sizes = [int(value) for value in args.sizes.split(",")]
        activations = [value.strip() for value in args.activations.split(",")]
        weights_io.save(args.out, zeros(sizes, activations))
        count = sum(a * b + b for a, b in zip(sizes[:-1], sizes[1:]))
        print(f"wrote zero MLP {sizes} with {count} weights to {args.out}")
        return

    import ledger
    remaining = ledger.spend(args.ledger, 1, args.note or f"mlp forward on {args.inputs}")
    outputs = forward(weights_io.load(args.weights), np.load(args.inputs, allow_pickle=False))
    np.save(args.out, outputs)
    print(f"outputs {list(outputs.shape)} saved to {args.out}; {remaining} forward passes left")


if __name__ == "__main__":
    main()
