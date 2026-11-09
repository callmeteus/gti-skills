# lintapple

A UI linter that checks rendered web pages in Chromium against fixed design rules, vendored from [gholtzap/lintapple](https://github.com/gholtzap/lintapple).

## Overview

This package is a copy of lintapple 0.1.24 at upstream commit `4dc63bf`, with the two open upstream pull requests ported from JavaScript to the TypeScript test suite: [#8](https://github.com/gholtzap/lintapple/pull/8) (`test/absolute-scroll-cli.test.ts`) and [#9](https://github.com/gholtzap/lintapple/pull/9) (`test/absolute-clipping-cli.test.ts`). Both are regression tests for a fix already on upstream `main`. Upstream's own documentation is in [UPSTREAM-README.md](UPSTREAM-README.md), and its contributor notes in [AGENTS.md](AGENTS.md).

It is shared by two skills: [Frontend Design Review](../../skills/frontend-design-review/README.md) and [Unslop Interface](../../skills/unslop-interface/README.md). The `agent/` folder holds what both skills load, a runner script and a reference file, and `node packages/cli build` copies it into each skill. The package does not decide severity or fixes; the skills do.

## Run

From the repository root:

```bash
cd packages/lintapple && npm ci && npm run build && npx playwright install chromium
```

```bash
node packages/lintapple/dist/bin/lintapple.js http://localhost:3000 --config packages/lintapple/ui-policy.json --json
```

Through the shared runner, as the skills do:

```bash
node skills/frontend-design-review/scripts/lintapple/run.mjs http://localhost:3000 --project <app folder>
```

## Layout

| Path | Responsibility |
|------|----------------|
| `src/` | Checks, policy loading, reports, Playwright integration (upstream) |
| `bin/lintapple.ts` | CLI (upstream) |
| `test/` | Upstream tests plus the two ported pull request tests |
| `examples/`, `demo/`, `scripts/` | Upstream examples, demo site, and build scripts |
| `ui-policy.json` | Default policy |
| `agent/scripts/run.mjs` | Shared runner: finds lintapple, picks the policy, prints a summary; synced to `scripts/lintapple/` in both skills |
| `agent/references/lintapple.md` | Shared guide for the skills; synced to `references/lintapple/` in both skills |

## Scripts

| Command | Action |
|---------|--------|
| `npm run build` | Compiles TypeScript to `dist/` and builds demo assets |
| `npm test` | Builds, then runs every test with Node's test runner |
| `npm run typecheck` | Type checks without writing files |
| `npm run test:playwright` | Runs the example Playwright test |
| `npm run demo` | Serves the demo site |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `LINTAPPLE_CLI` | `dist/bin/lintapple.js` | CLI path used by the CLI tests |
| `LINTAPPLE_ORIGIN` | Unset | Origin of a deployed demo for the external evidence tests |

## Testing

`npm test` in this folder builds the package and runs the whole suite, including the two ported tests; it needs Chromium for Playwright (`npx playwright install chromium`). The tests start Chromium many times and take several minutes, so they are not part of the repository's root `npm test`.

On Windows, 9 of the 169 tests fail, and the unmodified upstream checkout fails the same ones on the same machine: they assume POSIX file modes, start `npm` without a shell, rename files that Windows keeps locked, or build paths from file URLs in a POSIX way. The other 160 pass there, including both ported pull request tests.

See [../../README.md](../../README.md) for the full repository.
