# Dependencies: mocks, fakes, and Testcontainers

## Order of preference

1. **The real thing in process.** Your own modules, pure libraries, the file system in a temporary folder.
2. **The real thing in a container.** Databases, queues, caches, search engines, object storage, started by Testcontainers.
3. **A fake you own.** A small working implementation of an interface (an in-memory email outbox, a fake payment gateway) shared by all tests.
4. **A mock or stub.** Only for what cannot run in a test: third-party APIs, the clock, randomness, hardware.

## Why avoid mocks

- A mock encodes how the code calls a dependency today. Refactoring the call breaks the test while behavior is unchanged.
- A mock returns what the test author believes the dependency returns. Bugs in that belief (wrong SQL, a missing index, a constraint violation, a serialization mismatch) pass the test and fail in production.
- Agents copy mock setup into every new test, so mocks multiply and lock in the code they were written against.

## Testcontainers

Testcontainers starts a real service in Docker for the test run and removes it afterward. It has libraries for Java, Go, .NET, Node.js, Python, Rust, and more.

- Start one container per test run or per suite, not per test, and isolate tests by data: a transaction rolled back after each test, a unique schema, or unique keys.
- Run the project's real migrations against the container. Never create tables by hand in the test.
- Pin the image version to the one used in production (`postgres:16`, not `postgres:latest`).
- Reuse the project's existing container helper if there is one.
- If Docker is not available, say so. Ask before falling back to an in-memory substitute such as SQLite for Postgres, and list the behaviors that substitute cannot check.

## Mocking third parties well

- Mock at the network boundary, not inside your own code: an HTTP-level stub (MSW, WireMock, `responses`, `httptest`) instead of mocking your own client class.
- Assert on what your system did with the response (stored the payment status, showed the error), not on how many times the client was called.
- Keep stub responses in fixture files that match the provider's real format.

## Time and randomness

- Inject a clock or use the test runner's fake timers. Never `sleep` to wait for time to pass.
- Seed random generators and log the seed on failure.

## Check

- No mock of a module the team owns.
- Every remaining mock is at a boundary the team does not control, with a one-line reason.
