"""Project a direction out of one tensor and save the result to a new file.

The direction lives in the space indexed by --space-axis. For a PyTorch MLP
down projection of shape [d_model, d_ff] that writes into the residual
stream, a residual direction of length d_model lives on axis 0, and each of
the d_ff columns is one vector written into the residual stream.

For each selected vector w: w <- w - scale * (u . w) u, with u normalized.
By default every vector is edited; --top selects only the vectors with the
largest |u . w|, which keeps the edit small.
"""

import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "common"))
import weights_io  # noqa: E402


def ablate(matrix, direction, space_axis, top, scale):
    vectors = matrix.astype(np.float64)
    if space_axis == 1:
        vectors = vectors.T
    if vectors.shape[0] != direction.size:
        raise SystemExit(f"direction has length {direction.size}, axis {space_axis} has length {vectors.shape[0]}")
    unit = direction.astype(np.float64).ravel()
    norm = np.linalg.norm(unit)
    if norm == 0:
        raise SystemExit("direction is all zeros")
    unit /= norm
    projections = unit @ vectors
    selected = np.argsort(-np.abs(projections))[:top] if top else np.arange(vectors.shape[1])
    edited = vectors.copy()
    edited[:, selected] -= scale * np.outer(unit, projections[selected])
    if space_axis == 1:
        edited = edited.T
    return edited.astype(matrix.dtype), selected, projections


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("weights", help="Input checkpoint (left unchanged)")
    parser.add_argument("--tensor", required=True, help="Exact name of the 2D tensor to edit")
    parser.add_argument("--direction", required=True, help=".npy file holding the direction vector")
    parser.add_argument("--space-axis", type=int, choices=[0, 1], default=0,
                        help="Axis whose length equals the direction length (default 0)")
    parser.add_argument("--top", type=int, default=0,
                        help="Edit only the N vectors with the largest |projection|; 0 edits all (default 0)")
    parser.add_argument("--scale", type=float, default=1.0,
                        help="Fraction of the projection to remove; 1 removes it, above 1 reverses it (default 1)")
    parser.add_argument("--out", required=True, help="Output checkpoint (.npz or .safetensors)")
    args = parser.parse_args()

    if Path(args.out).resolve() == Path(args.weights).resolve():
        raise SystemExit("write edits to a new file; keep the original checkpoint unchanged")
    tensors = weights_io.load(args.weights)
    if args.tensor not in tensors:
        raise SystemExit(f"tensor {args.tensor} not found")
    matrix = tensors[args.tensor]
    if matrix.ndim != 2:
        raise SystemExit(f"tensor {args.tensor} has {matrix.ndim} dimensions, expected 2")
    direction = np.load(args.direction, allow_pickle=False)
    edited, selected, projections = ablate(matrix, direction, args.space_axis, args.top, args.scale)
    tensors[args.tensor] = edited
    weights_io.save(args.out, tensors)

    changed = int(len(selected) * matrix.shape[args.space_axis])
    total = sum(int(array.size) for array in tensors.values())
    print(f"edited {len(selected)} vectors of {args.tensor}; up to {changed} weights "
          f"({changed / total:.4%} of {total}) written to {args.out}")
    print(f"largest |projection| before: {float(np.abs(projections).max()):.4g}")


if __name__ == "__main__":
    main()
