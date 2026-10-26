# Command semantics

Invoke every command through `scripts/artdirector.cmd` (Windows) or `scripts/artdirector` (Unix) next to this skill. Do not search npm or npx cache.

These names overlap Impeccable on purpose. Meanings here are graphic design, not app UI.

| Command | Agent does | CLI / server |
|---|---|---|
| `init` | Confirm name/brand | Writes `.artdirector/` |
| `brief` | Fill only gaps | `brief --goal --audience --category --format` |
| `shape` | Offer 3 rendered directions | `shape --direction` |
| `craft` | Write one complete HTML piece, then stop | Register variant |
| `generate` | Write 2-4 real HTML variants and hand them over | Template fill or agent HTML |
| `live` | Poll only after the user acts | `studio --open` |
| `critique` | Answer quality prompts when asked | Prints floor + prompts |
| `audit` | Run only after accept or an explicit ask; report, do not silently rewrite | Playwright inspection |
| `polish` | Last pass on **accepted** HTML, not the first draft | Live action |
| `bolder` / `quieter` / `typeset` / `colorize` / `layout` / `distill` | Edit the selected element or whole board | Live actions |
| `adapt` | Duplicate HTML at a new size | New variant |
| `export` | Do not fake files | PNG/JPEG via ClickClick when available, else Playwright; PDF/SVG via Playwright |
| `resume` | Read session, pending events | `resume --json` |
