# Step 2: List Every Problem

Do not change anything yet.

## Map first

Get the whole codebase into view before judging any part of it:

```bash
python3 <skill-dir>/scripts/map/skeleton.py . > .untangle/skeleton.txt
python3 <skill-dir>/scripts/map/deps.py . --depth 2
python3 <skill-dir>/scripts/map/deps.py . --depth 0 --json > .untangle/deps-files.json
python3 <skill-dir>/scripts/map/cochange.py . --cross-folder-only
python3 <skill-dir>/scripts/measure/special_cases.py . --list
```

- **Skeleton:** read it end to end. It shows every type and signature with line numbers. Use `--body-depth 1` for brace languages when one level of bodies helps.
- **Import graph:** start with folders (`--depth 2` or `1`), then drill into files. For JS or TS path aliases, pass `--alias @/=src/`. Languages it cannot resolve are listed; read their imports by hand.
- **Co-change:** pairs that change together across folders are the strongest hidden-link leads Git can give.
- **Summaries:** with sub-agents, give each one a part of the codebase and ask for a short summary: what it owns, what it reads from elsewhere, what it assumes about callers, and every special case with `file:line`. Merge the summaries so you can reason across all of it at once.
- **Leverage:** start reading where the most problems meet: high fan-in modules, cycles, the most changed files, and the files with the most special-case markers.

## Ask one question

Go through the codebase asking one thing: **should these pieces change together?** Write down every place the code gets the answer wrong. There are only three ways to get it wrong.

### Hidden links

Pieces that must change together, where the code does not show it.

- **Copies of logic or values:** change one and the others must change too, but nothing says so.
- **Shared mutable state:** a module reads a global, singleton, environment variable, or file set by another module. Change that module and this one breaks, but nothing shows it (self-contained code).
- **Split features:** a feature split across folders by layer, or related code in different folders. One change needs all of them, but the layout hides that (domain-driven code, colocation).
- **Unwritten protocols:** a call order or convention callers just have to know. Change it and callers break, but nothing warns them (explicit over implicit).

Evidence: co-change pairs, duplicated literals and blocks, parallel `switch` statements over the same set of values, files named alike in different layer folders.

### Needless links

Pieces tied together that change for different reasons.

- **Callers depend on internals:** the internals change for their own reasons, and the callers break anyway (encapsulation).
- **Stable code imports volatile code:** the stable code has to change whenever the volatile code does (dependency direction). `deps.py` lists these from git history.
- **Caller vocabulary in general code:** a general function has a parameter only one workflow understands, so it changes whenever that workflow does.
- **Shallow modules:** the interface changes whenever the internals do, so callers change with it (deep modules).

Evidence: cycles, imports of private or internal paths, flags passed through several layers, wide interfaces with one caller.

### Surplus

Pieces with no reason of their own to change.

- **Pass-through wrappers:** they only change when the thing they wrap does.
- **Speculative generality:** extension points and config for things that never vary.
- **Dead code:** nothing uses it, so nothing will ever need it to change. Confirm with a search across the whole repository, including tests, scripts, configuration, reflection, and string-based lookups, before listing it.

### Special cases

Also write down every special case: code that exists for one situation instead of following from how the system works. Each one is a requirement the design never accounted for, so use them to work out what the system needs to be.

- An `if` for one value
- A parameter for a specific caller
- A swallowed exception
- A retry or sleep
- A disabled test

`special_cases.py --list` finds the textual signs; you decide which are real special cases.

## Write it down

Add every problem to the "Problems" section of `.untangle/decision-log.md`, one line each, starting with `file:line`, as in `assets/examples/decision-log-example.md`. Describe what is wrong, not the fix. Tag each line with its kind: `[hidden]`, `[needless]`, `[surplus]`, or `[special]`.

The list is complete when every part of the scope has been read or summarized and every script lead has been either listed or dismissed. Write dismissed leads briefly under "Leads dismissed" so later rounds do not re-check them.
