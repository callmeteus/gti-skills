"""Collect a read-only snapshot of an AWS account for aws_analyze.py.

It runs the AWS CLI with describe-, list-, and get- operations only, and
refuses any other operation, so it cannot change the account. It saves one
JSON file per call:

  <out>/manifest.json                 account, regions, time, errors
  <out>/global/<service>-<op>.json    STS identity, S3 bucket list
  <out>/global/s3/<bucket>.json       per-bucket settings and an emptiness check
  <out>/<region>/<service>-<op>.json  VPCs, subnets, security groups, ENIs, ...

The output holds resource names, tags, and network layout. Write it to the OS
temp folder, never into a repository.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

READ_ONLY = re.compile(r"^(describe|list|get)-[a-z0-9-]+$")

REGIONAL = [
    ("ec2", "describe-vpcs"),
    ("ec2", "describe-subnets"),
    ("ec2", "describe-security-groups"),
    ("ec2", "describe-network-interfaces"),
    ("ec2", "describe-route-tables"),
    ("ec2", "describe-internet-gateways"),
    ("ec2", "describe-nat-gateways"),
    ("ec2", "describe-vpc-peering-connections"),
    ("ec2", "describe-vpc-endpoints"),
    ("ec2", "describe-addresses"),
    ("ec2", "describe-volumes"),
    ("ec2", "describe-instances"),
    ("elbv2", "describe-load-balancers"),
    ("rds", "describe-db-instances"),
    ("lambda", "list-functions"),
]

BUCKET_CALLS = [
    ("tagging", "get-bucket-tagging", []),
    ("versioning", "get-bucket-versioning", []),
    ("public_access_block", "get-public-access-block", []),
    ("policy_status", "get-bucket-policy-status", []),
    ("lifecycle", "get-bucket-lifecycle-configuration", []),
    ("encryption", "get-bucket-encryption", []),
    ("first_object", "list-objects-v2", ["--max-items", "1", "--page-size", "1"]),
]

ABSENT = ("NoSuchTagSet", "NoSuchLifecycleConfiguration", "NoSuchPublicAccessBlockConfiguration",
          "ServerSideEncryptionConfigurationNotFoundError", "NoSuchBucketPolicy")


class Aws:
    def __init__(self, binary, profile):
        self.binary = binary
        self.profile = profile
        self.errors = []

    def call(self, service, operation, args=(), region=None, quiet=()):
        if not READ_ONLY.match(operation):
            raise SystemExit(f"refusing non read-only operation: {service} {operation}")
        command = [self.binary, service, operation, *args, "--output", "json", "--no-cli-pager"]
        if self.profile:
            command += ["--profile", self.profile]
        if region:
            command += ["--region", region]
        env = {**os.environ, "AWS_PAGER": ""}
        result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
        if result.returncode == 0:
            return json.loads(result.stdout or "{}")
        message = result.stderr.strip()
        code = next((name for name in quiet if name in message), None)
        if code:
            return {"absent": True, "code": code}
        self.errors.append({"call": f"{service} {operation}", "region": region, "error": message[:500]})
        return {"error": message[:500]}


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def bucket_region(aws, name):
    location = aws.call("s3api", "get-bucket-location", ["--bucket", name])
    if "error" in location:
        return None
    return location.get("LocationConstraint") or "us-east-1"


def collect_bucket(aws, out, bucket):
    name = bucket["Name"]
    region = bucket_region(aws, name)
    record = {"name": name, "created": bucket.get("CreationDate"), "region": region}
    if region:
        for key, operation, extra in BUCKET_CALLS:
            record[key] = aws.call("s3api", operation, ["--bucket", name, *extra], region=region, quiet=ABSENT)
    save(out / "global" / "s3" / f"{name}.json", record)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default=None, help="Output folder (default: a new folder in the OS temp folder)")
    parser.add_argument("--profile", default=None, help="AWS CLI profile (default: the CLI default chain)")
    parser.add_argument("--regions", default=None, help="Comma-separated regions (default: the profile region)")
    parser.add_argument("--all-regions", action="store_true", help="Collect every region enabled in the account")
    parser.add_argument("--skip-s3", action="store_true", help="Skip S3 buckets")
    parser.add_argument("--workers", type=int, default=8, help="Parallel AWS CLI calls (default 8)")
    parser.add_argument("--aws", default="aws", help="AWS CLI binary (default: aws on PATH)")
    args = parser.parse_args()

    out = Path(args.out) if args.out else Path(tempfile.mkdtemp(prefix="infra-expert-aws-"))
    aws = Aws(args.aws, args.profile)

    identity = aws.call("sts", "get-caller-identity")
    if "error" in identity:
        raise SystemExit(f"cannot reach AWS: {identity['error']}")
    save(out / "global" / "sts-get-caller-identity.json", identity)

    if args.all_regions:
        found = aws.call("ec2", "describe-regions")
        regions = sorted(r["RegionName"] for r in found.get("Regions", []))
    elif args.regions:
        regions = [r.strip() for r in args.regions.split(",") if r.strip()]
    else:
        configured = subprocess.run([args.aws, "configure", "get", "region", *(["--profile", args.profile] if args.profile else [])],
                                    capture_output=True, text=True).stdout.strip()
        regions = [os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or configured or "us-east-1"]

    jobs = [(region, service, operation) for region in regions for service, operation in REGIONAL]
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        def run(job):
            region, service, operation = job
            save(out / region / f"{service}-{operation}.json", aws.call(service, operation, region=region))
        list(pool.map(run, jobs))

        buckets = []
        if not args.skip_s3:
            listing = aws.call("s3api", "list-buckets")
            save(out / "global" / "s3api-list-buckets.json", listing)
            buckets = listing.get("Buckets", [])
            list(pool.map(lambda bucket: collect_bucket(aws, out, bucket), buckets))

    save(out / "manifest.json", {
        "account": identity.get("Account"),
        "caller": identity.get("Arn"),
        "regions": regions,
        "buckets": len(buckets),
        "collected_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "errors": aws.errors,
    })
    print(out.resolve())
    if aws.errors:
        print(f"{len(aws.errors)} calls failed; see errors in manifest.json (often missing permissions)", file=sys.stderr)


if __name__ == "__main__":
    main()
