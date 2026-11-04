# Step 3, read mode: infer what a network does from its weights

The aim is a claim about the network (its task, its training data, what a head or unit computes, which of two models has a behavior) backed by evidence found in the weights.

## Procedure

1. **Inventory.** Run `scripts/inspect/inspect_weights.py` with `--svd 8`. Note dead units (zero rows), dominant units, and low-rank layers.
2. **Map the input.** Use `--input-groups` with the number of input channels, then reshape the first-layer weights to the input layout (for example `[hidden, channels, rows, cols]`) and look at where each channel's mass sits. A channel concentrated on one row is a paddle or a fixed object; mass spread over the whole board is a moving agent or items.
3. **Map the output.** Compare output rows pairwise. Rows that are nearly equal mean actions the network treats the same; a row with large norm is an action used often or with strong conditions.
4. **Trace paths.** Multiply weight matrices along a path (ignoring the nonlinearity first, then checking signs and saturation) to see which input regions drive which outputs.
5. **Form hypotheses.** Write each one in the ledger with the evidence.
6. **Confirm with a second signal.** A hypothesis from the input map should agree with something in the output map or a path product. If budget allows, spend one pass on chosen inputs that would separate the top two hypotheses.
7. **State confidence.** Give the claim, the evidence, what would falsify it, and the alternatives you ruled out.

## Signals by architecture

- **MLP policies:** first-layer channel mass, spatial patterns in the reshaped weights, output-row differences.
- **Generative MLPs (for example a diffusion denoiser):** reshape output-layer columns to the image shape; the units trace edges or regions of what the model produces. Expect outlines, not fills.
- **Transformers without embeddings:** attention circuit products per head, the rank and spread of what each block writes, and copy or induction patterns. See [../techniques/reading-probes.md](../techniques/reading-probes.md).
- **Two near-identical models:** diff them first with `scripts/edit/diff_weights.py`, then rank the changed tensors by relative change and study those heads or units.

## When weights alone are not enough

Comparing two fine-tunes of one base model can show where they differ without showing which difference causes a behavior. In the source post, weights alone failed to find the sycophantic model; an attention-only tool (write texts, see attention weights) succeeded, because it showed one model attending to the user's suggested answer. When static reading stalls, ask for or propose a limited observation tool and budget it.
