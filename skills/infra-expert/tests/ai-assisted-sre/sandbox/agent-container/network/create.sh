#!/usr/bin/env bash
# Create the dedicated Docker network for the agent container. Idempotent.
# Building and running is a later task; this script is provided, not executed.
set -euo pipefail

NETWORK="ai-sre-sandbox"
SUBNET="${SUBNET:-172.31.5.0/24}"

if docker network inspect "$NETWORK" >/dev/null 2>&1; then
    echo "network $NETWORK already exists"
else
    # IPv4 only: the isolation rules are iptables -4 rules. An IPv6 address on
    # the agent container would give it a second path to the host's other
    # services and to private networks that these rules cannot see.
    docker network create --driver bridge --ipv6=false --subnet "$SUBNET" "$NETWORK"
    echo "created $NETWORK with $SUBNET (IPv4 only)"
fi
