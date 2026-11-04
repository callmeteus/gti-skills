# Editing moves

Ordered from the smallest and safest to the largest. Start at the top and move down only when a smaller move cannot work. Always write edits to a new file and record them in the ledger.

## 1. Remove a direction

A direction `u` in the residual stream (or a hidden layer) carries the failure. Project it out of the weights that write it:

```bash
python3 <skill-dir>/scripts/edit/ablate_direction.py model.safetensors --tensor model.layers.15.mlp.down_proj.weight --direction loop_dir.npy --space-axis 0 --top 64 --out edited.safetensors
```

- **Finding `u`:** mean residual or MLP output on failing tokens minus the mean on normal tokens, at the layer where the difference is largest and most consistent. Normalize it.
- **Where to remove it:** the output matrices of the layers that write it most (largest `|u . column|`). Use `--top` to edit only the columns that matter.
- **Scale:** `--scale 1` removes the component, values between 0 and 1 dampen it, values above 1 push against it. Start at 1.
- **Alternative:** remove it on the read side by projecting `u` out of the input rows of the next layers that react to it.

## 2. Gate or silence a unit

- Zero a unit's outgoing column to remove its effect, or its incoming row and bias to keep it off.
- Shift a bias to change a threshold, for example so a detector fires later.

## 3. Rescale a component

Multiply one head's `W_O` or one unit's outgoing weights by a factor. Useful when a feature is right but too strong or too weak.

## 4. Add a side path

When the network needs a behavior it does not have in one state, route a few spare or low-importance units per layer into a new circuit:

1. Pick units with small outgoing norm (from `inspect_weights.py`) and record their original values.
2. In the first layer, set their input rows to detect the condition (for example position and speed of the car before the ramp).
3. Carry the signal through the hidden layers with one unit per layer (large self weight, other inputs zero).
4. In the output layer, add the desired action's logit and a switch-off condition (for example after a marker is passed).

In the source post this move changed 3.5% of a control policy and turned 0% success into 100%.

## 5. Overwrite a block

Replace a whole sub-network with a hand-built one (see [construction-patterns.md](construction-patterns.md)). This is writing, not fixing; use it only when the old block is clearly the problem.

## After every edit

- `diff_weights.py original edited` and record the fraction changed.
- Measure on practice inputs, compare with the baseline, and decide keep or revert in the ledger.
- Check one unrelated behavior so a fix in one place does not break another.
