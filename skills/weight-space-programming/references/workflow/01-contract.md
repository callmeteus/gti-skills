# Step 1: set the contract

Weight-space programming is only meaningful when the rules are fixed before the work starts. Write the contract, show it to the user, and create the ledger.

## What the contract holds

| Item | Example | Why it matters |
|------|---------|----------------|
| Mode | read, fix, or write | Decides the workflow file to follow |
| Architecture | MLP 500-32-32-5, tanh, `[out, in]` layout | You cannot reason about units without knowing what feeds them |
| Input encoding | 5 channels x 10 x 10 grid, flattened channel-major | Lets you map input columns back to meaning |
| Output encoding | 5 action logits: noop, left, right, up, down | Lets you read output rows as actions or classes |
| Goal | "name the game", "car reaches the goal", "fewer loops on math" | The target metric |
| Hidden information | Task name withheld | Reading must come from the weights, not the label |
| Allowed tools | Python with numpy, no GPU | What analysis is possible |
| Forbidden actions | Training, gradients, optimizers, fitting to data, search over weights | Keeps the result weight-space programming |
| Forward-pass budget | 0, 10, 50; what one pass means | The only way to observe behavior |
| Practice data | GSM8K train, practice opponents, one failed episode | What you may run and look at |
| Held-out evaluation | MATH-500, 1,024 new episodes, 2,000 games vs fixed opponents | The only score that counts |

## Define one forward pass

Agree on its unit before starting, because it sets how much you can observe. In the source post one pass was a batch: 128 practice games, or the outputs on up to 256 positions, or generations on a set of practice problems. An attention-only tool that returns attention weights for up to 16 texts, without outputs, also counts as a pass.

## Rules to state in the contract

- Analysis of the weights themselves is unlimited: norms, SVD, products such as `W_Q^T W_K` or `W_O W_V`, projections onto directions, and reading the environment source code.
- Running the network on any input, including a single test vector, spends budget.
- Edits are written to new files. The original checkpoint is never overwritten.
- Practice and held-out sets never mix. If the held-out set is not separated yet, separate it now and do not look at it.

## Create the ledger

```bash
python3 <skill-dir>/scripts/budget/ledger.py --ledger wsp-ledger.json init --mode read --budget 0 --goal "identify the game each policy plays"
```

On Windows use `python` or `py -3`. Record hypotheses with `ledger.py note`, forward passes with `ledger.py spend`, and edits with `ledger.py edit`. `scripts/build/mlp.py forward` spends a pass for you and refuses to run when the budget is used up.

## When something is missing

Ask the user for the architecture and the I/O encoding; never guess them from shapes alone. If the user has no held-out evaluation, propose one and say that results without it are only practice results.
