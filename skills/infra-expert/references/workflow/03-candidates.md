# Step 3: collect candidates

Map the repository onto the layout model in [../concepts/layers.md](../concepts/layers.md), then group the confirmed findings into three to six changes worth making. Use a subagent with a fresh context when the agent supports one, so the main conversation keeps only the findings.

## Map first

Write down, for the area in scope:

- the helpers, bases, services, temporary services, generated files, and environment values, with paths;
- the layer of each stack, and where one stack spans several layers;
- who owns each shared resource (a VPC, a security group, a datasource, a bucket): which stack, which repository, or nobody (created by hand).

The map is the frame for the report's diagrams and the answer to "where would a new X go?". If that answer is unclear, that is a finding.

## Questions to answer

- **Missing base:** which services repeat the same blocks? How many lines and files would one base remove? What do the copies disagree on, and is the disagreement on purpose?
- **Wrong kind:** which helpers create resources, which "modules" only return values, which temporary things have no expiry, which generated files are edited by hand?
- **Copied values:** which IDs, ARNs, CIDRs, UIDs, or URLs are typed in several places? Which lookup or shared file should own each one?
- **Split ownership:** which resources or attachments are written by two stacks, two repositories, or code plus the console?
- **Upside-down dependencies:** where does a lower layer know about upper ones (a network stack listing every service's instance)?
- **Leftovers:** placeholder roots, unused modules, half-done renames, dead receivers, idle cloud resources.
- **Exposure and cost:** open ports, public buckets, idle NAT gateways, unattached IPs and volumes.
- **Missing guard rails:** no version pins, no `fmt`, `validate`, or lint in CI, no plan on pull requests.

## What to record per candidate

| Field | Example |
|-------|---------|
| Files and resources | `services/idtfy/main.tf`, `services/harbor/main.tf`, 4 more |
| What is wrong, with numbers | "6 hosts repeat 70 lines: instance, Elastic IP, security group, setup key; the KMS ARN is typed 7 times" |
| What to change | "Create `bases/vm-host` and move each host onto it with `moved` blocks" |
| What gets better, with numbers | "A new host is one 15-line call; the KMS key is set in 1 place" |
| Layer | foundation, network, storage, data, identity, compute, observability, delivery, or several |
| Risk | `code-only`, `state-move`, `replace`, or `live-change`; see below |
| Effort | small (hours), medium (a day or two), large (more) |
| Strength | strong, worth exploring, or speculative |
| Conflict | An ADR or project rule it goes against, and why it is worth reopening |

## Risk

Risk is what the change does to running infrastructure once applied, judged by what the plan would show.

| Risk | The plan shows | Examples |
|------|----------------|----------|
| `code-only` | No changes | Rename locals, add descriptions and validation, replace a hardcoded ID with a lookup that returns the same ID, add CI checks |
| `state-move` | Only moves, imports, or removals from state | Extract a base with `moved` blocks, import hand-made resources, split a root with `removed` plus `import` |
| `replace` | Resources destroyed and created again | Changing a field that forces replacement, renaming a security group without `create_before_destroy` |
| `live-change` | In-place changes to running resources, or deletions | Closing an open port, merging duplicate security groups, deleting idle resources, moving bucket data |

Pick the lowest risk that achieves the change, and say in the candidate when a `state-move` version exists for something that looks like a `replace`.

## Filter the list

- Keep three to six candidates. Rank strong, low-risk, high-gain ones first.
- Drop candidates that only move files around without changing what a reader or a plan has to deal with.
- Drop candidates that a project rule or ADR rules out, unless the pain is real; then keep it and fill the conflict field.
- Do not design module interfaces or write HCL yet. Name the change in one sentence; the design comes after the user picks.
