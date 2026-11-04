import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

SKILL = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL / "scripts"
sys.path.insert(0, str(SCRIPTS / "common"))
import weights_io  # noqa: E402


def run(script, *args, check=True):
    return subprocess.run([sys.executable, str(SCRIPTS / script), *map(str, args)],
                          capture_output=True, text=True, check=check)


class WeightScriptsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())

    def test_safetensors_round_trip_keeps_names_shapes_and_values(self):
        tensors = {"a.weight": np.arange(6, dtype=np.float32).reshape(2, 3), "b": np.array([1, -2], dtype=np.int64)}
        path = self.tmp / "m.safetensors"
        weights_io.save(path, tensors)
        loaded = weights_io.load(path)
        self.assertEqual(list(loaded), ["a.weight", "b"])
        np.testing.assert_array_equal(loaded["a.weight"], tensors["a.weight"])
        np.testing.assert_array_equal(loaded["b"], tensors["b"])

    def test_inspect_reports_input_group_mass(self):
        weight = np.zeros((4, 6), dtype=np.float32)
        weight[:, 3:] = 1.0
        path = self.tmp / "m.npz"
        np.savez(path, w=weight)
        report = json.loads(run("inspect/inspect_weights.py", path, "--input-groups", 2, "--svd", 2, "--json").stdout)
        entry = report["tensors"][0]
        self.assertEqual(entry["input_group_mass"], [0.0, 1.0])
        self.assertAlmostEqual(entry["effective_rank"], 1.0)

    def test_ablate_removes_the_direction_from_top_columns_only(self):
        rng = np.random.default_rng(0)
        weight = rng.normal(size=(8, 5)).astype(np.float32)
        direction = np.zeros(8)
        direction[2] = 1.0
        weight[2, 4] = 50.0
        original = self.tmp / "m.npz"
        np.savez(original, w=weight)
        np.save(self.tmp / "u.npy", direction)
        edited = self.tmp / "edited.npz"
        run("edit/ablate_direction.py", original, "--tensor", "w", "--direction", self.tmp / "u.npy",
            "--top", 1, "--out", edited)
        result = weights_io.load(edited)["w"]
        self.assertAlmostEqual(float(result[2, 4]), 0.0, places=5)
        np.testing.assert_array_equal(result[:, :4], weight[:, :4])

        report = json.loads(run("edit/diff_weights.py", original, edited, "--json").stdout)
        self.assertEqual(report["changed_weights"], 1)
        self.assertEqual(report["total_weights"], 40)

    def test_ablate_refuses_to_overwrite_the_original(self):
        path = self.tmp / "m.npz"
        np.savez(path, w=np.ones((2, 2)))
        np.save(self.tmp / "u.npy", np.ones(2))
        result = run("edit/ablate_direction.py", path, "--tensor", "w", "--direction", self.tmp / "u.npy",
                     "--out", path, check=False)
        self.assertNotEqual(result.returncode, 0)

    def test_forward_spends_budget_and_stops_when_it_runs_out(self):
        ledger = self.tmp / "ledger.json"
        run("budget/ledger.py", "--ledger", ledger, "init", "--mode", "write", "--budget", 1, "--goal", "and gate")
        net = self.tmp / "and.npz"
        run("build/mlp.py", "init", "--sizes", "2,1", "--activations", "relu", "--out", net)
        tensors = weights_io.load(net)
        tensors["layers.0.weight"][:] = [[1.0, 1.0]]
        tensors["layers.0.bias"][:] = [-1.0]
        weights_io.save(net, tensors)
        np.save(self.tmp / "x.npy", np.array([[0, 0], [1, 0], [1, 1]], dtype=np.float32))

        run("build/mlp.py", "forward", "--weights", net, "--inputs", self.tmp / "x.npy",
            "--out", self.tmp / "y.npy", "--ledger", ledger)
        np.testing.assert_array_equal(np.load(self.tmp / "y.npy").ravel(), [0, 0, 1])

        second = run("build/mlp.py", "forward", "--weights", net, "--inputs", self.tmp / "x.npy",
                     "--out", self.tmp / "y2.npy", "--ledger", ledger, check=False)
        self.assertEqual(second.returncode, 2)
        self.assertFalse((self.tmp / "y2.npy").exists())
        self.assertEqual(json.loads(ledger.read_text())["spent"], 1)


if __name__ == "__main__":
    unittest.main()
