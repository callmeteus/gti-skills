"""Report how many weights changed between an original and an edited checkpoint."""

import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "common"))
import weights_io  # noqa: E402


def compare(original, edited, tolerance):
    rows = []
    for name, before in original.items():
        if name not in edited:
            rows.append({"name": name, "status": "removed", "count": int(before.size)})
            continue
        after = edited[name]
        if before.shape != after.shape:
            rows.append({"name": name, "status": "reshaped", "before": list(before.shape), "after": list(after.shape)})
            continue
        if not np.issubdtype(before.dtype, np.number):
            if not np.array_equal(before, after):
                rows.append({"name": name, "status": "metadata changed"})
            continue
        delta = np.abs(after.astype(np.float64) - before.astype(np.float64))
        changed = int(np.count_nonzero(delta > tolerance))
        if changed == 0:
            continue
        base_norm = float(np.linalg.norm(before.astype(np.float64)))
        rows.append({
            "name": name,
            "status": "changed",
            "count": int(before.size),
            "changed": changed,
            "fraction": changed / before.size,
            "max_abs_change": float(delta.max()),
            "relative_change": float(np.linalg.norm(delta)) / base_norm if base_norm else float("inf"),
        })
    for name, after in edited.items():
        if name not in original:
            rows.append({"name": name, "status": "added", "count": int(after.size)})
    total = sum(int(array.size) for array in original.values() if np.issubdtype(array.dtype, np.number))
    changed = sum(row.get("changed", 0) for row in rows)
    return {"total_weights": total, "changed_weights": changed, "changed_fraction": changed / total if total else 0.0,
            "tensors": rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("original", help="Original checkpoint")
    parser.add_argument("edited", help="Edited checkpoint")
    parser.add_argument("--tolerance", type=float, default=0.0,
                        help="Absolute change at or below this counts as unchanged (default 0)")
    parser.add_argument("--json", action="store_true", help="Print JSON instead of text")
    args = parser.parse_args()

    report = compare(weights_io.load(args.original), weights_io.load(args.edited), args.tolerance)
    if args.json:
        print(json.dumps(report, indent=2))
        return
    print(f"changed {report['changed_weights']} of {report['total_weights']} weights "
          f"({report['changed_fraction']:.4%})")
    for row in report["tensors"]:
        if row["status"] == "changed":
            print(f"  {row['name']}: {row['changed']}/{row['count']} ({row['fraction']:.2%}), "
                  f"max |d|={row['max_abs_change']:.4g}, relative={row['relative_change']:.4g}")
        else:
            print(f"  {row['name']}: {row['status']}")


if __name__ == "__main__":
    main()
