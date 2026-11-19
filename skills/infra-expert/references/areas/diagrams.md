# Area: Diagrams

Draw a plain diagram when the user asks for a diagram, a flowchart, a map of the infrastructure, a view of the packages, or a picture of a request, deploy, or incident flow. This skill draws the diagram itself as Mermaid source and a self-contained HTML page, plus an SVG or PNG when a renderer is available. The diagram is a working artifact, not a designed poster. Read this file when a picture would answer the question faster than a table or a paragraph.

Nothing in this area changes a system. Every input is read from local files or earlier read-only scans. No host, cloud account, or repository file is written.

## When to draw

- **Asked for a picture:** "show me how the modules fit", "draw the request flow", "map our hosts", "which packages depend on which".
- **Asked for a simple infographic:** a labeled map or overview that explains one question. The skill draws it as a plain diagram.
- **While reviewing:** a graph makes a layer boundary, a copied module call, or a dependency cycle visible before the report is written.
- **While operating:** a small flow of a change or an incident timeline records the sequence of steps and decisions.

Do not draw by default. A short answer is better than a diagram when there is only one fact to report. Do not suggest another design skill for a plain diagram request; draw it here.

## Pick the subcommand

| Question | Subcommand | Input |
|---|---|---|
| Which roots call which modules, and which layer owns each folder? | `terraform` | JSON from [terraform_scan.py](../../scripts/scan/terraform_scan.py) with `--json` |
| How do Compose services connect to networks, ports, volumes, and each other? | `compose` | One or more Compose YAML or JSON files |
| Which workspace packages depend on each other? | `packages` | A directory to search for `package.json` and `pyproject.toml` files |
| How are hosts grouped and how is each one reached? | `hosts` | A Markdown table, for example `.gti/infra-expert/hosts.md` |
| What is the sequence of a request, deploy, or incident? | `flow` | A small YAML or JSON file based on [diagram-flow.example.yaml](../../assets/templates/diagram-flow.example.yaml) |

The [diagram.py](../../scripts/diagram/diagram.py) script implements all six subcommands and takes `--help`. Every subcommand accepts `--title`, `--out DIR`, `--direction LR|TB`, `--max-nodes N`, `--name`, and `--format svg|png`. `hosts` also accepts `--group-by group|kind`. The default direction is `TB`, the default node cap is 40, and the default file name is the subcommand name.

## Collect the input read-only

- **Scan first.** For a Terraform question, run the read-only scan and pass its JSON to `terraform`. The scan reads only files git tracks or would track, so gitignored secrets are never opened.
- **Read the knowledge folder.** For hosts and access paths, read `.gti/infra-expert/` at the nearest git root, starting with [hosts.md](../../assets/templates/project-knowledge/hosts.md). For a flow, write the small input file from the template using facts already in hand.
- **Stay read-only.** Never run `apply`, `destroy`, a deploy, or a write API to make a diagram. Do not ask the user to paste a credential. Labels are redacted automatically when they look like a password, token, API key, access key, or long token.
- **Keep the input outside the repository.** Put scan output and written flow files under `~/.gti/infra-expert/<project>/`, where `GTI_HOME` replaces `~/.gti`. The only repository file this skill reads for a diagram is the existing `.gti/infra-expert/` knowledge folder.

```bash
python3 <skill-dir>/scripts/scan/terraform_scan.py <repository> --json > ~/.gti/infra-expert/<project>/terraform-scan.json
python3 <skill-dir>/scripts/diagram/diagram.py terraform --scan ~/.gti/infra-expert/<project>/terraform-scan.json --title "Module graph" --direction LR
python3 <skill-dir>/scripts/diagram/diagram.py compose <compose-file> --name services
python3 <skill-dir>/scripts/diagram/diagram.py packages <directory> --name packages
python3 <skill-dir>/scripts/diagram/diagram.py hosts .gti/infra-expert/hosts.md --group-by group
python3 <skill-dir>/scripts/diagram/diagram.py flow <flow-file.yaml> --title "Request flow"
```

## Keep the diagram readable

- **One question per diagram.** A diagram that answers two questions is two diagrams.
- **Stay under about 40 nodes.** `--max-nodes 40` is the default; each group past the cap collapses into one `+N more` node, so the picture stays legible. Lower it for a chat attachment.
- **Group by layer or kind.** Terraform folders are grouped by their dominant resource layer; Compose services, networks, and volumes are separate groups; packages are grouped by ecosystem; hosts are grouped by the `Group` column or by `Kind`; flow nodes are grouped by lane.
- **Choose the direction.** Use `LR` for request flows and timelines read left to right, `TB` for layered stacks.
- **Check the source before showing it.** Read the `.mmd` file once to confirm the nodes, edges, and grouping answer the question. A wrong but pretty diagram is worse than no diagram.

## Where files go and how to show the result

Each run writes `<out>/<name>.mmd` and `<out>/<name>.html`. The page loads Mermaid from the same CDN as the review report and also shows the source as text, so it reads without network access. When `mmdc` is on PATH, `--format svg` or `--format png` also writes an image next to the two files; otherwise only the two files are written.

The default output folder is `~/.gti/infra-expert/<project>/diagrams/` (`GTI_HOME` replaces `~/.gti`), never the user's repository. Use `--out` only when the user names a place for the files.

- Give the absolute HTML path first, and name the `.mmd` source when the user wants to edit it.
- Attach the SVG or PNG in chat when the harness allows it. Do not open a browser tab just to show a diagram.
- In Autonomous Mode, write the files and report their paths; do not open a viewer.

## When to suggest the artdirector skill

The skill draws plain diagrams itself. Keep the Mermaid, HTML, SVG, or PNG output as the answer to a diagram request, including a request for a simple infographic or map.

Suggest the `artdirector` skill only when the user explicitly asks for a presentation, slides, or a designed infographic with a visual direction, a layout, or an export for sharing beyond a working diagram. In that case, hand over the Mermaid source and the plain facts behind it: the node and edge lists, the grouping, the title, and the exact figures. Let artdirector own the visual design from that input. Do not hand off an ordinary diagram request, and do not describe a plain infographic as an artdirector job.
