# Construction patterns

Building blocks for writing weights by hand. Notation: one unit computes `act(w . x + b)`. A large gain `k` (5 to 20 for tanh, any positive value for ReLU) makes soft functions behave like logic.

## Detectors and logic

| Pattern | ReLU | tanh |
|---------|------|------|
| Feature present (binary input `x_i`) | `w_i = 1`, `b = 0` | `w_i = k`, `b = -k/2` |
| AND of n binary inputs | `w = 1` each, `b = -(n - 1)` | `w = k` each, `b = -k(n - 0.5)` |
| OR of n binary inputs | `w = 1` each, `b = 0`, then cap downstream | `w = k` each, `b = -k/2` |
| NOT | Negative weight and bias 1 | `w = -k`, `b = k/2` |
| Threshold `x > t` | `w = 1`, `b = -t`, a pair with `b = -t - 1` subtracted for a step | `w = k`, `b = -k t` |
| Count of inputs | `w = 1` each, `b = 0` (linear count) | Use ReLU-like scaling with small weights to stay in the linear part |

## Carrying values

- **Pass a signed value through ReLU:** two units `relu(x)` and `relu(-x)`, recombined downstream as `a - b`.
- **Pass a value through tanh:** scale in by `0.1` and out by `10`; tanh is almost linear near zero.
- **Keep a flag across layers:** one unit per layer with a large weight from the previous flag unit and nothing else.

## Comparisons and argmax

- **x greater than y:** a unit with `w_x = k`, `w_y = -k`.
- **Move toward a target column:** compute target-minus-current as signed units, then route positive to the "right" logit and negative to the "left" logit, with a dead zone bias for "stay".
- **Pick the best move:** the output layer is a scoring function; add weighted features per action (capture +, save own group +, self-atari -) and let argmax or sampling choose. With sampling, scale logits so the best move dominates.

## Spatial structure on grids

- **Neighbor features:** for each point, a unit whose input row reads the four neighbors in the relevant channel (liberties = empty neighbors).
- **Propagation:** one layer per step; each point's unit reads its own previous value and its same-color neighbors, so membership or danger spreads along a chain. Plan depth for the longest chain you need, and accept approximation beyond it.
- **Prediction:** for a moving object, use the object channel and its previous-frame trail (if encoded) to compute direction, then map each (position, direction) pair to a predicted landing column with fixed weights.

## Engineering the construction

- Keep a construction script that sets named slices from formulas, with a comment per block naming the feature it computes. It is the source code of the network.
- Allocate units with a table before writing weights, and assert the totals in the script.
- Check each layer locally on hand-written cases (see [../workflow/04-write.md](../workflow/04-write.md), step 6).
- Respect the declared activation per layer; `scripts/build/mlp.py` stores it in the checkpoint.
