# Step 3: write the HTML report

The report is a single HTML page the user reads in a browser. It is rendered by a script from a JSON file, so every report has the same layout and only the content varies. Write it for a developer who knows the codebase but has not read any software design books.

## Write the data file

Copy `<skill-dir>/assets/templates/report-data.example.json` to the OS temp folder and replace its content. Never write the data file or the report into the repository.

| Field | Contents |
|-------|----------|
| `lang` | `en` or `pt` for the page labels; use the user's language. For any other language, set `en` and translate the labels in `labels` |
| `labels` | Optional: overrides for page labels, keyed as in `LABELS` in `render_report.py` |
| `repo` | Repository name |
| `date` | Optional, `YYYY-MM-DD`; defaults to today |
| `scope` | What was reviewed, why, and what was not, from step 1 |
| `hotspots` | Optional: the `--json` output of `hotspots.py`, with an optional `note` |
| `candidates[].id` | Lowercase id with hyphens, used for links |
| `candidates[].title` | The change, as an action on real code: "Merge the order validation helpers into `OrderIntake.submit()`" |
| `candidates[].strength` | `strong`, `worth-exploring`, or `speculative` |
| `candidates[].effort` | `small`, `medium`, or `large` |
| `candidates[].testing` | `pure`, `local-stand-in`, `own-service`, or `third-party` |
| `candidates[].files` | Paths involved |
| `candidates[].problem` | One to three short sentences with numbers: what hurts today |
| `candidates[].change` | One to three short sentences: what to do |
| `candidates[].gains` | Three to five bullets, each a concrete effect on daily work |
| `candidates[].before`, `.after` | `{ "mermaid": "...", "caption": "..." }`; caption optional |
| `candidates[].adr_warning` | Optional: "Goes against ADR-0007 (...), but worth reopening: ..." |
| `top` | `{ "id": "...", "why": "..." }`: the candidate to start with and why, in one or two sentences |

Write the prose in the user's language and keep code names exactly as in the code. Wrap code names in backticks; the page renders them as code.

## Language

Follow [../concepts/plain-language.md](../concepts/plain-language.md). In short: name real files and functions, count things, describe the effect on daily work, and never use design-book words such as seam, deepen, shallow, leverage, locality, or adapter.

Good gains:

- "A new order field touches 1 file instead of 5"
- "Tests call `submit()` with SQLite instead of mocking 3 classes"
- "Delete 4 exported helpers and 11 tests"

Bad gains: "Better locality", "Cleaner code", "More maintainable", "Deeper module".

## Diagrams

Each candidate has a before and an after diagram in Mermaid. Keep them small: five to eight boxes.

- Use `flowchart LR` for call chains and `flowchart TB` when one module calls many.
- Boxes are real modules, files, or functions; arrows are calls or imports. Label an arrow only when it adds information ("HTTP + retries").
- Mark the problem in the before diagram and the new or merged module in the after diagram:

  ```text
  classDef problem stroke:#c62828,stroke-width:2px
  class R1,R2 problem
  classDef merged stroke:#16794a,stroke-width:3px
  class S merged
  ```

- Use a `sequenceDiagram` when the point is the number of round trips ("before: 6 calls, after: 1").
- Avoid subgraphs wider than three boxes; they shrink the diagram until it is unreadable.

## Render and open

```bash
python3 <skill-dir>/scripts/report/render_report.py <tmp>/architecture-review.json --strict --open
```

- The script validates the data and prints the path of the HTML file it wrote in the OS temp folder.
- `--strict` refuses to write the page when it finds design-book jargon and prints each word with its replacement. Fix the text and run again.
- `--open` opens the page in the default browser. Also give the user the absolute path.
- In Autonomous Mode (the user said "do it yourself" or "no need to ask me"), leave out `--open`: the page is still written, and its path goes in the final report.

## After the report

Do not propose detailed APIs yet. Ask the user which candidate they want to explore, in their language. In Autonomous Mode, do not ask: take the candidate with the highest strength (ties: the biggest gain for the least effort) and continue with step 4.
