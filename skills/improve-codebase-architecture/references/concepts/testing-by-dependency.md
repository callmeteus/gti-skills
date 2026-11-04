# How to test a merged module, by dependency type

Classify what the module depends on before proposing a refactor. The type decides how the merged module is tested, and each candidate in the report gets one of these four tags.

| Tag in the report | Dependency | How to test |
|-------------------|------------|-------------|
| `Pure code` | Computation and in-memory state, no I/O | Merge the modules and test the new public API directly. No fakes needed. |
| `Local stand-in` | Something with a local replacement: SQLite or PGLite for Postgres, an in-memory filesystem, a Testcontainers database | Run the stand-in in the test suite. Keep the swap internal; callers do not see it. |
| `Own service` | Your own service over the network: an internal HTTP API, gRPC, a queue | Define a small client interface, pass it in, and write two implementations: the HTTP or queue client for production and an in-memory fake for tests. |
| `Third-party API` | A service you do not control: Stripe, Twilio, an LLM provider | Pass the client in and mock it in tests at that one point. |

Example recommendation for an own service: "Define a `PaymentsClient` interface. Use the HTTP client in production and an in-memory fake in tests, so the payment logic lives in one module even though the payment service runs elsewhere."

## Rules for injection points

- **Two implementations or none.** Add an injection point only when there will be at least two implementations, usually production and test.
- **Keep internal swaps internal.** A module may swap its own internals in its own tests without exposing that option to callers.

## Replace the old tests, do not stack new ones on top

- Once tests exist at the merged module's public API, the old unit tests on the thin wrappers are redundant; delete them as part of the refactor.
- New tests call the public API and assert on what callers can observe: return values, stored records, emitted events.
- A good test survives an internal refactor. If a test breaks when the internals change but the behavior did not, it is reaching past the API.
