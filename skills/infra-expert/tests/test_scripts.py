import copy
import json
import os
import stat
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL / "scripts"
EXAMPLE = SKILL / "assets" / "templates" / "report-data.example.json"


def run(script, *args, env=None):
    return subprocess.run([sys.executable, str(SCRIPTS / script), *map(str, args)],
                          capture_output=True, text=True, encoding="utf-8", env=env)


def write(root, files):
    for name, text in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(textwrap.dedent(text), encoding="utf-8")


HOST = """
resource "aws_instance" "host" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.size
  subnet_id     = "subnet-0123456789abcdef0"
  metadata_options {
    http_tokens = "required"
  }
  root_block_device {
    encrypted  = true
    kms_key_id = "arn:aws:kms:us-east-1:111122223333:key/abc"
  }
}
"""


class TerraformScanTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        write(self.root, {
            "modules/tags/main.tf": 'variable "name" {}\noutput "tags" { value = { Name = var.name } }\n',
            "modules/proxy/main.tf": 'resource "null_resource" "proxy" {}\n',
            "services/api/versions.tf": 'terraform {\n  backend "s3" { key = "api" }\n}\nprovider "aws" {}\n',
            "services/api/main.tf": 'module "tags" { source = "../../modules/tags" }\n' + HOST,
            "services/worker/versions.tf": 'terraform {\n  backend "s3" { key = "worker" }\n}\nprovider "aws" {}\n',
            "services/worker/main.tf": 'module "tags" { source = "../../modules/tags" }\n' + HOST.replace('"host"', '"worker"'),
            "services/docs/main.tf": 'terraform {\n  backend "s3" {}\n}\nmodule "p" { source = "../../modules/proxy" }\n',
            "services/blog/main.tf": 'terraform {\n  backend "s3" {}\n}\nmodule "p" { source = "../../modules/proxy" }\n',
            "services/empty/versions.tf": 'terraform {\n  backend "s3" {}\n}\n',
            "network/groups.tf": """
                resource "aws_security_group" "web" {
                  name = "app/web"
                  ingress {
                    from_port   = 22
                    to_port     = 22
                    protocol    = "tcp"
                    cidr_blocks = ["0.0.0.0/0"]
                  }
                  ingress {
                    from_port   = 443
                    to_port     = 443
                    protocol    = "tcp"
                    cidr_blocks = ["0.0.0.0/0"]
                  }
                }
                resource "aws_vpc_security_group_ingress_rule" "extra" {
                  security_group_id = aws_security_group.web.id
                  # a brace in a comment { should not break parsing
                  description = "text with } brace and ${var.x}"
                  ip_protocol = "tcp"
                }
            """,
        })

    def scan(self):
        result = run("scan/terraform_scan.py", self.root, "--json")
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_folder_roles_and_kinds(self):
        report = self.scan()
        folders = {f["path"]: f for f in report["folders"]}
        self.assertEqual(folders["modules/tags"]["kind"], "helper")
        self.assertEqual(folders["modules/tags"]["callers"], ["services/api", "services/worker"])
        self.assertEqual(folders["services/api"]["role"], "root")
        self.assertEqual(folders["services/api"]["resources"], {"compute": 1})
        self.assertEqual(folders["network"]["resources"], {"network": 2})

    def test_findings(self):
        findings = self.scan()["findings"]
        copies = findings["copied_blocks"][0]
        self.assertEqual(copies["type"], "aws_instance")
        self.assertEqual(len(copies["places"]), 2)
        repeated = {item["value"]: item["files"] for item in findings["repeated_hardcoded_values"]}
        self.assertEqual(repeated["subnet-0123456789abcdef0"], 2)
        self.assertEqual(repeated["arn:aws:kms:us-east-1:111122223333:key/abc"], 2)
        self.assertEqual([item["ports"] for item in findings["open_ingress"]], ["22-22"])
        self.assertEqual(findings["mixed_rule_styles"][0]["security_group"], "network/web")
        self.assertEqual(findings["placeholder_roots"], [{"folder": "services/empty"}])
        self.assertEqual(findings["one_call_roots"], [{"module": "modules/proxy", "roots": ["services/blog", "services/docs"]}])

    def test_gitignored_files_are_never_read(self):
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        write(self.root, {
            ".gitignore": "*.auto.tfvars\n",
            "services/api/secret.auto.tfvars": 'vpc = "vpc-0aaaaaaaaaaaaaaaa"\n',
            "services/worker/secret.auto.tfvars": 'vpc = "vpc-0aaaaaaaaaaaaaaaa"\n',
        })
        report = self.scan()
        self.assertTrue(report["git_tracked_only"])
        values = [item["value"] for item in report["findings"]["repeated_hardcoded_values"]]
        self.assertNotIn("vpc-0aaaaaaaaaaaaaaaa", values)


def dashboard(uid, title, panels, source="prom-main"):
    return json.dumps({"uid": uid, "title": title, "panels": [
        {"type": "timeseries", "title": name, "datasource": {"type": "prometheus", "uid": source},
         "targets": [{"expr": f"sum(rate({name}_total[5m])) by (tenant)"}]} for name in panels]})


class GrafanaScanTest(unittest.TestCase):
    def test_bases_copies_and_datasources(self):
        root = Path(tempfile.mkdtemp())
        panels = ["requests", "errors", "latency", "saturation"]
        write(root, {
            "datasources/main.json": json.dumps({"datasources": [{"uid": "prom-main", "type": "prometheus", "url": "http://p"}]}),
            "dashboards/acme/overview.json": dashboard("acme", "Acme", panels),
            "dashboards/beta/overview.json": dashboard("beta", "Beta", panels),
            "dashboards/beta/other.json": dashboard("acme", "Other", ["cpu"], source="fe2ga6w54ahogc"),
            "models/http/check.json": json.dumps({"title": "base", "condition": "C", "data": []}),
            "alerting/site-a.json": json.dumps({"$extends": "../models/http/check.json", "uid": "a", "title": "A"}),
            "alerting/site-b.json": json.dumps({"$extends": "../models/http/missing.json", "uid": "b", "title": "B"}),
        })
        result = run("scan/grafana_scan.py", root, "--json")
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        findings = report["findings"]
        self.assertEqual(report["bases"][0], {"file": "models/http/check.json", "children": 1})
        self.assertEqual(findings["missing_bases"][0]["file"], "alerting/site-b.json")
        self.assertIn(["dashboards/acme/overview.json", "dashboards/beta/overview.json"],
                      [g["files"] for g in findings["near_copies"]])
        self.assertEqual(findings["duplicate_uids"][0]["uid"], "acme")
        self.assertEqual([d["uid"] for d in findings["unprovisioned_datasources"]], ["fe2ga6w54ahogc"])


FAKE_AWS = r'''#!/usr/bin/env python3
import json, os, sys
args = sys.argv[1:]
with open(os.environ["FAKE_AWS_LOG"], "a") as log:
    log.write(" ".join(args) + "\n")
service, operation = args[0], args[1]
answers = {
    ("sts", "get-caller-identity"): {"Account": "111122223333", "Arn": "arn:aws:iam::111122223333:user/ro"},
    ("s3api", "list-buckets"): {"Buckets": []},
}
print(json.dumps(answers.get((service, operation), {})))
'''


class AwsCollectTest(unittest.TestCase):
    def test_uses_only_read_only_operations(self):
        tmp = Path(tempfile.mkdtemp())
        fake = tmp / "aws"
        fake.write_text(FAKE_AWS, encoding="utf-8")
        fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
        log = tmp / "calls.log"
        env = {**os.environ, "FAKE_AWS_LOG": str(log)}
        if sys.platform.startswith("win"):
            self.skipTest("the fake AWS CLI is a POSIX script")
        result = run("aws/aws_collect.py", "--aws", fake, "--regions", "us-east-1", "--out", tmp / "snap", env=env)
        self.assertEqual(result.returncode, 0, result.stderr)
        manifest = json.loads((tmp / "snap" / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["account"], "111122223333")
        operations = {line.split()[1] for line in log.read_text(encoding="utf-8").splitlines()}
        self.assertIn("describe-security-groups", operations)
        self.assertTrue(all(op.split("-")[0] in ("describe", "list", "get") for op in operations), operations)


def snapshot(root):
    region = root / "us-east-1"
    sg = lambda gid, name, ingress, vpc="vpc-1": {"GroupId": gid, "GroupName": name, "VpcId": vpc, "IpPermissions": ingress,
                                                  "IpPermissionsEgress": []}
    ssh_world = {"IpProtocol": "tcp", "FromPort": 22, "ToPort": 22, "IpRanges": [{"CidrIp": "0.0.0.0/0"}]}
    https_world = {"IpProtocol": "tcp", "FromPort": 443, "ToPort": 443, "IpRanges": [{"CidrIp": "0.0.0.0/0"}]}
    files = {
        "manifest.json": {"account": "111122223333", "regions": ["us-east-1"], "collected_at": "now", "errors": []},
        "us-east-1/ec2-describe-security-groups.json": {"SecurityGroups": [
            sg("sg-ssh", "app/ssh", [ssh_world]),
            sg("sg-web1", "app/web", [https_world]),
            sg("sg-web2", "web-copy", [https_world]),
            sg("sg-old", "old", [{"IpProtocol": "tcp", "FromPort": 5432, "ToPort": 5432, "IpRanges": [{"CidrIp": "10.0.0.0/16"}]}]),
            sg("sg-def", "default", [{"IpProtocol": "-1", "UserIdGroupPairs": [{"GroupId": "sg-def"}]}]),
        ]},
        "us-east-1/ec2-describe-network-interfaces.json": {"NetworkInterfaces": [
            {"VpcId": "vpc-1", "Groups": [{"GroupId": "sg-ssh"}, {"GroupId": "sg-web1"}, {"GroupId": "sg-web2"}]}]},
        "us-east-1/ec2-describe-vpcs.json": {"Vpcs": [
            {"VpcId": "vpc-1", "CidrBlock": "10.0.0.0/16", "CidrBlockAssociationSet": [{"CidrBlock": "10.0.0.0/16"}]},
            {"VpcId": "vpc-2", "CidrBlock": "10.0.128.0/17", "CidrBlockAssociationSet": [{"CidrBlock": "10.0.128.0/17"}]}]},
        "us-east-1/ec2-describe-addresses.json": {"Addresses": [{"AllocationId": "eipalloc-1", "PublicIp": "1.2.3.4"}]},
        "global/s3/acme-exports.json": {"name": "acme-exports", "region": "us-east-1", "first_object": {"KeyCount": 1},
                                         "public_access_block": {"PublicAccessBlockConfiguration": {
                                             "BlockPublicAcls": True, "IgnorePublicAcls": True,
                                             "BlockPublicPolicy": True, "RestrictPublicBuckets": True}}},
        "global/s3/acme-exports-2.json": {"name": "acme-exports-2", "region": "us-east-1", "first_object": {},
                                           "public_access_block": {"absent": True}},
        "global/s3/acme-data-dev.json": {"name": "acme-data-dev", "region": "us-east-1", "first_object": {"KeyCount": 1},
                                          "public_access_block": {"absent": True}},
        "global/s3/acme-data-prod.json": {"name": "acme-data-prod", "region": "us-east-1", "first_object": {"KeyCount": 1},
                                           "public_access_block": {"absent": True}},
    }
    for name, data in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data), encoding="utf-8")
    return region


class AwsAnalyzeTest(unittest.TestCase):
    def analyze(self, *extra):
        root = Path(tempfile.mkdtemp())
        snapshot(root)
        result = run("aws/aws_analyze.py", root, "--json", *extra)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)["findings"], root

    def find(self, findings, text):
        return [f for f in findings if text in f["detail"]]

    def test_security_group_findings(self):
        findings, _ = self.analyze()
        open_ssh = self.find(findings, "open to the internet")
        self.assertEqual([(f["severity"], f["resources"]) for f in open_ssh], [("high", ["sg-ssh (app/ssh)"])])
        self.assertEqual(self.find(findings, "identical rules")[0]["resources"], ["sg-web1 (app/web)", "sg-web2 (web-copy)"])
        self.assertEqual(self.find(findings, "attached to nothing")[0]["resources"], ["sg-old (old)"])
        self.assertTrue(self.find(findings, "Default security group"))

    def test_network_and_bucket_findings(self):
        findings, _ = self.analyze()
        self.assertTrue(self.find(findings, "10.0.0.0/16 overlaps 10.0.128.0/17"))
        self.assertTrue(self.find(findings, "1.2.3.4 is not associated"))
        families = self.find(findings, "share the base name")
        self.assertEqual([f["resources"] for f in families], [["acme-exports-2", "acme-exports"]])
        self.assertEqual(self.find(findings, "Bucket is empty")[0]["resources"], ["acme-exports-2"])

    def test_unmanaged_against_state(self):
        state = Path(tempfile.mkdtemp()) / "state.json"
        state.write_text(json.dumps({"values": {"root_module": {"resources": [
            {"values": {"id": "sg-web1"}}, {"values": {"id": "vpc-1"}}],
            "child_modules": [{"resources": [{"values": {"bucket": "acme-exports"}}]}]}}}), encoding="utf-8")
        findings, _ = self.analyze("--tf-state", state)
        unmanaged = {f["detail"]: f["resources"] for f in findings if f["category"] == "unmanaged"}
        groups = unmanaged["3 security groups not found in the given Terraform states"]
        self.assertNotIn("sg-web1 (app/web)", groups)
        self.assertEqual(unmanaged["1 VPCs not found in the given Terraform states"], ["vpc-2"])
        self.assertNotIn("acme-exports", unmanaged["3 buckets not found in the given Terraform states"])


class RenderReportTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.data = json.loads(EXAMPLE.read_text(encoding="utf-8"))

    def render(self, data, *flags):
        path = self.tmp / "data.json"
        path.write_text(json.dumps(data), encoding="utf-8")
        out = self.tmp / "report.html"
        return run("report/render_report.py", path, "--out", out, *flags), out

    def test_example_renders_cleanly(self):
        result, out = self.render(self.data, "--strict")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stderr, "")
        page = out.read_text(encoding="utf-8")
        self.assertIn('href="#vm-host-base"', page)
        self.assertIn("Infrastructure review (Terraform): acme-infra", page)
        self.assertIn("What the scans found", page)

    def test_strict_refuses_vague_claims(self):
        data = copy.deepcopy(self.data)
        data["candidates"][0]["gains"].append("Follows best practices and is more robust")
        result, out = self.render(data, "--strict")
        self.assertEqual(result.returncode, 3)
        self.assertIn("'best practices'", result.stderr)
        self.assertIn("'robust'", result.stderr)
        self.assertFalse(out.exists())

    def test_portuguese_labels_and_escaping(self):
        data = copy.deepcopy(self.data)
        data["lang"] = "pt"
        data["scope"] = "Revisei <script>alert(1)</script>."
        result, out = self.render(data)
        self.assertEqual(result.returncode, 0, result.stderr)
        page = out.read_text(encoding="utf-8")
        self.assertIn("Revisão de infraestrutura", page)
        self.assertIn("Move estado", page)
        self.assertNotIn("<script>alert(1)", page)

    def test_rejects_unknown_risk(self):
        data = copy.deepcopy(self.data)
        data["candidates"][0]["risk"] = "yolo"
        result, _ = self.render(data)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("risk must be one of", result.stderr)


if __name__ == "__main__":
    unittest.main()
