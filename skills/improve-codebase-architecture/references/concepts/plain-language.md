# Plain language for architecture findings

The analysis uses a few precise ideas about module design. The report and the conversation must express them in the words developers use every day. A reader who knows how to code, but has never read a book on software design, must understand every sentence on the first read.

## The ideas behind the analysis

| Idea | What it means | Say it like this |
|------|---------------|------------------|
| Public API | Everything a caller must know to use a module: function signatures, required config, call order, errors it throws, performance traps | "public API", "what callers need to know" |
| Thin module | The public API is about as big as the code behind it; it mostly forwards calls | "thin wrapper", "pass-through", "adds a file but no logic" |
| Module that pulls its weight | A small public API hides a lot of logic | "small API, lots of logic inside", "one call does the whole job" |
| Logic in one place | A change, a bug fix, or a test lives in one module instead of spreading across callers | "the logic lives in one place", "a change touches one file" |
| Callers do less | Each caller writes less glue code and knows fewer details | "callers stop repeating X", "one call instead of four" |
| Swap point | A place where the implementation can be replaced without editing the callers | "injection point", "where you pass in the real client or a fake" |
| Implementation behind a swap point | A concrete class or function that fills that slot | "the Postgres implementation", "the in-memory fake" |
| Merge test | Imagine deleting the module and inlining it into its callers | "if we inline it, does code repeat in N callers, or does nothing change?" |

## Words that must not appear in the report

These come from design books and confuse readers. Each has a plain replacement. `scripts/report/render_report.py` warns when it finds them.

| Do not write | Write instead |
|--------------|---------------|
| deepening, deepen | merge, consolidate, pull the logic into |
| deep module | module with a small API and lots of logic inside |
| shallow module, shallow | thin wrapper, pass-through module |
| depth | how much a module does per thing callers must learn; usually just drop it |
| seam | injection point, swap point, the place where X is passed in |
| adapter | implementation, client, fake |
| port, ports and adapters | an interface you inject, with a real and a fake implementation |
| leverage | callers do more with less code |
| locality | the logic lives in one place |
| in-process dependency | pure code, no I/O |
| local-substitutable | has a local stand-in, such as SQLite, an in-memory filesystem, or a Docker container |
| test surface | what the tests call |
| mass diagram, cross-section | before and after diagram |

Everyday terms such as API, interface, service, component, layer, wrapper, boundary, helper, class, function, and module are all allowed. Use the one the codebase itself uses.

## Rules for every sentence

- **Name real code.** Write `OrderValidator`, `src/orders/intake.ts`, and `checkout()`, not "the validation concern".
- **Use the project's own words** for business concepts. If the code and `GLOSSARY.md` say "Order", write "Order", not "purchase".
- **Count things.** "Adding a discount touches 5 files" beats "changes are scattered".
- **Show the effect on daily work.** Fewer files to open, fewer mocks in a test, one place to fix a bug, less code to read before a change.
- **Short sentences.** One idea per sentence. No "it is worth noting that".
- **No vague praise.** Do not write "cleaner", "more maintainable", or "better architecture" without saying what concretely changes.

## Examples

| Jargon | Plain |
|--------|-------|
| "Order intake module is shallow: interface nearly matches the implementation." | "`OrderIntake` only forwards calls to three helpers; its API is as big as its code." |
| "Pricing leaks across the seam." | "Callers of `OrderRepo` compute prices themselves, so pricing logic is copied in 4 places." |
| "Deepen: one interface, one place to test." | "Merge the helpers into `OrderIntake.submit()`; tests call that one function." |
| "Two adapters justify the seam: HTTP in prod, in-memory in tests." | "Pass the payments client in: the HTTP client in production, an in-memory fake in tests." |
| "Locality: bugs concentrate in one module." | "Validation bugs get fixed in one file." |
