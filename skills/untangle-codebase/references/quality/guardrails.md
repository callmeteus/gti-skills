# Guardrails

A whole-codebase refactor is long and runs with little supervision. These rules keep it reversible and keep other people's code working.

## Never change without asking

These surfaces have users outside the code you can see. Changing their shape needs explicit approval, recorded in the log, even when the redesign calls for it:

- **Published APIs:** exports of a published package or library, public HTTP, GraphQL, or RPC routes and their payloads, webhooks, SDK interfaces.
- **Persisted data:** database schemas, migrations that already ran, serialized file formats, cache keys, message and event formats, anything stored and read back later.
- **Operator surfaces:** CLI commands, flags, and output that scripts parse; environment variables; configuration keys; log formats that alerts or dashboards read; metric names.
- **Integration points:** plugin and extension interfaces, feature flags read by other systems, URLs and routes users bookmark.
- **Generated and vendored code:** change the generator or the upstream, never the output.
- **Security controls:** authentication, authorization, input validation, and encoding. Moving them is allowed; weakening or skipping them on any path is not. When a fix moves a check, verify every path still passes through it.

Internal moves behind a stable surface are fine and need no approval.

## Stop and ask when

- Baseline tests fail and you cannot tell which failures are expected.
- A fix needs a product decision (which of two diverging copies is correct, whether a special case is still a requirement).
- Two copies of logic disagree and the tests do not say which behavior is intended. Never pick one silently; list both behaviors and ask.
- The scope grows past what the user named, for example a fix in one package needs changes in another team's package.
- You have made three attempts at one fix without a green suite.

Group questions into one message, keep working on fixes that do not depend on the answer, and record the open question in the log.

## Long-run discipline

- **Context:** the decision log is the memory. Update it before each commit. After a compaction or a new session, read the log and `git log --oneline <base>..HEAD` before anything else.
- **Budget:** if the user set a time or token budget, check it after each fix. When it runs out, finish the current fix, run the behavior check, and write the final report with what is left.
- **Reversibility:** every fix is its own commit on the untangle branch. Never rewrite history the user already has, never force-push, and never commit to the default branch.
