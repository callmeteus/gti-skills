# Toolchains

Fast default tools per ecosystem. They are defaults: keeping an old tool needs a measured reason, and every switch needs the side-by-side run from step 4. Confirm each command and flag exists in the installed version before planning around it; tool names and subcommands change between releases.

## JavaScript and TypeScript

The source prompt's stack, one tool for everything:

| Job | Default | Replaces |
|-----|---------|----------|
| Install and scripts | `bun install --frozen-lockfile`, `bun run` | npm, yarn, pnpm (remove their lockfiles and config) |
| Lint, under 1 s | `bun lint`, reading the existing `.oxlintrc.json`, every rule on that can be | ESLint, oxlint run separately |
| Format, under 1 s | `bun fmt` (check mode in CI) | Prettier, oxfmt run separately |
| Typecheck, under 5 s | `bun check` on TypeScript 7 | `tsc --noEmit` on older TypeScript |
| Tests, under 30 s per shard | `bun test`; test files keep their `vitest` imports | Vitest, Jest |

When the bun built-ins are not available in the installed version, the next fastest set is oxlint, oxfmt or Biome, `tsc` from TypeScript 7 (the native compiler), and Vitest with `--pool=threads`. Pin exact versions; if a tool only exists in a canary, pin that exact canary.

Watch for: Jest-only APIs without an equivalent (`jest.requireActual`, some module mocking), ESLint plugins with no oxlint rule (keep ESLint for only those rules, or write the rule up as a decision), snapshot format changes.

## Python

| Job | Default |
|-----|---------|
| Install | `uv sync --frozen` with the uv cache and `.venv` cached |
| Lint and format | `ruff check`, `ruff format --check` |
| Typecheck | The fastest checker that passes the side-by-side run (pyright, mypy with its cache, or newer Rust-based checkers) |
| Tests | `pytest -n auto` (pytest-xdist), `pytest-randomly` for random order, `--durations` and `--junitxml` for timings |

## Go

| Job | Default |
|-----|---------|
| Install | Module cache and build cache (`GOMODCACHE`, `GOCACHE`) restored from main |
| Lint | `golangci-lint run` with its cache; `gofmt -l` or `gofumpt` for format |
| Typecheck | `go vet ./...` (the build itself typechecks) |
| Tests | `go test -shuffle=on -p <cores> ./...`, `gotestsum --junitfile` for timings |

## Rust

| Job | Default |
|-----|---------|
| Install | `target/` dependencies cached (or sccache) keyed by `Cargo.lock` and toolchain |
| Lint and format | `cargo clippy -- -D warnings`, `cargo fmt --check` |
| Typecheck | `cargo check` |
| Tests | `cargo nextest run` with JUnit output and partitioning (`--partition hash:K/N` or by count) |

## JVM (Gradle, Maven)

| Job | Default |
|-----|---------|
| Install and build | Gradle with the build cache and configuration cache on, a remote build cache seeded from main; Maven with a cached local repository and `-T 1C` |
| Lint and format | Spotless or ktlint in check mode, Error Prone or Detekt |
| Tests | `maxParallelForks` matched to cores, JUnit XML for timings, test distribution by recorded times |

## .NET

| Job | Default |
|-----|---------|
| Install | NuGet packages folder cached by the lock file (`packages.lock.json`, `--locked-mode`) |
| Lint and format | `dotnet format --verify-no-changes`, analyzers at error level |
| Tests | `dotnet test` with parallel test assemblies, TRX or JUnit logger for timings |

## Ruby and PHP

| Job | Default |
|-----|---------|
| Ruby | `bundle install` with `vendor/bundle` cached, RuboCop with its cache, RSpec with `--order random` and parallel_tests or Knapsack-style timing |
| PHP | Composer `vendor/` cached, PHP-CS-Fixer or Pint in check mode, PHPStan with its result cache, Pest or PHPUnit with ParaTest |

## Proving a switch

1. Run old and new on the same commit and on a commit with known violations.
2. Normalize findings to `file:line:rule` and diff.
3. Close every gap: enable the rule, keep the old tool for only that rule, or record the user's decision.
4. Time both at least five runs each, warm and cold.
5. Put the comparison and the numbers in the pull request.
