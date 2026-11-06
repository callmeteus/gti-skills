# Step 1: Ask and Prepare

## Ask

Ask everything in one message, then wait for the answer. Do not start mapping before it.

1. **Optional additions.** Besides untangling the codebase, there are two other things you may do. List them with these exact descriptions and ask which ones to do. Then do only those.

   | Addition | What it does |
   | --- | --- |
   | **Comments** | Remove comments that only restate the code. |
   | **Tests** | Remove tests that wouldn't catch a real bug, and fix the ones that fail without one. |

2. **Scope.** The whole repository, or the area the user named. In a monorepo, name the packages you will touch.
3. **Public surfaces.** Confirm which surfaces other code or people depend on and must not change shape without approval: published package exports, HTTP or RPC APIs, CLI flags and output, database schemas and migrations, file and wire formats, environment variables, configuration keys. Propose a list from what you see; the user corrects it. See `references/quality/guardrails.md`.
4. **Decision log.** Whether `.untangle/` should be committed (useful for review and later runs) or added to `.gitignore`.

If the user already answered any of these in the request, do not ask again.

## Prepare

1. **Clean start.** Run `git status`. If there are uncommitted changes, stop and ask the user to commit or stash them; never mix their work with the refactor.
2. **Branch.** Create a branch such as `untangle/<date>` from the current HEAD. Record the base commit in the log.
3. **Baseline tests.** Find the project's test, type-check, lint, and build commands (package scripts, Makefile, CI workflow, README). Run them and record the exact commands, the pass and fail counts, and the duration in the log.
   - If tests already fail at baseline, record which ones. Those failures are not yours to fix unless a structural fix fixes them; never let the number of failures grow.
   - If there is no test suite, or it cannot run locally, say so and ask whether to continue. If the user agrees, the first fixes are characterization tests around the areas you will move.
4. **Baseline measurements.** From the project root:

   ```bash
   python3 <skill-dir>/scripts/measure/special_cases.py . --save .untangle/baseline.json
   python3 <skill-dir>/scripts/map/deps.py . --json > .untangle/deps-before.json
   ```

   Use `python` or `py -3` on Windows. Note the special-case total, cycle count, and volatile-import count in the log.
5. **Start the log.** Copy `assets/templates/decision-log.md` to `.untangle/decision-log.md` and fill in the header: scope, chosen additions, public surfaces, base commit, baseline commands and results, baseline measurements.
