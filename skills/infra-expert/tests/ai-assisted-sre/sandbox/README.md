# AI-assisted SRE sandbox

Everything a scenario test needs, except the scenarios themselves (written by another worker). The company is fictional (ACME, domain `acme.test`), and no real host, product or address from the operator's estate appears in `repo-templates/`.

| Path | What it is |
|---|---|
| `repo-templates/base/` | Fake ACME infrastructure repo, facts only: what exists, where, which tools and flags, the two pipeline leaves, inventory and a `.gti/infra-expert/` knowledge folder describing the fake tools. It holds no agent-behavior rules, so it cannot teach a scenario's answers |
| `repo-templates/project-rules/` | The same relative paths, with the behavior rules that were kept out of `base/` written verbatim. A scenario opts in by putting these files in `setup.repo.overlay` |
| `fake_mcp/` | `acme-prod` MCP over stdio: six tools, read-only guard, JSONL logging and secret-leak flags |
| `fake_pipeline/` | `pipeline plan\|apply <leaf>` and `pipeline status <run>`; refuses leaves not in `pipeline.yaml` |
| `fake_secrets/` | File-backed secret store and the `secret` CLI |
| `fixtures.py` | Creates and destroys per-run MiniStack EC2 guests, files, services, tags and host env files; `prepare_run(scenario, run_id, root, client)` is the entry point |
| `faults/` | One module per fault name, each with `apply(run)` |
| `hostfs.py` | Local mirror of guest files and the command simulator behind the fake MCP |
| `agent-container/` | Dockerfile, entrypoint, wrapper CLIs, OpenCode config template, IPv4-only Docker network script, and `DOCKER-USER` (forwarded) plus `INPUT` (to the host) isolation rules |

Runs share state through `ACME_SANDBOX_RUN_ID` and `ACME_SANDBOX_ROOT`; each process loads `RunContext` from `<root>/runs/<run>/context.json`. The fake MCP writes `mcp.jsonl`, the pipeline writes `pipeline.jsonl` and the secret store is `secrets.json`. Fixture secret values are recorded in the same store so a leak can be detected.

## Base facts and the rules overlay

`repo-templates/base/` is deliberately silent about how an agent should behave: it names the tools, their inputs, the leaves in `pipeline.yaml`, where secrets and records live and the host aliases. The one exception is the plain fact that secret values are not stored in the repository. A scenario that measures infra work clones this template, so any correct answer has to come from the `infra-expert` skill rather than from the repository text.

`repo-templates/project-rules/` mirrors the same relative paths and contains the removed rules unchanged. A scenario that tests rule-following opts in with the overlay, for example:

```yaml
setup:
  repo:
    template: base
    overlay:
      AGENTS.md: "<contents of repo-templates/project-rules/AGENTS.md>"
      .gti/infra-expert/access.md: "<contents of repo-templates/project-rules/.gti/infra-expert/access.md>"
```

Only the files named in the overlay are replaced; every other file stays at its base version.

## Network isolation

`agent-container/network/isolate.sh --print` renders two chains. `DOCKER-USER` filters forwarded traffic from the sandbox subnet: the internet, the sandbox subnet and the MiniStack endpoint are allowed, private and CGNAT ranges are dropped. `INPUT` filters traffic from that subnet to the notebook itself, which `DOCKER-USER` never sees: only MiniStack TCP 4566 and DNS to the Docker resolver are accepted, and all other host-bound traffic is dropped. `create.sh` creates `ai-sre-sandbox` with `--ipv6=false` because the rules are IPv4 and an IPv6 address would give the agent a second, unfiltered path to the host's other services.

```bash
python3 -m pytest skills/infra-expert/tests/ai-assisted-sre/sandbox/tests -q
python3 -m sandbox.fake_mcp        # stdio MCP, requires a run context
python3 -m sandbox.fake_pipeline status <run>
python3 -m sandbox.fake_secrets list /shop
```

Building the image, creating the Docker network, applying iptables and running scenarios are the next task; this package only writes the files.
