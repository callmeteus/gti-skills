# Step 3, fix mode: diagnose a failure and edit the weights

The aim is a small edit that removes a specific failure, measured on practice inputs and confirmed on the held-out evaluation.

## Procedure

1. **Observe the failure.** Use one or a few forward passes (or a failure log the user provides) to see exactly what goes wrong: the car drives straight at the ramp and stalls, the LLM repeats a phrase until the token limit.
2. **Measure the baseline** on practice inputs: success rate, accuracy, loop rate, token-limit hits. Record it in the ledger.
3. **Locate the cause.** Find the component whose activity tracks the failure:
   - For an LLM, collect residual-stream or MLP-output activations on failing and normal generations and take the mean difference per layer. A large, consistent difference concentrated in a few layers is a candidate direction.
   - For a policy, find the units that decide the failing action in the failing state, and the input features (position, speed) that would distinguish the state where a different action is needed.
4. **Design the edit.** Pick the smallest move from [../techniques/editing-moves.md](../techniques/editing-moves.md): remove a direction, gate or zero a unit, add a side path through a few spare units, or shift a bias. Write the reason in the ledger before you apply it.
5. **Apply it to a new file.** For directions use `scripts/edit/ablate_direction.py`; for other edits write a short numpy script that loads the original, edits named slices, and saves a new checkpoint with `scripts/common/weights_io.py`.
6. **Measure the change** with `scripts/edit/diff_weights.py`. Most good edits change well under 5% of weights.
7. **Test on practice inputs.** Spend passes, compare with the baseline, and record `ledger.py edit --decision keep` or `revert`. Revert anything that does not improve the target metric or that breaks something else you measured.
8. **Iterate** within the budget: refine the layer, the number of columns, or the scale. Interleave edits and measurement; do not batch many untested edits.

## Check the ceiling

Before investing the budget, ask whether the failure hides an ability or the ability is absent. A model that loops on most problems may solve them once the loop is removed. A model that makes ordinary reasoning errors has no single switch to flip; in the source post such a model did not improve. If the failures look varied and unrelated, say so early.

## Examples from the source post

- **Control policy stuck in a local minimum:** the agent added a side path through a few units per layer that reads the car's position and speed, makes the car reverse first, and switches off past a marker. 3.5% of weights changed; the task went from 0 of 256 to 1,024 of 1,024 episodes.
- **LLM repetition loops:** the loops traced to one direction written by the MLPs of two middle layers. Subtracting it from 64 output columns in each layer changed 0.016% of weights; with 50 passes, held-out math accuracy rose sharply and token-limit hits fell. With 10 or 25 passes the gains were small, so the budget matters.

Use the same sampling settings as the model card for every LLM measurement; loop rates depend strongly on temperature, top-p, top-k, and repetition penalties.
