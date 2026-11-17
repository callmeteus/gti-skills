# Step 2: scan

Run the scanners for the area. They are read-only, use only the Python standard library, and print text by default or JSON with `--json`. Write JSON output to the OS temp folder, never into the repository.

| Area | Commands |
|------|----------|
| terraform | `terraform_scan.py <repo>` |
| grafana | `grafana_scan.py <repo>`, plus `terraform_scan.py` when dashboards or alerts are `grafana_*` resources |
| aws | `aws_collect.py`, then `aws_analyze.py`; plus `terraform_scan.py` on the repository that should own the account |
| general | every scanner whose stack step 1 found |
| other stacks | no scanner; read the files with the checks in [../areas/other-stacks.md](../areas/other-stacks.md) |

## Terraform

```bash
python3 <skill-dir>/scripts/scan/terraform_scan.py <repo> --json > <tmp>/terraform-scan.json
python3 <skill-dir>/scripts/scan/terraform_scan.py <repo>
```

The text output lists every folder with its role (root, module, unused module), kind (helper, shared base), resources per layer, and callers, then the findings. When the tools are installed and the user allows it, also run checks that do not touch state:

```bash
terraform fmt -check -recursive <repo>
terraform -chdir=<root> init -backend=false -input=false && terraform -chdir=<root> validate
```

`init -backend=false` downloads providers into `.terraform/` in that root; it does not read or lock state.

## Grafana

```bash
python3 <skill-dir>/scripts/scan/grafana_scan.py <repo> --json > <tmp>/grafana-scan.json
```

Pass `--extends-key` when the repository's inheritance key is not `$extends`. Lower `--threshold` (default 0.7) to find drifted copies, raise it to see only near-identical ones.

## AWS

```bash
python3 <skill-dir>/scripts/aws/aws_collect.py --profile <profile> --regions <r1,r2> --out <tmp>/aws-snapshot
python3 <skill-dir>/scripts/aws/aws_analyze.py <tmp>/aws-snapshot
python3 <skill-dir>/scripts/aws/aws_analyze.py <tmp>/aws-snapshot --tf-state <tmp>/state-a.json --tf-state <tmp>/state-b.json
```

The collector refuses any operation that is not describe, list, or get. Failed calls (usually missing permissions) are listed in `manifest.json`; say which checks they leave out. The `--tf-state` comparison is only meaningful with the states of every stack that manages the account; with fewer, "not managed" means "not in these states". How to get the states safely is in [../areas/aws.md](../areas/aws.md).

## Read before you trust

Every scan line is a lead. Before it becomes a finding:

- Open the file or resource and confirm it. A "copied block" may be two rules that should look alike; a "hardcoded ID" may sit in an `import` block where it belongs.
- Look for the reason in comments, READMEs, and ADRs. Infrastructure code often explains a strange choice right next to it; a documented, still-valid reason drops the lead.
- For live resources, look for users the snapshot cannot see: launch templates, CloudFormation stacks, other accounts, DNS records, application config.

Keep a short list of confirmed findings with counts and file or resource references; step 3 builds candidates from it, and the report's `scan` table summarizes it.
