"""Find tangles and risks in an AWS snapshot taken by aws_collect.py.

Read-only and offline: it only reads the snapshot folder and, optionally,
Terraform state files. Findings:

- security groups: unused, duplicated rule sets in one VPC, open to the
  internet on ports other than 80 and 443, default groups with rules;
- VPCs: overlapping CIDR blocks, VPCs with nothing running, resources in a
  default VPC, NAT gateways no route table uses, unattached internet gateways;
- leftovers that cost money: unattached Elastic IPs and EBS volumes;
- S3: bucket families that look like duplicates (same name once environment,
  region, account, and numeric suffixes are removed), empty buckets, public
  buckets, buckets without a full public access block, state or backup
  buckets without versioning, log buckets without lifecycle rules;
- with --tf-state: resources that no given state manages (created by hand).

Every finding is a lead to check, not a verdict. Nothing here changes AWS.
"""

import argparse
import ipaddress
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}
WORLD = ("0.0.0.0/0", "::/0")
WEB_PORTS = {80, 443}
SENSITIVE_PORTS = {22, 23, 445, 1433, 1521, 2375, 2376, 3306, 3389, 5432, 5601, 5984, 6379, 7001, 8020, 8080, 8888,
                   9000, 9042, 9090, 9200, 9300, 11211, 15672, 27017}
ENV_TOKENS = {"dev", "develop", "development", "stg", "stage", "staging", "hml", "homolog", "homologacao", "qa", "uat",
              "test", "testing", "prod", "prd", "production", "sandbox", "preview", "demo"}
REGION_TOKENS = {"us", "eu", "ap", "sa", "ca", "me", "af", "il", "mx", "east", "west", "north", "south", "central",
                 "northeast", "southeast", "northwest", "southwest", "gov"}
VERSIONED_HINT = re.compile(r"state|tfstate|backup|bkp", re.IGNORECASE)
LOG_HINT = re.compile(r"(^|[-_.])(log|logs|logging|cloudtrail|access-logs|alb-logs|elb-logs|flowlogs?)($|[-_.])", re.IGNORECASE)


def load(path):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return {} if "error" in data else data


class Snapshot:
    def __init__(self, folder):
        self.folder = Path(folder)
        self.manifest = load(self.folder / "manifest.json")
        if not self.manifest:
            raise SystemExit(f"no manifest.json in {folder}; run aws_collect.py first")
        self.regions = self.manifest.get("regions", [])

    def regional(self, region, name, key):
        return load(self.folder / region / f"{name}.json").get(key, [])

    def buckets(self):
        folder = self.folder / "global" / "s3"
        return [load(path) for path in sorted(folder.glob("*.json"))] if folder.is_dir() else []


def finding(severity, category, region, resources, detail, suggestion):
    return {"severity": severity, "category": category, "region": region, "resources": resources,
            "detail": detail, "suggestion": suggestion}


def tag(resource, key="Name"):
    for item in resource.get("Tags") or []:
        if item.get("Key") == key:
            return item.get("Value")
    return None


def label(resource_id, name):
    return f"{resource_id} ({name})" if name else resource_id


def rule_key(permission, own_id):
    groups = sorted("self" if pair.get("GroupId") == own_id else pair.get("GroupId", "")
                    for pair in permission.get("UserIdGroupPairs", []))
    return (
        permission.get("IpProtocol"), permission.get("FromPort"), permission.get("ToPort"),
        tuple(sorted(r["CidrIp"] for r in permission.get("IpRanges", []))),
        tuple(sorted(r["CidrIpv6"] for r in permission.get("Ipv6Ranges", []))),
        tuple(sorted(p["PrefixListId"] for p in permission.get("PrefixListIds", []))),
        tuple(groups),
    )


def world_exposure(permission):
    """Return (severity, port text) when the rule is open to the internet on more than web ports, else None."""
    open_to_world = any(r.get("CidrIp") in WORLD for r in permission.get("IpRanges", [])) or \
        any(r.get("CidrIpv6") in WORLD for r in permission.get("Ipv6Ranges", []))
    if not open_to_world:
        return None
    protocol = permission.get("IpProtocol")
    if protocol == "-1":
        return "high", "all traffic"
    low, high = permission.get("FromPort"), permission.get("ToPort")
    if low is None or high is None:
        return "medium", f"protocol {protocol}"
    if low == high and low in WEB_PORTS:
        return None
    ports = f"{low}" if low == high else f"{low}-{high}"
    sensitive = any(low <= port <= high for port in SENSITIVE_PORTS) or high - low > 100
    return ("high" if sensitive else "medium"), f"{protocol}/{ports}"


def analyze_security_groups(snap, region, findings, attached):
    groups = snap.regional(region, "ec2-describe-security-groups", "SecurityGroups")
    referenced = set()
    for group in groups:
        for permission in group.get("IpPermissions", []) + group.get("IpPermissionsEgress", []):
            for pair in permission.get("UserIdGroupPairs", []):
                if pair.get("GroupId") != group["GroupId"]:
                    referenced.add(pair.get("GroupId"))

    clusters = defaultdict(list)
    for group in groups:
        gid, name = group["GroupId"], group.get("GroupName")
        used = gid in attached
        if name == "default":
            if group.get("IpPermissions") or (used and group.get("IpPermissionsEgress")):
                findings.append(finding("medium", "security-group", region, [label(gid, name)],
                                        f"Default security group of {group.get('VpcId')} has rules"
                                        + (" and is attached to resources" if used else ""),
                                        "Move the resources to named groups and remove every rule from the default group."))
            continue
        if not used and gid not in referenced:
            findings.append(finding("low", "security-group", region, [label(gid, name)],
                                    "Security group is attached to nothing and no other group refers to it",
                                    "Check launch templates and Terraform for references, then remove it through its owner."))
        for permission in group.get("IpPermissions", []):
            exposure = world_exposure(permission)
            if exposure and used:
                severity, ports = exposure
                findings.append(finding(severity, "security-group", region, [label(gid, name)],
                                        f"Ingress open to the internet on {ports}",
                                        "Restrict the source to known CIDRs, a VPN, a load balancer group, or a prefix list."))
        ingress = tuple(sorted(rule_key(p, gid) for p in group.get("IpPermissions", [])))
        egress = tuple(sorted(rule_key(p, gid) for p in group.get("IpPermissionsEgress", [])))
        if ingress:
            clusters[(group.get("VpcId"), ingress, egress)].append(label(gid, name))
    for (vpc, _, _), members in clusters.items():
        if len(members) > 1:
            findings.append(finding("medium", "security-group", region, members,
                                    f"{len(members)} security groups in {vpc} have identical rules",
                                    "Keep one group, move every attachment to it, then remove the others."))


def analyze_network(snap, region, findings, enis):
    vpcs = snap.regional(region, "ec2-describe-vpcs", "Vpcs")
    eni_vpcs = defaultdict(int)
    for eni in enis:
        eni_vpcs[eni.get("VpcId")] += 1
    for vpc in vpcs:
        vid, name = vpc["VpcId"], tag(vpc)
        if vpc.get("IsDefault") and eni_vpcs[vid]:
            findings.append(finding("medium", "vpc", region, [label(vid, name)],
                                    f"Default VPC has {eni_vpcs[vid]} network interfaces in use",
                                    "Move the workloads to a VPC defined in code; the default VPC has public subnets by default."))
        elif not eni_vpcs[vid]:
            findings.append(finding("low", "vpc", region, [label(vid, name)],
                                    ("Default VPC" if vpc.get("IsDefault") else "VPC") + " has no network interfaces",
                                    "Confirm nothing runs there, then remove it with its subnets and gateways."))

    routes_to_nat = set()
    for table in snap.regional(region, "ec2-describe-route-tables", "RouteTables"):
        for route in table.get("Routes", []):
            if route.get("NatGatewayId"):
                routes_to_nat.add(route["NatGatewayId"])
    for nat in snap.regional(region, "ec2-describe-nat-gateways", "NatGateways"):
        if nat.get("State") == "available" and nat["NatGatewayId"] not in routes_to_nat:
            findings.append(finding("medium", "cost", region, [label(nat["NatGatewayId"], tag(nat))],
                                    "NAT gateway is running but no route table sends traffic to it",
                                    "Remove it through its owner; an idle NAT gateway is billed every hour."))
    for gateway in snap.regional(region, "ec2-describe-internet-gateways", "InternetGateways"):
        if not gateway.get("Attachments"):
            findings.append(finding("low", "vpc", region, [label(gateway["InternetGatewayId"], tag(gateway))],
                                    "Internet gateway is not attached to any VPC", "Remove it through its owner."))
    for address in snap.regional(region, "ec2-describe-addresses", "Addresses"):
        if not address.get("AssociationId"):
            findings.append(finding("low", "cost", region, [label(address.get("AllocationId", address.get("PublicIp")), tag(address))],
                                    f"Elastic IP {address.get('PublicIp')} is not associated",
                                    "Release it through its owner; unassociated Elastic IPs are billed."))
    for volume in snap.regional(region, "ec2-describe-volumes", "Volumes"):
        if volume.get("State") == "available":
            findings.append(finding("low", "cost", region, [label(volume["VolumeId"], tag(volume))],
                                    f"EBS volume of {volume.get('Size')} GiB is attached to nothing",
                                    "Snapshot it if the data matters, then delete it through its owner."))
    return [(region, v["VpcId"], tag(v), block["CidrBlock"]) for v in vpcs
            for block in v.get("CidrBlockAssociationSet", [{"CidrBlock": v.get("CidrBlock")}]) if block.get("CidrBlock")]


def analyze_overlaps(cidrs, findings):
    for i, (region_a, vpc_a, name_a, cidr_a) in enumerate(cidrs):
        for region_b, vpc_b, name_b, cidr_b in cidrs[i + 1:]:
            if vpc_a == vpc_b:
                continue
            if ipaddress.ip_network(cidr_a, strict=False).overlaps(ipaddress.ip_network(cidr_b, strict=False)):
                findings.append(finding("medium", "vpc", f"{region_a}, {region_b}" if region_a != region_b else region_a,
                                        [label(vpc_a, name_a), label(vpc_b, name_b)],
                                        f"CIDR {cidr_a} overlaps {cidr_b}",
                                        "Overlapping VPCs cannot be peered or routed together; plan new ranges before connecting them."))


def bucket_family(name):
    tokens = [t for t in re.split(r"[-_.]", name.lower()) if t]
    env = sorted({t for t in tokens if t in ENV_TOKENS})
    kept = [t for t in tokens if t not in ENV_TOKENS and t not in REGION_TOKENS and not t.isdigit()
            and not re.fullmatch(r"[0-9a-f]{6,}", t) and not re.fullmatch(r"\d+[a-z]?", t)]
    return " ".join(sorted(set(kept))), ",".join(env)


def analyze_buckets(snap, findings):
    families = defaultdict(list)
    for bucket in snap.buckets():
        name = bucket.get("name")
        if not name:
            continue
        region = bucket.get("region") or "unknown"
        key, env = bucket_family(name)
        if key:
            families[key].append((name, env))
        first = bucket.get("first_object") or {}
        if "error" not in first and not first.get("absent") and first.get("KeyCount", len(first.get("Contents", []))) == 0:
            findings.append(finding("low", "s3", region, [name], "Bucket is empty",
                                    "Confirm no job writes to it, then remove it through its owner."))
        status = (bucket.get("policy_status") or {}).get("PolicyStatus", {})
        if status.get("IsPublic"):
            findings.append(finding("high", "s3", region, [name], "Bucket policy makes the bucket public",
                                    "Serve public files through CloudFront with origin access control and block public access on the bucket."))
        block = (bucket.get("public_access_block") or {}).get("PublicAccessBlockConfiguration")
        if not block or not all(block.values()):
            findings.append(finding("medium", "s3", region, [name], "Public access block is missing or partial",
                                    "Enable all four public access block settings unless the bucket must be public."))
        versioning = (bucket.get("versioning") or {}).get("Status")
        if VERSIONED_HINT.search(name) and versioning != "Enabled":
            findings.append(finding("medium", "s3", region, [name], "State or backup bucket without versioning",
                                    "Enable versioning so an overwrite or delete can be undone."))
        lifecycle = bucket.get("lifecycle") or {}
        if LOG_HINT.search(name) and (lifecycle.get("absent") or not lifecycle.get("Rules")):
            findings.append(finding("low", "cost", region, [name], "Log bucket without lifecycle rules",
                                    "Add an expiration or a transition to a cheaper storage class."))
    for key, members in families.items():
        if len(members) < 2:
            continue
        envs = [env for _, env in members]
        if all(envs) and len(set(envs)) == len(envs):
            continue
        findings.append(finding("medium", "s3", "global", [name for name, _ in members],
                                f"{len(members)} buckets share the base name '{key}'",
                                "Check what each one holds and who writes to it; merge the duplicates into one bucket with prefixes."))


def managed_ids(paths):
    ids = set()

    def take(values):
        for key in ("id", "arn", "bucket", "allocation_id", "name"):
            if isinstance(values.get(key), str):
                ids.add(values[key])

    def walk_module(module):
        for resource in module.get("resources", []):
            take(resource.get("values") or {})
        for child in module.get("child_modules", []):
            walk_module(child)

    for path in paths:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        if "values" in data:
            walk_module((data.get("values") or {}).get("root_module") or {})
        for resource in data.get("resources", []):
            for instance in resource.get("instances", []):
                take(instance.get("attributes") or {})
    return ids


def analyze_unmanaged(snap, managed, findings):
    checks = [
        ("ec2-describe-vpcs", "Vpcs", "VPCs", "VpcId", lambda r: not r.get("IsDefault")),
        ("ec2-describe-subnets", "Subnets", "subnets", "SubnetId", lambda r: not r.get("DefaultForAz")),
        ("ec2-describe-security-groups", "SecurityGroups", "security groups", "GroupId", lambda r: r.get("GroupName") != "default"),
        ("ec2-describe-nat-gateways", "NatGateways", "NAT gateways", "NatGatewayId", lambda r: r.get("State") == "available"),
        ("ec2-describe-addresses", "Addresses", "Elastic IPs", "AllocationId", lambda r: True),
    ]
    for region in snap.regions:
        instances = [i for r in snap.regional(region, "ec2-describe-instances", "Reservations")
                     for i in r.get("Instances", []) if i.get("State", {}).get("Name") != "terminated"]
        for name, key, noun, id_key, keep in checks + [(None, None, "instances", "InstanceId", lambda r: True)]:
            items = instances if name is None else snap.regional(region, name, key)
            loose = [label(i[id_key], tag(i)) for i in items if keep(i) and i.get(id_key) not in managed]
            if loose:
                findings.append(finding("medium", "unmanaged", region, loose,
                                        f"{len(loose)} {noun} not found in the given Terraform states",
                                        "Import each one into the stack that should own it, or remove it if nobody needs it."))
    loose = [b["name"] for b in snap.buckets() if b.get("name") and b["name"] not in managed]
    if loose:
        findings.append(finding("medium", "unmanaged", "global", loose,
                                f"{len(loose)} buckets not found in the given Terraform states",
                                "Import each one into the stack that should own it, or remove it if nobody needs it."))


def build(folder, states):
    snap = Snapshot(folder)
    findings = []
    cidrs = []
    for region in snap.regions:
        enis = snap.regional(region, "ec2-describe-network-interfaces", "NetworkInterfaces")
        attached = {g["GroupId"] for eni in enis for g in eni.get("Groups", [])}
        for balancer in snap.regional(region, "elbv2-describe-load-balancers", "LoadBalancers"):
            attached.update(balancer.get("SecurityGroups", []))
        for database in snap.regional(region, "rds-describe-db-instances", "DBInstances"):
            attached.update(g["VpcSecurityGroupId"] for g in database.get("VpcSecurityGroups", []))
        for function in snap.regional(region, "lambda-list-functions", "Functions"):
            attached.update((function.get("VpcConfig") or {}).get("SecurityGroupIds", []))
        analyze_security_groups(snap, region, findings, attached)
        cidrs += analyze_network(snap, region, findings, enis)
    analyze_overlaps(cidrs, findings)
    analyze_buckets(snap, findings)
    if states:
        analyze_unmanaged(snap, managed_ids(states), findings)
    findings.sort(key=lambda f: (SEVERITY_ORDER[f["severity"]], f["category"], f["region"]))
    return {
        "account": snap.manifest.get("account"),
        "regions": snap.regions,
        "collected_at": snap.manifest.get("collected_at"),
        "collect_errors": len(snap.manifest.get("errors", [])),
        "states_checked": len(states),
        "findings": findings,
    }


def print_text(report, limit):
    print(f"Account {report['account']}, regions {', '.join(report['regions'])}, collected {report['collected_at']}")
    if report["collect_errors"]:
        print(f"Warning: {report['collect_errors']} collection calls failed, so some findings may be missing.")
    counts = defaultdict(int)
    for item in report["findings"]:
        counts[item["severity"]] += 1
    print("Findings: " + ", ".join(f"{counts[s]} {s}" for s in SEVERITY_ORDER) + "\n")
    shown = defaultdict(int)
    for item in report["findings"]:
        bucket = (item["severity"], item["category"])
        shown[bucket] += 1
        if shown[bucket] > limit:
            continue
        resources = ", ".join(item["resources"][:6]) + (" ..." if len(item["resources"]) > 6 else "")
        print(f"[{item['severity']}] {item['category']} {item['region']}: {item['detail']}\n    {resources}\n    -> {item['suggestion']}")
    hidden = sum(max(0, n - limit) for n in shown.values())
    if hidden:
        print(f"\n{hidden} more findings hidden; use --json for all")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("snapshot", help="Folder written by aws_collect.py")
    parser.add_argument("--tf-state", action="append", default=[],
                        help="Terraform state to compare with: a .tfstate file or `terraform show -json` output; repeatable")
    parser.add_argument("--json", action="store_true", help="Print findings as JSON")
    parser.add_argument("--limit", type=int, default=10, help="Findings to print per severity and category in text mode (default 10)")
    args = parser.parse_args()

    report = build(args.snapshot, args.tf_state)
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print_text(report, args.limit)


if __name__ == "__main__":
    main()
