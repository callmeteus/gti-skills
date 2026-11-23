"""The isolation script renders source-scoped DOCKER-USER and INPUT rules."""

from __future__ import annotations

import subprocess
from pathlib import Path

SANDBOX = Path(__file__).resolve().parents[1]
NETWORK = SANDBOX / "agent-container" / "network"
SCRIPT = NETWORK / "isolate.sh"


def render(
    subnet: str = "172.31.5.0/24",
    ministack: str = "100.70.0.10",
    resolver: str = "127.0.0.11",
) -> str:
    """Ask the script for its rules without touching iptables."""

    completed = subprocess.run(
        ["bash", str(SCRIPT), "--print", "--subnet", subnet,
         "--ministack-ip", ministack, "--resolver", resolver],
        text=True, capture_output=True, check=True,
    )
    return completed.stdout


def rules_for(lines: list[str], chain: str) -> list[str]:
    """Return only the rules appended to one chain."""

    return [line for line in lines if line.startswith(f"-A {chain} ")]


def test_rules_are_scoped_to_the_sandbox_subnet() -> None:
    """No rule mentions another container network."""

    lines = render().splitlines()
    assert lines[0] == "*filter"
    assert lines[-1] == "COMMIT"
    forwarded = rules_for(lines, "AI-SRE-FORWARD")
    assert len(forwarded) == 8
    private_drops = [line for line in forwarded if "-j DROP" in line]
    assert len(private_drops) == 4
    for cidr in ("100.64.0.0/10", "10.0.0.0/8", "192.168.0.0/16", "172.16.0.0/12"):
        assert any(cidr in line for line in private_drops)
    assert all("-s 172.31.5.0/24" in line for line in private_drops)


def test_ministack_and_sandbox_are_allowed_before_private_drops() -> None:
    """Order matters: allowing MiniStack after the CGNAT drop would block it."""

    lines = render().splitlines()
    allow_sandbox = next(i for i, line in enumerate(lines) if "-d 172.31.5.0/24 -j RETURN" in line)
    allow_ministack = next(i for i, line in enumerate(lines) if "-d 100.70.0.10/32 -j RETURN" in line)
    drop_cgnat = next(i for i, line in enumerate(lines) if "-d 100.64.0.0/10 -j DROP" in line)
    drop_private = next(i for i, line in enumerate(lines) if "-d 172.16.0.0/12 -j DROP" in line)
    drop_global = next(i for i, line in enumerate(lines) if "-d 10.0.0.0/8 -j DROP" in line)
    assert allow_sandbox < drop_private
    assert allow_ministack < drop_cgnat
    assert allow_ministack < drop_global
    assert drop_global < drop_private
    assert "-A AI-SRE-FORWARD -j RETURN" in lines


def test_input_rules_allow_only_ministack_and_dns_to_the_host() -> None:
    """Traffic to the notebook itself is filtered separately from forwarding."""

    lines = render().splitlines()
    incoming = rules_for(lines, "AI-SRE-INPUT")
    assert len(incoming) == 4
    assert "-A AI-SRE-INPUT -s 172.31.5.0/24 -d 100.70.0.10/32 -p tcp --dport 4566 -j ACCEPT" in incoming
    assert "-A AI-SRE-INPUT -s 172.31.5.0/24 -d 127.0.0.11/32 -p udp --dport 53 -j ACCEPT" in incoming
    assert "-A AI-SRE-INPUT -s 172.31.5.0/24 -d 127.0.0.11/32 -p tcp --dport 53 -j ACCEPT" in incoming
    assert incoming[-1] == "-A AI-SRE-INPUT -s 172.31.5.0/24 -j DROP"
    assert all(line.startswith("-A AI-SRE-INPUT -s 172.31.5.0/24") for line in incoming)
    assert "-A INPUT -j AI-SRE-INPUT" in lines
    assert ":AI-SRE-INPUT - [0:0]" in lines
    assert lines.index("-A AI-SRE-INPUT -s 172.31.5.0/24 -d 100.70.0.10/32 -p tcp --dport 4566 -j ACCEPT") < lines.index(incoming[-1])


def test_custom_subnet_endpoint_and_resolver_are_used() -> None:
    """The rendered rules follow the arguments, not hardcoded values."""

    text = render(subnet="10.55.0.0/16", ministack="100.70.1.2", resolver="10.55.0.2")
    assert "-s 10.55.0.0/16 -d 100.70.1.2/32 -j RETURN" in text
    assert "-s 10.55.0.0/16 -d 10.0.0.0/8 -j DROP" in text
    assert "-A AI-SRE-INPUT -s 10.55.0.0/16 -d 100.70.1.2/32 -p tcp --dport 4566 -j ACCEPT" in text
    assert "-A AI-SRE-INPUT -s 10.55.0.0/16 -d 10.55.0.2/32 -p udp --dport 53 -j ACCEPT" in text


def test_shared_docker_user_chain_is_never_flushed() -> None:
    """Other services' DOCKER-USER rules must survive apply and remove."""

    source = SCRIPT.read_text(encoding="utf-8")
    assert "-F DOCKER-USER" not in source
    assert "-A AI-SRE-FORWARD -j RETURN" in render()
    lines = render().splitlines()
    assert "-A DOCKER-USER -j AI-SRE-FORWARD" in lines
    assert rules_for(lines, "DOCKER-USER") == ["-A DOCKER-USER -j AI-SRE-FORWARD"]
    assert ":AI-SRE-FORWARD - [0:0]" in lines


def test_remove_deletes_both_jumps_and_both_chains() -> None:
    """--remove is the inverse of --apply and does not touch shared chains."""

    source = SCRIPT.read_text(encoding="utf-8")
    assert "--remove)" in source
    assert "iptables -D DOCKER-USER -j AI-SRE-FORWARD" in source
    assert "iptables -D INPUT -j AI-SRE-INPUT" in source
    assert "iptables -F AI-SRE-FORWARD" in source
    assert "iptables -F AI-SRE-INPUT" in source
    assert 'for chain in AI-SRE-FORWARD AI-SRE-INPUT' in source
    assert 'iptables -X "$chain"' in source
    completed = subprocess.run(
        ["bash", "-n", str(SCRIPT)], text=True, capture_output=True, check=True,
    )
    assert completed.returncode == 0


def test_network_is_created_ipv4_only() -> None:
    """An IPv6 address would bypass the IPv4 isolation rules."""

    create = (NETWORK / "create.sh").read_text(encoding="utf-8")
    assert "--ipv6=false" in create
    assert "IPv4 only" in create
