# Step 1: Discover

## Goal

Know the test stack and the public surface before writing a single test. New tests must look like the project's best existing tests and reuse its helpers.

## Find the stack

| Look for | Tells you |
|----------|-----------|
| `package.json` scripts and devDependencies (`vitest`, `jest`, `mocha`, `@playwright/test`, `testcontainers`) | JavaScript or TypeScript runner and tools |
| `pyproject.toml`, `pytest.ini`, `conftest.py`, `tox.ini` | pytest, fixtures, `testcontainers`, `hypothesis` |
| `pom.xml`, `build.gradle` | JUnit, Testcontainers, jqwik, PIT |
| `go.mod`, `*_test.go` | `go test`, `testcontainers-go`, `rapid` |
| `Cargo.toml`, `tests/` | `cargo test`, `proptest`, `cargo-mutants` |
| `*.csproj` | xUnit or NUnit, Testcontainers for .NET, FsCheck, Stryker.NET |
| `docker-compose*.yml`, CI workflow files | Services the tests already depend on and how CI runs them |

Run the existing suite once (or the relevant subset) and note how long it takes and whether it passes. Do not start from a red suite without telling the user.

## Find the helpers

- Test app factories, fixtures, builders, and seed data.
- Existing container setup (a shared Postgres container, a Redis fixture).
- Existing fakes for third-party services.
- Page objects or locator helpers for UI tests.

Reuse them. Do not add a second way to start the database or build a user.

## Find the public surface

List what callers actually use, because tests couple to this and nothing else:

- Exported functions and classes of the module (its index or package entry point).
- HTTP routes, GraphQL operations, RPC methods, message handlers.
- CLI commands and their output.
- UI screens and the actions a user takes on them.

Private functions, internal classes, and file layout are not on this list.

## Check

- You can name the runner, the command to run one test, and the helpers you will reuse.
- You can list the behaviors to test as user-visible statements ("an empty cart cannot be ordered"), not as function names.
