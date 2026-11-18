# Area: AWS account

A read-only audit of a live AWS account, followed by a plan to untangle it through code. You never change the account. Deletions, rule changes, and data moves are steps the user runs, through their pipeline or a runbook you write.

## Credentials

- Use read-only credentials: the `ReadOnlyAccess` or `SecurityAudit` managed policy, or a role with only describe, list, and get actions. If the profile can write, say so and continue read-only.
- Confirm the account with `aws sts get-caller-identity` and say the account ID and alias back to the user before collecting.
- Never type, print, or store access keys. Use the profile the user names.

## Collect and analyze

```bash
python3 <skill-dir>/scripts/aws/aws_collect.py --profile <profile> --regions <r1,r2> --out ~/.gti/infra-expert/<project>/aws-snapshot
python3 <skill-dir>/scripts/aws/aws_analyze.py ~/.gti/infra-expert/<project>/aws-snapshot
```

The snapshot holds network layout, names, and tags. Keep it in `~/.gti/infra-expert/<project>/` and tell the user where it is; offer to delete it at the end.

### Comparing with Terraform state

To find resources no code manages, pass every state of every stack that manages the account:

```bash
terraform -chdir=<root> show -json > ~/.gti/infra-expert/<project>/state-<root>.json
python3 <skill-dir>/scripts/aws/aws_analyze.py ~/.gti/infra-expert/<project>/aws-snapshot --tf-state ~/.gti/infra-expert/<project>/state-a.json --tf-state ~/.gti/infra-expert/<project>/state-b.json
```

State files contain secrets in plain text. Read them only with the user's permission, write them only to `~/.gti/infra-expert/<project>/`, never print their content, and delete them when the analysis is done. `terraform show -json` needs an initialized root with backend access; it does not lock or change state.

## What the findings mean

### Security groups

| Finding | Check before acting | Untangle |
|---------|---------------------|----------|
| Unused (attached to nothing, referenced by no group) | Launch templates, Auto Scaling groups, CloudFormation, and Terraform code that attaches it on create; ECS services scaled to zero | Remove it from the code that owns it; if no code owns it, add it to the runbook |
| Identical rules in one VPC | Whether the groups mean different roles that happen to match today | Keep one group per role. Move every attachment to it in code, then remove the others |
| Open to the internet beyond 80 and 443 | A load balancer or CDN in front, a VPN, a known office range | Replace `0.0.0.0/0` with the load balancer's group, a VPN group, a managed prefix list (for example the CDN's), or a fixed CIDR |
| 80 and 443 open to the internet behind a CDN | The CDN's published ranges | Restrict to the CDN prefix list so the origin cannot be reached around it |
| Default group with rules | What uses it | Move users to named groups and empty the default group (`aws_default_security_group` with no rules) |
| Raw IP /32 rules inside the VPC | Which instance owns the IP today | Refer to the instance's security group instead; IPs change, groups do not |

Untangling order for a cluster of duplicates: import unmanaged groups into the owning stack, add the kept group to every resource that had a duplicate, apply, then remove the duplicates from code, apply. Two plans, no moment without access.

### VPCs and network

- **Overlapping CIDRs**: block peering and transit routing. Not urgent until the VPCs need to talk; record it and plan new ranges before connecting them.
- **Empty VPCs**: check for endpoints, peering, Direct Connect, and VPN attachments before calling one unused.
- **Workloads in the default VPC**: its subnets are public by default. Move workloads into a VPC defined in code, then delete the default VPC's resources only after nothing uses them.
- **Idle NAT gateways**: billed hourly plus per GB. Also look at NAT traffic to S3 and DynamoDB; a gateway endpoint for each is free and removes that traffic.
- **Unattached Elastic IPs and EBS volumes**: billed while idle. Snapshot volumes whose data may matter before deletion.

### S3 buckets

- **Families that look like duplicates**: the analyzer groups names that match once environment, region, account, and numeric suffixes are removed. Confirm with sizes and object counts (`aws s3 ls s3://<bucket> --recursive --summarize`), writers (IAM and bucket policies naming the ARN, application config, CloudTrail data events if enabled), and readers. Merge by choosing a keeper and a prefix layout; the user copies the data and switches writers, then empties and deletes the old bucket.
- **Empty buckets**: check lifecycle rules that empty them on purpose and jobs that write occasionally.
- **Public or partially blocked buckets**: serve public files through CloudFront with origin access control and turn on all four public access block settings.
- **State and backup buckets without versioning**, **log buckets without lifecycle rules**: `code-only` or `live-change` fixes in the owning stack.

### Resources no code manages

For each one, decide the owner stack by layer (see [../concepts/layers.md](../concepts/layers.md)) and import it with an `import` block, or mark it for removal. Importing is a `state-move` when the code matches the live resource exactly; write the code from the live attributes and confirm with a plan that shows only the import.

## The runbook

Anything that cannot go through code (deleting an unmanaged resource nobody needs, moving bucket data) goes in a runbook for the user: one numbered step per command, the exact AWS CLI command, what to check before it, and how to undo it when undo is possible. Mark each deletion as irreversible. Never run these commands yourself.
