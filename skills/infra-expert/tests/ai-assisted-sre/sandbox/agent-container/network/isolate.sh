#!/usr/bin/env bash
# Isolation rules for the ai-sre-sandbox network.
#
# DOCKER-USER only filters traffic *forwarded* through the host, and it is a
# chain Docker and other services also own. Never flush it: our rules live in
# AI-SRE-FORWARD and a single jump at the top of DOCKER-USER is installed only
# when it is missing. Traffic from the agent container to the notebook itself
# traverses INPUT instead, so it is filtered by a separate AI-SRE-INPUT chain:
# only the MiniStack API port and DNS stay reachable. Outbound traffic to the
# internet still passes for the model provider.
#
# Every rule is source-scoped to SUBNET, so other Docker networks are untouched.
#
# Usage:
#   isolate.sh --print [--subnet CIDR] [--ministack-ip IP] [--ministack-docker-ip IP] [--resolver IP]
#   isolate.sh --apply [--subnet CIDR] [--ministack-ip IP] [--ministack-docker-ip IP] [--resolver IP]
#   isolate.sh --remove
# `--print` only renders the rules; `--apply` and `--remove` need root.
set -euo pipefail

SUBNET="${SUBNET:-}"
MINISTACK_IP="${MINISTACK_IP:-}"
MINISTACK_DOCKER_IP="${MINISTACK_DOCKER_IP:-}"
RESOLVER="${RESOLVER:-127.0.0.11}"
MODE=""

usage() {
    echo "usage: isolate.sh --print|--apply|--remove [--subnet CIDR] [--ministack-ip IP] [--ministack-docker-ip IP] [--resolver IP]" >&2
    exit 2
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --print)       MODE="print"; shift ;;
        --apply)       MODE="apply"; shift ;;
        --remove)      MODE="remove"; shift ;;
        --subnet)      SUBNET="${2:-}"; [[ -n "$SUBNET" ]] || usage; shift 2 ;;
        --ministack-ip) MINISTACK_IP="${2:-}"; [[ -n "$MINISTACK_IP" ]] || usage; shift 2 ;;
        --ministack-docker-ip) MINISTACK_DOCKER_IP="${2:-}"; [[ -n "$MINISTACK_DOCKER_IP" ]] || usage; shift 2 ;;
        --resolver)    RESOLVER="${2:-}"; [[ -n "$RESOLVER" ]] || usage; shift 2 ;;
        -h|--help)     usage ;;
        *) echo "unknown argument: $1" >&2; usage ;;
    esac
done

[[ -n "$MODE" ]] || usage

# Teardown does not need a subnet or a Docker lookup: remove our two jumps and
# our two chains only. DOCKER-USER and INPUT keep every rule they already have.
if [[ "$MODE" == "remove" ]]; then
    iptables -D DOCKER-USER -j AI-SRE-FORWARD 2>/dev/null || true
    iptables -D INPUT -j AI-SRE-INPUT 2>/dev/null || true
    for chain in AI-SRE-FORWARD AI-SRE-INPUT; do
        if iptables -n -L "$chain" >/dev/null 2>&1; then
            iptables -F "$chain"
            iptables -X "$chain"
        fi
    done
    echo "removed AI-SRE-FORWARD and AI-SRE-INPUT jumps and chains"
    exit 0
fi

# Both --print and --apply need the subnet; discover it in either mode so the
# reviewed rules are exactly the ones that get applied.
if [[ -z "$SUBNET" ]] && command -v docker >/dev/null 2>&1; then
    SUBNET="$(docker network inspect ai-sre-sandbox -f '{{range .IPAM.Config}}{{.Subnet}}{{end}}' 2>/dev/null || true)"
fi
if [[ -z "$SUBNET" ]]; then
    echo "SUBNET is required; pass --subnet or create the ai-sre-sandbox network" >&2
    exit 2
fi
if [[ -z "$MINISTACK_IP" ]]; then
    echo "MINISTACK_IP is required; pass --ministack-ip with the notebook's MiniStack address" >&2
    exit 2
fi

# A connection from the sandbox to the published MiniStack port is DNATed by
# Docker to the MiniStack container address *before* the filter chain runs.
# DOCKER-USER therefore sees that container IP, not the NetBird IP, and a bare
# drop of RFC1918 ranges would black-hole the one endpoint the agent needs.
if [[ -z "$MINISTACK_DOCKER_IP" ]] && command -v docker >/dev/null 2>&1; then
    MINISTACK_DOCKER_IP="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' ministack 2>/dev/null | awk '{print $1}' || true)"
fi
MINISTACK_DOCKER_RULES=()
if [[ -n "$MINISTACK_DOCKER_IP" ]]; then
    MINISTACK_DOCKER_RULES+=("-s ${SUBNET} -d ${MINISTACK_DOCKER_IP}/32 -p tcp --dport 4566 -j RETURN")
fi

# Forwarded traffic: allow the internet, the sandbox itself and MiniStack, then
# drop private and CGNAT ranges. The two allow rules come before the drop of
# 100.64.0.0/10 because the MiniStack endpoint lives inside that range.
DOCKER_RULES=(
    "-m conntrack --ctstate ESTABLISHED,RELATED -j RETURN"
    "-s ${SUBNET} -d ${SUBNET} -j RETURN"
    "-s ${SUBNET} -d ${MINISTACK_IP}/32 -j RETURN"
    "${MINISTACK_DOCKER_RULES[@]}"
    "-s ${SUBNET} -d 100.64.0.0/10 -j DROP"
    "-s ${SUBNET} -d 10.0.0.0/8 -j DROP"
    "-s ${SUBNET} -d 192.168.0.0/16 -j DROP"
    "-s ${SUBNET} -d 172.16.0.0/12 -j DROP"
    "-j RETURN"
)

# Traffic to the host itself (INPUT), not just through it (DOCKER-USER).
INPUT_RULES=(
    "-s ${SUBNET} -d ${MINISTACK_IP}/32 -p tcp --dport 4566 -j ACCEPT"
    "-s ${SUBNET} -d ${RESOLVER}/32 -p udp --dport 53 -j ACCEPT"
    "-s ${SUBNET} -d ${RESOLVER}/32 -p tcp --dport 53 -j ACCEPT"
    "-s ${SUBNET} -j DROP"
)

if [[ "$MODE" == "print" ]]; then
    echo "*filter"
    echo ":DOCKER-USER - [0:0]"
    echo "-A DOCKER-USER -j AI-SRE-FORWARD"
    echo ":AI-SRE-FORWARD - [0:0]"
    for rule in "${DOCKER_RULES[@]}"; do
        echo "-A AI-SRE-FORWARD ${rule}"
    done
    echo ":AI-SRE-INPUT - [0:0]"
    for rule in "${INPUT_RULES[@]}"; do
        echo "-A AI-SRE-INPUT ${rule}"
    done
    echo "-A INPUT -j AI-SRE-INPUT"
    echo "COMMIT"
    exit 0
fi

# Apply. Create the chains if needed, flush only ours, and add one jump. The
# jump is never duplicated, so re-applying is idempotent and leaves other
# services' DOCKER-USER rules exactly where they were.
iptables -n -L DOCKER-USER >/dev/null 2>&1 || iptables -N DOCKER-USER
iptables -n -L AI-SRE-FORWARD >/dev/null 2>&1 || iptables -N AI-SRE-FORWARD
iptables -F AI-SRE-FORWARD
for rule in "${DOCKER_RULES[@]}"; do
    # shellcheck disable=SC2086 -- each rule is a fixed, quoted list of flags
    iptables -A AI-SRE-FORWARD $rule
done
iptables -C DOCKER-USER -j AI-SRE-FORWARD 2>/dev/null || iptables -I DOCKER-USER 1 -j AI-SRE-FORWARD

iptables -n -L AI-SRE-INPUT >/dev/null 2>&1 || iptables -N AI-SRE-INPUT
iptables -F AI-SRE-INPUT
for rule in "${INPUT_RULES[@]}"; do
    # shellcheck disable=SC2086 -- each rule is a fixed, quoted list of flags
    iptables -A AI-SRE-INPUT $rule
done
iptables -C INPUT -j AI-SRE-INPUT 2>/dev/null || iptables -I INPUT 1 -j AI-SRE-INPUT

echo "rules applied for ${SUBNET} (MiniStack ${MINISTACK_IP} / docker ${MINISTACK_DOCKER_IP:-none}, resolver ${RESOLVER})"
