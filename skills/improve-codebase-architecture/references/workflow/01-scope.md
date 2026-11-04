# Step 1: decide where to look

A refactor pays off when the code it touches keeps changing. Decide the scope before reading code, so the review spends its time where the next changes will happen.

## If the user named a target

Take it: a folder, a module, a feature, or a pain point ("adding a payment method is painful"). Skip the history scan, but still read the project docs below.

## Otherwise, find the hot spots

```bash
python3 <skill-dir>/scripts/explore/hotspots.py . --commits 300
```

On Windows use `python` or `py -3`. The script lists the folders and files changed most in recent commits, skipping lock files, build output, and vendored code.

- **Clear hot spots:** review the top two or three folders first.
- **Changes spread evenly:** widen the scope, or ask the user which area hurts most.
- **Short history** (a new repository): review the whole `src` tree, starting from the entry points.

Keep the JSON output for the report:

```bash
python3 <skill-dir>/scripts/explore/hotspots.py . --json > hotspots.json
```

Write it to the OS temp folder, not the repository.

## Read the project docs

Before reading code in the chosen area, read:

- `GLOSSARY.md` (or `GLOSSARY-MAP.md` and the right context glossary): the business words to use in the report.
- `docs/adr/`: decisions the review should not reopen without a strong reason.

Both are optional. See [../concepts/project-docs.md](../concepts/project-docs.md) for their format.

## Output of this step

One or two sentences for the report's `scope` field: what was reviewed, why, and what was left out. Example: "Reviewed `src/orders` and `src/pricing`, the two folders with the most changes in the last 300 commits. The rest of the codebase was not reviewed."
