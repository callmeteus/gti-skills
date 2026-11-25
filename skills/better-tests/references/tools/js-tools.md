# Stryker and fast-check from Outside the Project

In JavaScript and TypeScript projects, Stryker (mutation testing) and fast-check (property-based testing) are mandatory in the verify step. They are always installed, and never into the project: the project must not gain a dependency, a lockfile change, a Stryker config, a report folder, or a temp folder. The bundled script keeps everything in a shared tools folder and runs the tools against the project from there.

## The tools folder

- **Default:** `~/.gti/better-tests/tools/node`. Set `GTI_TEST_TOOLS_DIR` or pass `--tools-dir` to use another folder.
- **Must be outside the project.** The script refuses a folder inside the project it is working on.
- **Shared.** One install serves every project. Each project gets its own work folder at `<tools-dir>/work/<project-name>-<hash>/` for its Stryker config, reports, sandbox, and property files.
- **Contents:** `@stryker-mutator/core`, the Vitest, Jest, and Mocha runner plugins (major 9), `fast-check` (major 4), and `tsx` (major 4) to run TypeScript property files.

## Commands

Use `node` on every platform. Run from anywhere; `--project` points at the project root (the folder with `package.json`).

### Install

```bash
node <skill-dir>/scripts/tools/js-tools.mjs install
```

Installs whatever is missing with `npm install --prefix <tools-dir>` and prints the installed versions. It does nothing when everything is present; `--update` reinstalls the latest versions of the same majors. Run it during discovery, without asking the user, and tell them the folder path.

### Mutation testing

```bash
node <skill-dir>/scripts/tools/js-tools.mjs stryker --project . --mutate "src/orders/**/*.ts"
```

| Option | Default | Purpose |
|--------|---------|---------|
| `--project` | Required | Project root |
| `--mutate` | Required, repeatable | Files to mutate. Scope it to the changed code |
| `--runner` | Detected from `package.json` | `vitest`, `jest`, `mocha`, or `command`. Prefer the detected runner; use `command` only when it fails |
| `--test-command` | `npm test` | Test command for the `command` runner |
| `--concurrency` | Stryker default | Number of parallel test runner processes |
| `--tools-dir` | `~/.gti/better-tests/tools/node` | Tools folder |

How it stays out of the project:

- Stryker runs with the project as its working directory, so it uses the project's own test runner, config, and `node_modules`.
- The Stryker config is written to the work folder and passed by path. Reports (`mutation.html`, `mutation.json`) and the sandbox copy (`stryker-tmp`, removed after the run) go to the work folder too.
- The script compares `git status` before and after the run and adds a `warning` when the project changed. Test runners may still update their own caches under `node_modules` (for example `node_modules/.vite`), which is ignored by git in a normal project.

Run time and progress:

- **Prefer the project's runner over `command`.** The Vitest, Jest, and Mocha runners know which tests cover each mutant, run only those tests, and mark uncovered mutants `NoCoverage`. The `command` runner runs the whole test command once per mutant and reports uncovered mutants as `Survived`, so it is several times slower and its score is lower than the truth. On one Vitest project with 467 mutants, the `command` runner took 14 minutes and the `vitest` runner 4.
- **Progress shows every 10 seconds** as a `Mutation testing N% ... tested` line. A run that prints these lines is working, not hung. Run Stryker in the background when the scope has hundreds of mutants, and narrow `--mutate` to the changed files first.

The last lines of output are a JSON summary: runner, scope, counts by mutant status, the mutation score, and the report paths. Open `mutation.html` to read each surviving mutant, then kill it with an assertion in the project's tests or record why it is equivalent.

### Property-based testing

1. Get the work folder and the relative path from it to the project:

   ```bash
   node <skill-dir>/scripts/tools/js-tools.mjs workdir --project .
   ```

   It prints `workDir` and `importPrefix`.

2. Write the property file in `workDir`, for example `orders.property.ts`. Import `fast-check` by name, and the code under test through `importPrefix`, with the file extension:

   ```ts
   import fc from "fast-check";
   import { total } from "../../../shop/src/orders/total.ts";

   fc.assert(
     fc.property(fc.array(fc.integer({ min: 0, max: 10_000 })), (prices) => total(prices) >= 0),
   );
   console.log("property holds");
   ```

3. Run it:

   ```bash
   node <skill-dir>/scripts/tools/js-tools.mjs property --project . "<workDir>/orders.property.ts"
   ```

   The file runs with `tsx` from the tools folder, with the project as the working directory. The script refuses property files outside the work folder.

4. When fast-check reports a counterexample, copy its shrunk values into a normal example-based test in the project's suite, with literal inputs and the literal expected output, watch it fail, then fix the code.

Property files are probes and stay in the work folder. If the project already lists `fast-check` in its dependencies, property tests may also live in its suite, following its conventions.

## When something does not work

| Problem | What to do |
|---------|------------|
| `npm install` fails | Report the error and stop the verify step. Never install into the project instead. |
| Stryker cannot find the test runner | Pass `--runner command --test-command "<the project's test command>"`. |
| The run seems stuck | Look for the `Mutation testing N%` progress lines. If they advance, wait, or stop and narrow `--mutate`. If `--runner command` was used on a Vitest, Jest, or Mocha project, drop it. |
| A path alias such as `@/` does not resolve in a property file | Import the module by its real relative path through `importPrefix`. |
| The project uses ESM-only packages that `tsx` cannot load | Write the property file as `.mjs` and import the built output, or run the property inside the project's runner only if `fast-check` is already a dependency. |
| The `warning` field appears | Run `git status` in the project, explain what changed, and restore anything the tools wrote. |
