# Agent container and network

Build from the gti-skills repository root so the skill and this package are in the build context:

```bash
docker build -f skills/infra-expert/tests/ai-assisted-sre/sandbox/agent-container/Dockerfile \
  -t ai-sre-sandbox-agent .
```

The image has OpenCode, the `infra-expert` skill copied from `skills/infra-expert` without its `tests/` folder, the fake MCP `acme-prod`, the `pipeline` / `secret` / `notify` CLIs on PATH, and the fake ACME repo in `/work/acme-infra`. The entrypoint renders `opencode.json` with the run id and starts one non-interactive run.

Network, done by the operator in the bring-up task (not by this build):

```bash
bash sandbox/agent-container/network/create.sh
bash sandbox/agent-container/network/isolate.sh --print   # review first
bash sandbox/agent-container/network/isolate.sh --apply
```

`create.sh` makes the network IPv4-only: the isolation rules are IPv4, and an IPv6 address would give the agent a second path to the host's other services that those rules cannot see. `isolate.sh` adds source-scoped rules for `ai-sre-sandbox` only. `DOCKER-USER` filters forwarded traffic: internet stays open for the model provider, the sandbox subnet and the MiniStack endpoint stay reachable, private/CGNAT ranges are dropped. A dedicated `AI-SRE-INPUT` chain filters traffic to the notebook itself, which `DOCKER-USER` never sees: only MiniStack TCP 4566 and DNS to the Docker resolver are accepted; other host-bound traffic is dropped. The systemd unit in `network/` reapplies the rules at boot; it is provided, not installed.

Run the agent with `ACME_SANDBOX_RUN_ID=<id> ACME_SANDBOX_PROMPT=<file>`. The MCP and the CLIs inherit the same run id from the environment, so all of them read the same run directory.
