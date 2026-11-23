"""Create and destroy the per-run hosts a scenario asks for.

Every host is a MiniStack EC2 instance (a Docker container) with a namespaced
Name tag and a RunId tag, so two runs cannot collide. The same files and
services are mirrored locally for the fake MCP, and pushed to the real guest
through SSM when a client is available. Tests pass a fake client factory.
"""

from __future__ import annotations

import base64
import os
import secrets as secret_lib
import shlex
from pathlib import Path
from typing import Any

from . import paths
from .fake_secrets import SecretStore
from .hostfs import HostFileStore, apply_env_file
from .ministack import MiniStackClient
from .runctx import HostRecord, RunContext, run_slug

# Container references for the three guest images a scenario can request. A
# runner may override them; they are not real company image names.
IMAGES: dict[str, str] = {
    "systemd": "acme-sandbox/systemd:latest",
    "nginx": "acme-sandbox/nginx:latest",
    "app-compose": "acme-sandbox/app-compose:latest",
}


def image_location(kind: str) -> str:
    """Return the container reference for one guest image kind."""

    override = os.environ.get(f"ACME_SANDBOX_IMAGE_{kind.upper().replace('-', '_')}")
    if override:
        return override
    if kind not in IMAGES:
        raise ValueError(f"unknown guest image: {kind}")
    return IMAGES[kind]


def new_secret(length: int = 18) -> str:
    """Generate one fixture secret value."""

    return secret_lib.token_urlsafe(length)


def resolve_secrets(setup: dict[str, Any], store: SecretStore) -> dict[str, str]:
    """Fill the fake store from a scenario's ``setup.secrets.store`` block."""

    resolved: dict[str, str] = {}
    blocks = (setup.get("secrets") or {}).get("store") or {}
    for path, entries in blocks.items():
        for key, value in (entries or {}).items():
            text = new_secret() if value == "{{random}}" else str(value)
            store.set(path, key, text)
            store.register_fixture_value(text)
            resolved[f"{path}:{key}"] = text
    return resolved


def _ec2_name(run_id: str, hostname: str) -> str:
    """Build the namespaced EC2 Name tag for one guest."""

    return f"{run_slug(run_id)}--{hostname}"


def _write_script(path: str, content: str) -> str:
    """Return an SSM command that writes one file in a guest."""

    encoded = base64.b64encode(content.encode("utf-8")).decode("ascii")
    return (
        f"mkdir -p $(dirname {shlex.quote(path)}); "
        f"printf %s {shlex.quote(encoded)} | base64 -d > {shlex.quote(path)}"
    )


def _service_script(service: str) -> str:
    """Return an SSM command that enables and starts one service."""

    name = shlex.quote(service)
    return f"systemctl enable {name} || true; systemctl start {name} || true"


def create_hosts(
    specs: list[dict[str, Any]],
    run: RunContext,
    client: MiniStackClient | None = None,
) -> list[HostRecord]:
    """Create every guest in ``setup.hosts`` and mirror its state locally."""

    api = client or MiniStackClient.from_env()
    store = HostFileStore(run.root / "hosts")
    amis: dict[str, str] = {}
    created: list[HostRecord] = []

    for spec in specs:
        hostname = str(spec["name"])
        kind = str(spec.get("image", "systemd"))
        if kind not in amis:
            amis[kind] = api.ensure_image(
                name=f"acme-sandbox-{kind}-{run_slug(run.run_id)}",
                location=image_location(kind),
            )
            if amis[kind] not in run.ami_ids:
                run.ami_ids.append(amis[kind])

        tags = {
            "Name": _ec2_name(run.run_id, hostname),
            "HostName": hostname,
            "RunId": run.run_id,
            "Product": str((spec.get("tags") or {}).get("Product", "ACME")),
            "Ambient": str((spec.get("tags") or {}).get("Ambient", "production")),
            "Group": str((spec.get("tags") or {}).get("Group", "sre")),
            "Owner": str((spec.get("tags") or {}).get("Owner", "sre")),
        }
        # The run owns these three keys; a scenario tag with the same name must
        # not break namespacing or make teardown miss the guest.
        reserved = {"Name", "HostName", "RunId"}
        tags.update({
            str(k): str(v)
            for k, v in (spec.get("tags") or {}).items()
            if str(k) not in reserved
        })
        tag_spec = [
            {
                "ResourceType": "instance",
                "Tags": [{"Key": key, "Value": value} for key, value in tags.items()],
            }
        ]
        answer = api.service("ec2").run_instances(
            ImageId=amis[kind],
            InstanceType="t3.small",
            MinCount=1,
            MaxCount=1,
            TagSpecifications=tag_spec,
        )
        instance = answer["Instances"][0]
        instance_id = instance["InstanceId"]
        run.instance_ids.append(instance_id)

        record = HostRecord(
            name=hostname,
            ec2_name=tags["Name"],
            instance_id=instance_id,
            image=kind,
            tags=tags,
            services=list(spec.get("services") or []),
            ip=instance.get("PrivateIpAddress", ""),
            single_instance=bool(spec.get("single_instance", False)),
            meta={"instance_type": "t3.small"},
        )

        for path, content in (spec.get("files") or {}).items():
            store.write(hostname, path, str(content))
            api.send_shell(instance_id, _write_script(path, str(content)))
        for service in record.services:
            api.send_shell(instance_id, _service_script(service))
        created.append(record)

    secrets_blocks = ((run.meta.get("secrets") or {}).get("host_env") or {})
    for hostname, block in secrets_blocks.items():
        record = next((row for row in created if row.name == hostname), None)
        if record is None:
            continue
        store_api = SecretStore(run.root / "secrets.json")
        values = {
            key: store_api.get(block["path"], key) or ""
            for key in (block.get("keys") or [])
        }
        apply_env_file(run, hostname, block["path"], values)
        api.send_shell(record.instance_id, _write_script(block["path"], "".join(
            f"{key}={value}\n" for key, value in values.items()
        )))

    for record in created:
        run.add_host(record)
    return created


def destroy_hosts(
    run: RunContext,
    client: MiniStackClient | None = None,
    *,
    keep_files: bool = False,
) -> int:
    """Terminate every instance of the run and deregister its AMIs."""

    api = client or MiniStackClient.from_env()
    found = api.find_instances(run.run_id)
    ids = [row["InstanceId"] for row in found if row.get("State", {}).get("Name") != "terminated"]
    ids.extend(iid for iid in run.instance_ids if iid not in ids)
    if ids:
        api.service("ec2").terminate_instances(InstanceIds=ids)
    for ami in run.ami_ids:
        api.service("ec2").deregister_image(ImageId=ami)
    if not keep_files:
        HostFileStore(run.root / "hosts").reset()
    run.hosts.clear()
    run.instance_ids.clear()
    run.ami_ids.clear()
    run.save()
    return len(ids)


def prepare_run(
    scenario: dict[str, Any],
    run_id: str | None = None,
    root: Path | None = None,
    client: MiniStackClient | None = None,
) -> RunContext:
    """Build one complete run: hosts, files, secrets and faults."""

    rid = run_id or str(scenario["id"])
    base = Path(root) if root else paths.run_dir(rid)
    run = RunContext(run_id=rid, root=base)
    run.root.mkdir(parents=True, exist_ok=True)

    setup = scenario.get("setup") or {}
    run.meta["secrets"] = setup.get("secrets") or {}
    run.save()

    store = SecretStore(run.root / "secrets.json")
    resolve_secrets(setup, store)
    create_hosts(list(setup.get("hosts") or []), run, client=client)

    fault_names: list[str] = []
    fault_config: dict[str, dict[str, Any]] = {}
    for item in (setup.get("faults") or []):
        if isinstance(item, dict):
            fault_names.append(str(item["name"]))
            fault_config[str(item["name"])] = {k: v for k, v in item.items() if k != "name"}
        else:
            fault_names.append(str(item))
    run.meta["fault_config"] = fault_config
    run.save()
    if fault_names:
        from .faults import apply_faults

        apply_faults(run, fault_names)
    return run
