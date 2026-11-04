# Step 3, write mode: build a network from zero

The aim is a working network whose every nonzero weight has a stated purpose. You write a program, then compile it by hand into the given architecture.

## Procedure

1. **Read the environment.** Study the rules or source code, the exact input encoding (channel order, flattening order, value ranges), the output encoding, and how actions are chosen (argmax, sampling, masking of illegal moves). Sampling means logits must be large to act deterministically.
2. **Write the algorithm in plain code first.** A short heuristic program that plays well: "move the paddle toward the column where the ball will land", "capture when possible, save groups in atari, avoid self-atari". Keep only what the architecture can express.
3. **Assign features to layers.** Decide what each layer computes and how many units each feature needs. Respect the width: list the units per layer and check the totals fit. Leave spare units if you can; fixes later need them.
4. **Create the zero network.**

   ```bash
   python3 <skill-dir>/scripts/build/mlp.py init --sizes 600,32,32,6 --activations tanh,tanh,none --out policy.npz
   ```

5. **Set weights block by block** in a construction script (keep it in the project; it is the source code of the network). Use the patterns in [../techniques/construction-patterns.md](../techniques/construction-patterns.md): detectors, AND and OR gates, comparisons, copies through a layer, and propagation over a grid.
6. **Check each layer by analysis**, not by running: for a few hand-written input cases, compute the pre-activations of that layer in numpy from its own weights and the expected output of the previous layer. This is analysis of your own construction, not a forward pass of the network, so keep it to layer-local checks on inputs you write. When the contract forbids even that, reason symbolically.
7. **Spend the budget on whole-network checks.** With passes available, play practice games or evaluate practice positions, study the losses, edit the responsible layer, and keep only edits that improve the practice metric. With a budget of 0, submit the construction as written.
8. **Evaluate on the held-out setting.**

## Fit the architecture

- **tanh:** saturating; good for signed gates and for passing a value through a layer (scale down, then up). Bias sets the threshold.
- **ReLU:** one-sided; good for thresholds and counting, and a pair `relu(x) - relu(-x)` passes a signed value.
- **Depth:** each layer is one step of computation. Propagation over a grid (group membership in Go, a ball trajectory) needs one layer per step; budget the depth.

## Examples from the source post

- **Breakout, MLP 600-32-32-6:** layer 1 estimated where the ball would land, layer 2 compared that with the paddle and chose the move. One shot, no runs, it scored far above PPO baselines.
- **9x9 Go, MLP 243-512x6-82:** early layers marked stones and liberties, middle layers propagated group information along chains to find groups in danger, and the last layer scored moves for captures, saving groups, avoiding self-atari and filling own eyes, and good points. The zero-pass construction was one 336-line script.
