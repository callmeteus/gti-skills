# Reading probes

Computations on the weights alone. None of them runs the network, so none spends the budget. Shapes below use the PyTorch `[out, in]` layout; transpose for `[in, out]`.

## MLPs

| Probe | Computation | What it shows |
|-------|-------------|---------------|
| Input-group mass | `abs(W1).reshape(h, C, -1).sum((0, 2))` or `inspect_weights.py --input-groups C` | Which input channels the network uses at all |
| Spatial map per channel | `W1.reshape(h, C, H, W)`, then `abs(...).sum(0)` per channel | Where on the grid each channel matters: a fixed row, the whole board, edges |
| Unit receptive field | One row of `W1` reshaped to the input layout | What a single first-layer unit detects |
| Output-row similarity | Cosine similarity of rows of the last weight matrix | Which actions or classes the network distinguishes |
| Path product | `W3 @ W2 @ W1`, then check with signs and saturation | Linear approximation of input-to-output influence |
| Dead and saturated units | Zero rows; bias so large the unit is always on or off | Spare capacity and constant features |
| Output-column images | Columns of the last layer reshaped to the output shape | For generators, the edges or regions each unit paints |

## Transformers

Write `d` for the model width, `W_Q, W_K, W_V` per head of shape `[d_head, d]`, and `W_O` per head of shape `[d, d_head]`.

| Probe | Computation | What it shows |
|-------|-------------|---------------|
| QK circuit | `W_Q.T @ W_K` (`[d, d]`), its SVD | What a head looks for: which residual directions in the query match which in the key |
| OV circuit | `W_O @ W_V` (`[d, d]`), its SVD and trace sign | What a head writes when it attends: copying has a large positive eigenvalue spectrum |
| Positional preference | QK circuit applied to positional embeddings or rotary frequencies, when present | Heads that attend to the previous token or a fixed offset |
| Induction candidates | A previous-token head in an earlier layer whose OV output feeds the key side (`W_K`) of a later head with copying OV | The copy-what-came-after-the-last-match circuit |
| Write spread | Effective rank and singular values of a block's output matrices | How many directions a layer writes into; fewer directions can mean a smaller alphabet or narrower task |
| Composition | `W_Q(later) @ W_O(earlier)` and `W_K(later) @ W_O(earlier)` norms | Which heads read what earlier heads write |

Ground truth for induction heads, when budget allows: run repeated random token sequences and score attention from each token to the token after its previous occurrence. In the source post copying heads scored 0.22 to 0.55 and others at most 0.02.

## Comparing two models

1. `diff_weights.py base.safetensors other.safetensors` and rank tensors by relative change.
2. For the most changed attention heads, compare QK and OV circuits between the two models.
3. For MLPs, compare the output columns that changed most and project them onto the unembedding, when it exists, to see which tokens they promote.
4. Expect static differences to be hard to tie to behavior. An attention-only observation on a few crafted texts is often the cheapest decisive test.

## Reasoning hygiene

- Write each claim with the computation that supports it.
- Prefer two independent signals over one strong one.
- Remember nonlinearities: a path product ignores saturation and gating; check the sign and scale of biases on the path.
