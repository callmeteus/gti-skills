# Step 4: Tools

Goal: lint and format under 1 s, typecheck under 5 s, and one fast tool per job, without checking less.

## Defaults, not dogma

The fast tools in [../stacks/toolchains.md](../stacks/toolchains.md) are defaults. Keeping an old tool needs a measured reason (it catches something the new one misses, or the new one is not faster on this repository). "We have always used it" is not a reason.

For JavaScript and TypeScript, the source prompt's defaults are: `bun` for install and scripts (remove npm, yarn, and pnpm lockfiles and config, Prettier, ESLint, oxlint, Vitest, and Jest), `bun lint` reading the existing `.oxlintrc.json` with every rule turned on that can be, `bun fmt` for formatting, `bun check` on TypeScript 7 for typechecking, and `bun test` for tests, with test files keeping their `vitest` imports. Confirm each command exists in the installed version (`bun --help`, the release notes) before planning around it. If a tool only exists in a canary, pin that exact canary version, never a floating `canary` tag.

## Switching a tool

Before each switch, run old and new side by side and list anything the new one misses:

1. **Same input.** Run both on the same commit, and on a commit with known problems (check out a commit that once failed CI, or plant a few violations on a scratch branch).
2. **Compare findings.** Lint and typecheck: collect both outputs as JSON or one finding per line, normalize to `file:line:rule`, and diff. Format: run both in check mode on the same tree. Tests: same pass and fail set, same test count per file (a runner that silently skips a file is worse than a slow runner).
3. **Close the gaps.** Every rule or check the new tool misses is either enabled in the new tool's config, kept in the old tool (running only that rule), or written up with the user's decision. Never drop it silently (rule 3).
4. **Measure.** Time both, warm and cold, at least five runs each, and record p50.
5. **Switch in one small change.** The PR description has the comparison, the gaps and how they were closed, and the before and after numbers.

## Turning rules on

When a faster linter makes extra rules cheap, turn on every rule that can be on. For each new rule: run it, fix the violations or list them, and add it at error level. A rule that is on as a warning checks nothing in CI.

## Typecheck

- Run the typechecker with no emit, on the whole project, with incremental build info cached across runs.
- Split huge monorepos by project references only when one pass cannot meet the budget.

## Done when

Every job runs the fastest tool that misses nothing, every switch has its side-by-side record, and lint, format, and typecheck meet their budgets or have a measured reason not to.
