# lintapple

A UI linter that checks rendered web pages in Chromium against explicit design rules. This package is a fork of [gholtzap/lintapple](https://github.com/gholtzap/lintapple) that lives inside the gti-skills monorepo.

## Overview

The base is upstream commit `710274f` from 2026-11-20, version 0.1.24. The folders `src/`, `bin/`, `test/`, `examples/`, `demo/`, and `scripts/` come from that commit. The `agent/` folder is local. It holds the runner, probes, and reference used by the design skills. New checks added here stay in this package. Upstream text is in [UPSTREAM-README.md](UPSTREAM-README.md), and upstream contributor notes are in [AGENTS.md](AGENTS.md).

Two local changes keep the npm workflow of this monorepo. The `typecheck` script uses `tsc --noEmit` instead of `bun check --no-script`. The `packageManager` field that pins bun is removed. Everything else follows upstream.

The first local check is `redundant-state-actions`. It reports two nearby buttons in one action group when the DOM shows one action in two states, either through the same action key (`data-ui-action`, `data-action`, `aria-controls`, `formaction`, or `name` with `value`), or through complementary disabled state. It never reads button text, so it works in every language. Its test is in `test/redundant-state-actions.test.ts`.

The package is shared by two skills: [Frontend Design Review](../../skills/frontend-design-review/README.md) and [Unslop Interface](../../skills/unslop-interface/README.md). The `agent/` folder holds what both skills load. `node packages/cli build` copies it into each skill. The package does not decide severity or fixes. The skills do.

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
| `test/` | Upstream tests, including the merged pull request regressions |
| `examples/`, `demo/`, `scripts/` | Upstream examples, demo site, and build scripts |
| `scripts/ci-tests.ts`, `scripts/test-timings.json` | Upstream test partitioning by measured time |
| `ui-policy.json` | Default policy |
| `agent/scripts/run.mjs` | Shared runner: finds lintapple, picks the policy, prints a summary; synced to `scripts/lintapple/` in both skills |
| `agent/scripts/probe.mjs` | Layout probe that needs no markers; synced with the runner |
| `agent/scripts/tokens.mjs` | Source scan for colors outside tokens and missing semantic roles; synced with the runner |
| `agent/tests/` | Tests for the probe and the token scan; run by the repository's root `npm test` |
| `agent/references/lintapple.md` | Shared guide for the skills; synced to `references/lintapple/` in both skills |
| `UPSTREAM-README.md` | Unmodified upstream README at the base commit |

## Scripts

| Command | Action |
|---------|--------|
| `npm run build` | Compiles TypeScript to `dist/` and builds demo assets |
| `npm test` | Builds, then runs every test with the upstream test partitioner |
| `npm run test:built` | Runs the compiled test suite without building again |
| `npm run typecheck` | Type checks without writing files |
| `npm run test:playwright` | Runs the example Playwright test |
| `npm run demo` | Serves the demo site |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `LINTAPPLE_CLI` | `dist/bin/lintapple.js` | CLI path used by the CLI tests |
| `LINTAPPLE_ORIGIN` | Unset | Origin of a deployed demo for the external evidence tests |

## Testing

`npm test` in this folder builds the package and runs the whole suite. It needs Chromium for Playwright (`npx playwright install chromium`). The tests start Chromium many times and take several minutes, so they are not part of the repository's root `npm test`. The tests in `agent/tests/` are run by the root `npm test`. The probe tests skip when Chromium is missing.

Some upstream tests assume POSIX file modes or start `npm` without a shell. They can fail on Windows. The design skills use the checks in `agent/tests/` in day-to-day work.

See [../../README.md](../../README.md) for the full repository.
