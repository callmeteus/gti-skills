"""Per-run hosts are namespaced and can be torn down by RunId."""

from __future__ import annotations

from pathlib import Path

from sandbox.fake_secrets import SecretStore
from sandbox.fixtures import destroy_hosts, prepare_run
from sandbox.ministack import MiniStackClient


class FakeEC2:
    """Recorder standing in for boto3's EC2 client."""

    def __init__(self) -> None:
        self.runs: list[dict] = []
        self.images: list[str] = []
        self.describe_filter: list[dict] = []
        self.terminated: list[str] = []
        self.deregistered: list[str] = []

    def describe_images(self, **kwargs) -> dict:
        return {"Images": []}

    def register_image(self, **kwargs) -> dict:
        self.images.append(kwargs["Name"])
        return {"ImageId": "ami-sandbox01"}

    def run_instances(self, **kwargs) -> dict:
        self.runs.append(kwargs)
        return {
            "Instances": [{
                "InstanceId": "i-created001",
                "PrivateIpAddress": "172.31.5.20",
            }]
        }

    def describe_instances(self, **kwargs) -> dict:
        self.describe_filter = kwargs.get("Filters") or []
        return {"Reservations": [{"Instances": [{
            "InstanceId": "i-created001",
            "State": {"Name": "running"},
        }]}]}

    def terminate_instances(self, **kwargs) -> dict:
        self.terminated = list(kwargs.get("InstanceIds") or [])
        return {}

    def deregister_image(self, **kwargs) -> dict:
        self.deregistered.append(kwargs["ImageId"])
        return {}


class FakeSSM:
    """A successful SSM invocation for each file and service command."""

    def __init__(self) -> None:
        self.scripts: list[str] = []

    def send_command(self, **kwargs) -> dict:
        self.scripts.extend(kwargs["Parameters"]["commands"])
        return {"Command": {"CommandId": "cmd-1"}}

    def get_command_invocation(self, **kwargs) -> dict:
        return {"Status": "Success", "StandardOutputContent": "ok"}


def scenario() -> dict:
    """A minimal scenario with one host, one file, one secret and one fault."""

    return {
        "id": "s01-user-fact-wins",
        "setup": {
            "hosts": [{
                "name": "vm.prod.shop.acme.test",
                "tags": {"Name": "ACME Shop", "Product": "SHOP"},
                "image": "nginx",
                "single_instance": True,
                "services": ["nginx"],
                "files": {"/etc/nginx/conf.d/app.conf": "server { listen 80; }\n"},
            }],
            "secrets": {
                "store": {"/shop": {"DB_PASSWORD": "{{random}}"}},
                "host_env": {
                    "vm.prod.shop.acme.test": {
                        "path": "/var/www/.env", "keys": ["DB_PASSWORD"],
                    }
                },
            },
            "faults": ["mcp-readonly-rejects-pipes"],
        },
    }


def fake_client() -> tuple[MiniStackClient, FakeEC2, FakeSSM]:
    """Build a client that records every MiniStack call."""

    ec2, ssm = FakeEC2(), FakeSSM()
    factory = lambda service: ec2 if service == "ec2" else ssm
    return MiniStackClient(factory), ec2, ssm


def test_prepare_run_namespaces_hosts_files_and_secrets(tmp_path: Path) -> None:
    """One run owns one EC2 guest with a RunId tag and mirrored files."""

    client, ec2, ssm = fake_client()
    run = prepare_run(scenario(), run_id="s01-user-fact-wins", root=tmp_path / "run", client=client)

    assert list(run.hosts) == ["vm.prod.shop.acme.test"]
    host = run.hosts["vm.prod.shop.acme.test"]
    assert host.ec2_name == "s01-user-fact-wins--vm.prod.shop.acme.test"
    assert host.tags["RunId"] == "s01-user-fact-wins"
    assert host.tags["Product"] == "SHOP"
    assert host.instance_id == "i-created001"
    assert host.single_instance is True

    tag_map = {tag["Key"]: tag["Value"] for tag in ec2.runs[0]["TagSpecifications"][0]["Tags"]}
    assert tag_map["Name"] == host.ec2_name
    assert tag_map["RunId"] == "s01-user-fact-wins"

    file = run.root / "hosts" / "vm.prod.shop.acme.test" / "etc" / "nginx" / "conf.d" / "app.conf"
    assert file.read_text(encoding="utf-8") == "server { listen 80; }\n"
    env_file = run.root / "hosts" / "vm.prod.shop.acme.test" / "var" / "www" / ".env"
    assert "DB_PASSWORD=" in env_file.read_text(encoding="utf-8")
    assert any("nginx" in script for script in ssm.scripts)

    store = SecretStore(run.root / "secrets.json")
    password = store.get("/shop", "DB_PASSWORD")
    assert password and len(password) > 10
    assert password in store.fixture_values()
    assert store.list("/shop") == ["DB_PASSWORD"]
    assert run.flags["strict_pipe_guard"] is True


def test_two_runs_do_not_share_an_ec2_name(tmp_path: Path) -> None:
    """The run id prefixes the Name tag so parallel runs never collide."""

    first, ec2_first, _ = fake_client()
    second, ec2_second, _ = fake_client()
    prepare_run(scenario(), run_id="s01-user-fact-wins", root=tmp_path / "a", client=first)
    prepare_run(scenario(), run_id="s02-other-run", root=tmp_path / "b", client=second)

    name_first = ec2_first.runs[0]["TagSpecifications"][0]["Tags"][0]["Value"]
    name_second = ec2_second.runs[0]["TagSpecifications"][0]["Tags"][0]["Value"]
    assert name_first != name_second


def test_teardown_terminates_only_this_run(tmp_path: Path) -> None:
    """Destroy finds instances by RunId, removes files and clears the context."""

    client, ec2, _ = fake_client()
    run = prepare_run(scenario(), run_id="s01-user-fact-wins", root=tmp_path / "run", client=client)
    count = destroy_hosts(run, client=client)

    assert count == 1
    assert ec2.terminated == ["i-created001"]
    assert ec2.describe_filter == [{"Name": "tag:RunId", "Values": ["s01-user-fact-wins"]}]
    assert ec2.deregistered == ["ami-sandbox01"]
    assert run.hosts == {}
    assert not (run.root / "hosts").exists()
