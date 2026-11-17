# Plain language for infrastructure findings

The report is read by the people who run the infrastructure, often in a hurry. Every sentence names real resources, counts things, and says what changes in daily work or in risk.

## Rules for every sentence

- **Name real things.** `services/idtfy/main.tf`, `aws_security_group.web`, `sg-0abc (app/web)`, `dashboards/tenants/acme/overview.json`. Not "the compute layer" or "some security groups".
- **Count.** "The VPC ID is typed in 14 files", "6 hosts repeat the same 70 lines", "3 groups have identical rules".
- **Say the effect.** Fewer files to edit for a new host, one place to rotate a key, a plan that touches one stack, a port no longer open to the internet, a bill line that goes away.
- **Say the risk plainly.** "The plan replaces the instance; the app is down for about two minutes" beats "some disruption may occur".
- **Short sentences.** One idea per sentence.
- **Use the repository's words** for products, tenants, and environments.

## Everyday infrastructure words are fine

Stack, root, leaf, module, base, helper, state, backend, plan, apply, drift, import, moved block, lookup, tag, security group, rule, CIDR, NAT, endpoint, bucket, prefix, lifecycle rule, blast radius, owner, dashboard, panel, alert rule, datasource, template variable, recording rule.

## Vague claims

`scripts/report/render_report.py` warns about these and `--strict` refuses them. Each one hides what actually changes.

| Do not write | Write instead |
|--------------|---------------|
| best practices, boas práticas | the concrete rule and what it prevents: "pin providers so a new release cannot change the plan on its own" |
| cleaner, mais limpo | what a reader no longer opens: "a new host is one module call instead of 70 lines in 4 files" |
| more maintainable | the files a change touches, before and after |
| robust | which failure it survives |
| scalable, escalável | what grows and what stays the same size: "a new tenant is one map entry" |
| seamless | the step that goes away |
| modernize | what the new version does that the old one does not |

## Examples

| Vague | Plain |
|-------|-------|
| "Security groups don't follow best practices." | "`app/web` opens port 22 to `0.0.0.0/0` and is attached to 3 running instances." |
| "Consolidate buckets for a cleaner setup." | "`acme-exports` and `acme-exports-2` hold the same daily files; one writer uses each. Merge into `acme-exports` with a `v2/` prefix." |
| "Refactor hosts into a more maintainable module." | "Create `bases/vm-host`; each of the 6 hosts becomes one 15-line call, and the KMS key is set in one place instead of 7." |
