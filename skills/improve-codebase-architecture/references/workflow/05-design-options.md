# Step 5 (optional): compare several API designs

The first API design is rarely the best. When the user wants options for the merged module's public API, produce several very different designs and compare them.

## 1. Describe the problem to the user

Write a short explanation:

- The constraints any API must meet.
- The dependencies and their type (see [../concepts/testing-by-dependency.md](../concepts/testing-by-dependency.md)).
- A rough code sketch that makes the constraints concrete. It is not a proposal.

Show it, then start the designs right away; the user reads while they run.

## 2. Produce three or four designs

Use parallel subagents when the agent supports them, each with a fresh context; otherwise write the designs one after another without looking back at the previous ones. Give each design a separate technical brief (file paths, coupling, dependency type, what moves inside) and a different constraint:

1. Smallest API: one to three entry points, each doing as much as possible.
2. Most flexible: supports many use cases and extension.
3. Simplest for the most common caller: the default case is one obvious call.
4. When there are network dependencies: built around injected clients with a real and a fake implementation.

Include the project's glossary words in each brief so names stay consistent.

Each design returns:

1. The API: types, functions, parameters, call order rules, and errors.
2. A usage example from a real caller.
3. What the module hides inside.
4. How dependencies are injected and faked in tests.
5. Trade-offs: where callers gain the most, and where the design is weak.

## 3. Compare and recommend

Present the designs one at a time, then compare them in plain words:

- How much each caller must know to use it.
- Where future changes and bug fixes would land.
- Where dependencies are passed in and how tests replace them.

End with a clear recommendation, or a combination of the best parts of two designs. Be decisive; the user wants an opinion, not a menu.
