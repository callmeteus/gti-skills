---
name: better-tests
description: >-
  Makes coding agents write tests that catch bugs instead of tests that lock
  in code: real dependencies over mocks (Testcontainers), tests coupled to
  public APIs and user-visible behavior, a failing test before every bug fix,
  no logic in tests, Playwright for real user flows, and mutation and
  property-based testing to prove the suite catches bugs. Also audits and
  prunes suites full of brittle, mock-heavy unit tests. Use when the user asks
  to write, add, fix, review, refactor, or delete tests, to reproduce a bug,
  or says the AI-generated tests are bad, slow, or useless. Do not use for
  load or performance testing, security testing, or test infrastructure such
  as CI pipeline setup alone.
metadata:
  display-name: Better Tests
---

# Better Tests

## Core Rule

Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

## When to use

- The user asks to write or add tests for a feature, endpoint, component, or module.
- The user reports a bug and wants it fixed. The fix starts with a failing test.
- The user says the existing tests are brittle, slow, mock-heavy, break on every refactor, or "AI slop", or asks which tests to delete.
- The user asks how good the suite is, or wants to find missing tests.

Do not use this skill for load, performance, or security testing, or for CI setup with no tests involved.

## The goal

Measure tests by the bugs they catch, not by how many exist or by line coverage. A test earns its place when it fails for a real defect and stays green through a refactor that keeps behavior. Tests that only mirror the implementation make code harder to change, cost agent tokens and CI minutes, and catch nothing.

## Prerequisites

- The code under test and its test runner. Discover the stack before writing anything.
- Docker (or a compatible runtime) when integration tests use Testcontainers. If it is missing, say so and ask before falling back to in-memory fakes.
- Optional: Playwright and the Playwright MCP server for user-flow tests, and a mutation or property-based testing tool for the verify step. Install nothing without asking.

## Instructions

Pick the mode from the request, then follow its steps in order. Read a reference file only when a step needs it.

### Mode A: write tests for new or changed code

1. **Discover.** Find the test runner, existing helpers, fixtures, containers, and conventions, and the public surface of the code (exported functions, HTTP routes, CLI commands, UI). See [references/workflow/01-discover.md](references/workflow/01-discover.md).
2. **Choose the level.** For each behavior, pick the highest level that stays fast and deterministic: user flow, API or integration, or unit for pure logic. See [references/workflow/02-choose-level.md](references/workflow/02-choose-level.md).
3. **Write the tests.** Follow the eight rules below. For dependencies read [references/rules/dependencies.md](references/rules/dependencies.md); for UI flows read [references/rules/user-flows.md](references/rules/user-flows.md).
4. **Prove they catch bugs.** Run them, break the code on purpose, and confirm they fail; then run mutation or property-based tests when the stack has a tool. See [references/workflow/04-verify.md](references/workflow/04-verify.md).
5. **Report** with [assets/templates/test-report.md](assets/templates/test-report.md).

### Mode B: fix a bug

1. **Discover** as in Mode A.
2. **Reproduce first.** Write a test at the level where the user saw the bug, run it, and show it fails for the reported reason before touching the code. See [references/workflow/03-reproduce-bug.md](references/workflow/03-reproduce-bug.md).
3. **Fix** the code with the smallest change that turns the test green. Never edit the test to make it pass.
4. **Verify** and **report** as in Mode A, steps 4 and 5.

### Mode C: audit or prune a suite

1. **Discover** as in Mode A, and measure the suite: test count, runtime, mock count, and flaky tests if CI history is available.
2. **Classify** every test file with [references/quality/anti-patterns.md](references/quality/anti-patterns.md) and the audit steps in [references/workflow/05-audit-and-prune.md](references/workflow/05-audit-and-prune.md): keep, rewrite at a higher level, merge, or delete.
3. **Replace before deleting.** Write the higher-level test that covers the behavior first, then propose the deletion. Delete only with the user's approval.
4. **Report** the plan or the changes with the template.

## The eight rules

1. **Avoid mocks.** Use the real thing, then a container, then a fake you own. Mock only what you cannot run: third-party services, the clock, randomness.
2. **Use Testcontainers for integration tests.** Run the real database, queue, or cache in a throwaway container instead of mocking the client.
3. **Couple tests to public APIs, not code structure.** Call what users or other modules call. Never assert on private methods, internal call order, or how many times a collaborator was called.
4. **Reproduce a bug in a failing test before fixing it.** No fix without a red test first.
5. **Keep logic out of tests.** No loops, conditionals, or recomputed expected values. Write literal inputs and literal expected outputs.
6. **Use mutation and property-based tests to find missing tests.** A surviving mutant is a missing assertion; a shrunk counterexample is a missing case.
7. **Test real user flows with Playwright.** Drive the app the way a user does, and use the Playwright MCP server to explore a flow before writing the test.
8. **Assert behavior from the user's point of view.** Check what the caller or user observes: the response, the stored record, the text on screen, the emitted event.

## Examples

```text
User: Add tests for the new POST /orders endpoint.
Agent: Finds Vitest, an existing Postgres Testcontainers helper, and a test app
factory. Writes HTTP-level tests through the app: creates an order and reads it
back with GET, rejects an empty cart with 422, and rejects an unknown product.
Uses the real Postgres container, mocks only the payment provider at its HTTP
boundary. Breaks the total calculation on purpose, sees two tests fail, reverts.
Runs Stryker on orders/, kills two surviving mutants with one new assertion on
the discount rounding. Reports tests added, runtime, and the mutation score.
```

```text
User: Checkout shows the wrong total when a coupon and free shipping combine. Fix it.
Agent: Writes a test that builds that cart through the public checkout API and
asserts the total the user sees. Runs it: it fails with 105.00 instead of 95.00.
Fixes the order of discount application, the test passes, the full suite passes.
```

```text
User: Our unit tests break on every refactor. Which ones can go?
Agent: Classifies 140 test files. 61 assert only on mock calls, 18 test private
helpers, 9 duplicate HTTP tests. Proposes 12 integration tests that cover the
same behavior, writes them, shows they catch the same seeded bugs, and asks
before deleting the 88 files.
```

## Resources

| Path | Purpose |
|------|---------|
| `references/workflow/` | One file per step: discover, choose the level, reproduce a bug, verify, audit and prune |
| `references/rules/` | Dependencies (mocks, fakes, Testcontainers) and user flows (Playwright) |
| `references/quality/` | Anti-patterns used to review new tests and classify old ones |
| `assets/templates/` | The report structure |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.

## Notes

- The eight rules come from a post by Daniel Moka. The audit mode answers the post it quotes, in which Sherwood Callaway reports deleting about 800k lines of unit tests from a monorepo on the hypotheses that unit tests lock in slop code, slow down agents and CI, and waste tokens. Those hypotheses were not yet confirmed when the post was written, so this skill prunes only after replacing coverage, never by bulk deletion.
- Unit tests stay valuable for pure logic with many cases: parsers, calculations, state machines. The rules target tests that mirror structure, not unit tests as such.
