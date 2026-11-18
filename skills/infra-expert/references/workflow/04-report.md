# Step 4: write the HTML report

The report is one HTML page, rendered by a script from a JSON file, so every review has the same layout. Write it for someone who runs this infrastructure but did not do the review.

## Write the data file

Copy `<skill-dir>/assets/templates/report-data.example.json` to `~/.gti/infra-expert/<project>/` and replace its content. Never write the data file or the report into the repository.

| Field | Contents |
|-------|----------|
| `lang` | `en` or `pt` for page labels; use the user's language. For any other language, set `en` and translate the labels in `labels` |
| `labels` | Optional overrides for page labels, keyed as in `LABELS` in `render_report.py` |
| `repo` | Repository name, or the account alias for the aws area |
| `area` | `general`, `terraform`, `aws`, `grafana`, `kubernetes`, `docker`, `ci`, or `other` |
| `date` | Optional, `YYYY-MM-DD`; defaults to today |
| `scope` | What was reviewed, why, and what was not, from step 1 |
| `scan` | Optional rows `{ "finding", "count", "example" }` summarizing the confirmed scan findings from step 2 |
| `hotspots` | Optional: the `--json` output of `hotspots.py`, with an optional `note` |
| `candidates[].id` | Lowercase id with hyphens, used for links |
| `candidates[].title` | The change as an action on real code: "Create `bases/vm-host` and move the 6 hosts onto it" |
| `candidates[].strength` | `strong`, `worth-exploring`, or `speculative` |
| `candidates[].effort` | `small`, `medium`, or `large` |
| `candidates[].layer` | `foundation`, `network`, `storage`, `data`, `identity`, `compute`, `observability`, `delivery`, or `several` |
| `candidates[].risk` | `code-only`, `state-move`, `replace`, or `live-change` |
| `candidates[].verify` | Optional: how to verify this candidate, when the default text for its risk is not specific enough |
| `candidates[].files` | Paths and resource IDs involved |
| `candidates[].problem` | One to three short sentences with numbers |
| `candidates[].change` | One to three short sentences |
| `candidates[].gains` | Three to five bullets, each a concrete effect |
| `candidates[].before`, `.after` | `{ "mermaid": "...", "caption": "..." }`; caption optional |
| `candidates[].warning` | Optional: an ADR or project rule it goes against, or a dependency the user must check |
| `top` | `{ "id": "...", "why": "..." }`: the candidate to start with and why |

Write prose in the user's language, follow [../concepts/plain-language.md](../concepts/plain-language.md), and wrap names in backticks so the page renders them as code. Never put secrets, tokens, or private keys in the data file; resource IDs and names are fine.

## Diagrams

Each candidate has a before and an after diagram in Mermaid, five to eight boxes each.

- Boxes are stacks, modules, files, or cloud resources; arrows are module calls, references, attachments, or traffic.
- `flowchart LR` for "who uses what", `flowchart TB` when one base serves many services.
- For network candidates, draw the traffic: source, security group, destination, and the port on the arrow.
- Mark the problem in red in the before diagram and the new or merged piece in green in the after diagram:

  ```text
  classDef problem stroke:#c62828,stroke-width:2px
  class A,B problem
  classDef merged stroke:#16794a,stroke-width:3px
  class C merged
  ```

- Show the same callers in both diagrams so the difference is visible at a glance.

## Render and open

```bash
python3 <skill-dir>/scripts/report/render_report.py ~/.gti/infra-expert/<project>/infra-review.json --strict --open
```

- The script validates the data and prints the path of the HTML file it wrote in `~/.gti/infra-expert/<project>/`.
- `--strict` refuses to write the page when it finds vague claims and prints each with what to write instead. Fix the text and run again.
- `--open` opens the page in the default browser. Also give the user the absolute path. In Autonomous Mode leave out `--open`.

## After the report

Ask the user which candidate they want to explore, in their language. Do not design interfaces or write code yet. In Autonomous Mode, take the candidate with the highest strength, then the lowest risk, then the biggest gain for the least effort, and continue with step 5.
