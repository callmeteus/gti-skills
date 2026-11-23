"""The one wrapper that knows how to talk to MiniStack.

MiniStack is an AWS emulator on port 4566; EC2 instances are Docker containers
and SSM runs real commands inside them. The wrapper keeps the endpoint and the
SigV4 credentials out of every other module. Credentials are read from the
environment or from the operator's env file, never printed or committed.
"""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any, Callable


def default_credentials_file() -> Path:
    """Return the workspace-level env file with the MiniStack credentials."""

    from .paths import sandbox_root

    root = sandbox_root()
    # The package lives at different depths on the workstation and on the
    # notebook, so walk up instead of assuming a fixed number of parents.
    for candidate in (root, *root.parents):
        file = candidate / ".private" / "ministack.env"
        if file.is_file():
            return file
    return root / ".private" / "ministack.env"


def load_credentials_file(path: Path | None = None) -> bool:
    """Fill missing AWS variables from the env file. Returns whether it was read."""

    file = Path(path) if path else default_credentials_file()
    if not file.is_file():
        return False
    for raw in file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() in (
            "AWS_ACCESS_KEY_ID",
            "AWS_SECRET_ACCESS_KEY",
            "AWS_DEFAULT_REGION",
            "AWS_ENDPOINT_URL",
        ):
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    return True


class MiniStackClient:
    """Small accessor for the boto3 services the fixtures use.

    ``factory`` is injectable so the tests can use a recorder instead of
    boto3. ``None`` means boto3 with credentials from the environment.
    """

    def __init__(self, factory: Callable[[str], Any] | None = None) -> None:
        self._factory = factory
        self._services: dict[str, Any] = {}

    @classmethod
    def from_env(cls) -> "MiniStackClient":
        """Build a client from the operator's environment (and env file)."""

        if not os.environ.get("AWS_SECRET_ACCESS_KEY"):
            load_credentials_file()
        if not os.environ.get("AWS_ENDPOINT_URL"):
            raise RuntimeError(
                "AWS_ENDPOINT_URL is not set; point it at the MiniStack endpoint"
            )

        def factory(service: str) -> Any:
            import boto3  # imported only when a real call is about to happen

            return boto3.client(
                service,
                endpoint_url=os.environ["AWS_ENDPOINT_URL"],
                region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
                aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID", "test"),
                aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
            )

        return cls(factory)

    def service(self, name: str) -> Any:
        """Return a lazily created boto3 service client (or a test double)."""

        if name not in self._services:
            if self._factory is None:
                raise RuntimeError("no client factory configured")
            client = self._factory(name)
            if client is None:
                raise RuntimeError(f"service {name} is not available")
            self._services[name] = client
        return self._services[name]

    def find_image(self, name: str) -> str | None:
        """Return an existing AMI id by name, so a re-run does not duplicate it."""

        for image in self.service("ec2").describe_images(Owners=["self"]).get("Images", []):
            if image.get("Name") == name:
                return image.get("ImageId")
        return None

    def ensure_image(self, name: str, location: str) -> str:
        """Register a container-backed AMI once and return its id."""

        existing = self.find_image(name)
        if existing:
            return existing
        answer = self.service("ec2").register_image(Name=name, ImageLocation=location)
        return answer["ImageId"]

    def find_instances(self, run_id: str) -> list[dict[str, Any]]:
        """Return every EC2 instance this run created."""

        answer = self.service("ec2").describe_instances(
            Filters=[{"Name": "tag:RunId", "Values": [run_id]}]
        )
        found = []
        for reservation in answer.get("Reservations", []):
            found.extend(reservation.get("Instances", []))
        return found

    def send_shell(self, instance_id: str, script: str, timeout_s: float = 180) -> str:
        """Run one shell script in a guest through SSM and wait for its result."""

        sent = self.service("ssm").send_command(
            DocumentName="AWS-RunShellScript",
            InstanceIds=[instance_id],
            Parameters={"commands": [script]},
        )
        command_id = sent["Command"]["CommandId"]
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            invocation = self.service("ssm").get_command_invocation(
                CommandId=command_id, InstanceId=instance_id
            )
            status = invocation.get("Status")
            if status == "Success":
                return invocation.get("StandardOutputContent", "")
            if status in ("Failed", "Cancelled", "TimedOut"):
                raise RuntimeError(
                    f"SSM {status} on {instance_id}: {invocation.get('StandardErrorContent', '')}"
                )
            time.sleep(0.5)
        raise RuntimeError(f"SSM command {command_id} timed out on {instance_id}")
