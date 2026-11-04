# Weight space programming report: <task>

## Contract

- **Mode:** read | fix | write
- **Architecture:** <layers, sizes, activations, layout>
- **Input and output encoding:** <summary>
- **Goal:** <one sentence>
- **Allowed tools:** <for example Python with numpy, no GPU>
- **Forbidden:** training, gradients, optimizers, fitting to data, search over weights
- **Forward-pass budget:** <spent> of <budget>, one pass = <unit>
- **Practice data:** <set>
- **Held-out evaluation:** <set or environment, sample count>

## Result

<Read mode: the claim and confidence. Fix mode: the edit and the metric change. Write mode: the network and its score.>

## Evidence and reasoning

| Step | Computation or observation | Conclusion |
|------|----------------------------|------------|
| 1 | | |

## Edits

| Id | Tensors | Fraction changed | Practice before | Practice after | Decision |
|----|---------|------------------|-----------------|----------------|----------|
| | | | | | keep or revert |

## Held-out evaluation

| System | Metric | Samples |
|--------|--------|---------|
| Baseline | | |
| Result | | |
| Negative control | | |

## Side effects

<Unrelated behavior measured and the result.>

## Files

- **Ledger:** wsp-ledger.json
- **Kept checkpoint:** <path>
- **Edit or construction script:** <path>

## Limits

- <Sample size, untested settings, alternative explanations>
