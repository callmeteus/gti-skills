# Step 3: choose the adapter, then train

## The adapter shape decides where the model can run

A LoRA adapter can cover attention projections, MLP or expert layers, and the output head. Where it goes decides whether it can be merged into the released weights:

- Tensors stored in BF16 or FP32 can absorb a LoRA delta exactly: `W <- cast(fp32(W) + (alpha / r) * B @ A)`.
- Tensors stored quantized (NVFP4, MXFP8, 4-bit, GPTQ, AWQ) cannot. Merging means requantizing, which erases most of a small update and perturbs the rest.

So, before training:

1. Read how the released checkpoint stores each tensor group.
2. If the weights must ever leave the training platform, put the LoRA only on tensors stored at full precision. On mixture-of-experts models this usually means attention plus the output head, with the experts frozen.
3. If the model will only ever be served where it was trained, the adapter may cover everything for the best loss.
4. Unsure: train the mergeable shape first. It is the one you can always ship.

In the Inkling 2 Small recipe, the mergeable shape (attention and unembedding, rank 32) kept about 80% of the loss gain of the all-linear shape and passed every behaviour probe; it shipped. Decide by behaviour, not by loss alone.

## Hyperparameters

| Setting | Starting point | Notes |
|---------|----------------|-------|
| Learning rate | Sweep; 1e-4 and 3e-4 are common LoRA starts | Check whether the platform offers a calibrated default for the model; some do not |
| Schedule | Linear decay to zero | Built-in annealing |
| Batch | 8 rows | With long rows, this is hundreds of thousands of tokens per step |
| Epochs | 1 | A second epoch only when steps are few or the loss is still falling and behaviour is not there yet |
| Rank | 8 to 32 | Learning rate matters more than rank |
| Eval and save | Every 20 steps | Every save is a checkpoint you can probe |

**Divergence signature:** validation loss dips, then rises within the first 20 to 40 steps. Stop and halve the learning rate. If budget allows, run a sibling at a second learning rate and compare behaviour, not loss.

## Run order

1. **Offline smoke test.** Render every row through the training path, print the decoded start of the first row (system prompt, tool declaration, settings line, first user turn), and print steps, tokens, and the cost estimate. Read the decoded row yourself.
2. **Show the user the estimate and get a yes.** Never launch a paid run without it.
3. **Launch** into a new run folder under `~/.gti/llm-fine-tuning/<project>/runs/`.
4. **Watch** training loss, validation loss, and the learning rate. Confirm the first points arrive before walking away.
5. **Probe every saved checkpoint** while the run goes (step 4).

## Operational rules

- Commit the user's code before each run and keep the run folder: it maps checkpoint names to paths.
- On managed services, submit calls and await their results; do not wrap them in your own timeouts or retry loops.
- A sampling client created before a save samples the old weights. Make a new one.
- Periodic checkpoints may expire; pick by probe and evaluation, then download or pin the one you keep.
- Delete periodic checkpoints you no longer need when storage is billed.
