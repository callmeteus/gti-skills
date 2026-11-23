# AI-assisted SRE scenario runner

Runs a real AI agent with the Infra Expert skill against a fake company in an isolated sandbox and checks that it avoids the failures seen in real infrastructure chats.

## Overview

This package is the behavior test suite of the [Infra Expert](../../README.md) skill. Each scenario in `scenarios/` turns one rule of the skill (one numbered topic, a backup rule, the run folder, zero downtime, CVE mode) into a reproducible run: the agent gets a prompt, works in a sandbox on a MiniStack notebook against the fictional ACME company (`acme.test`), and the runner scores the result. The sandbox holds a fake project repository, a fake read-only production MCP, a fake pipeline, a fake secret store, and short-lived EC2 guest hosts. Nothing here connects to production.

A scenario verdict is `PASS` only when every scripted check passes and the LLM judge reports no failing rubric bullet. A failing agent is a valid result; a crash of the runner is recorded as a failure of the runner, not silently hidden.

It lives in the skill's `tests/` folder, which the CLI never installs into an agent, so the scenarios never reach an agent that uses the skill. The package does not install the skill, provision the notebook, or run in CI. CI runs only its unit tests, which need no network, no Docker, and no notebook.

### Safety model

The agent runs in a container on the dedicated `ai-sre-sandbox` Docker network. Outbound internet stays open for the model provider; private and CGNAT ranges are dropped for forwarded traffic, and traffic to the notebook itself is allowed only to MiniStack TCP 4566 and DNS. The forwarding rules live in a dedicated `AI-SRE-FORWARD` chain reached by one jump from `DOCKER-USER`, so no other service's rules are flushed; `isolate.sh --remove` deletes both jumps and both chains. All fake state lives under one run directory, mounted into the container and shared with the fake tools.

The model provider credential is the only secret the container receives. The runner reads one provider entry from the local OpenCode credential store, writes it to `<run>/auth.json` with mode 600, mounts it read-only, imports it in the container, and deletes it at teardown. No other provider entry is copied, no credential is printed, and nothing secret is baked into the image. The MiniStack client credentials are read from the operator's `ministack.env` (see [Environment](#environment)) in memory and never echoed.

The credential is deleted by a guard on normal exit, signal, or abort, and every run starts by sweeping `runs/*/auth.json` files older than two hours. A detached run publishes `status.json` while it works and records its verdict when it finishes. `remote fetch` never copies `auth.json` back.

## Run

From the package folder, after `pip install -e .` (or use `./ai-sre` directly):

```bash
cd skills/infra-expert/tests/ai-assisted-sre
export AI_SRE_NOTEBOOK=ubuntu@your-ministack-notebook
ai-sre list
ai-sre validate --all
ai-sre remote run s07-keep-stderr --agent opencode \
  --model opencode-go/hy4-flash-free --judge-model opencode-go/hy4-flash-free
```

`remote` syncs the package to `/data/ai-assisted-sre` on `AI_SRE_NOTEBOOK`, writes the single-provider credential into the run directory, and starts the run **detached** with `nohup` and a pid file. It prints the run id immediately, so a dropped SSH session cannot lose the result. Follow the run with:

```bash
ai-sre remote status RUN                 # state, verdict, pid
ai-sre remote fetch RUN                  # copy a finished run into ~/.gti/infra-expert/scenarios/results/
ai-sre remote run s07-... --wait --model ...   # poll every 30 s, then fetch
ai-sre remote cleanup RUN                # tear down leftover guests/container/auth
ai-sre remote cleanup                    # clean every run whose runner is gone
```

To drive the notebook yourself, the equivalent local commands are `ai-sre run ID --model ...` and `ai-sre report RUN`. `run --all` executes the whole catalog. `--keep` keeps the agent container and the EC2 guests for inspection; without it, teardown stops the container and terminates the guests but keeps the run artifacts so a report can still be printed.

Each run directory contains `scenario.yaml`, `result.json`, `report.md`, the OpenCode export (`transcript.json`), the fake MCP log (`mcp.jsonl`), the pipeline log (`pipeline.jsonl`), the secret store, the mirrored guest files, and the prepared repo clone. `ai-sre report RUN` prints the Markdown report.

### Install the sandbox on the notebook

Build the image from the repository root, create the network, and apply the isolation rules as described in [sandbox/agent-container/README.md](sandbox/agent-container/README.md). Review `isolate.sh --print --ministack-ip <address>` before `--apply`, set `MINISTACK_IP` in `agent-container/network/ai-sre-sandbox-isolate.service`, and install the unit so the rules survive a reboot. The install records MiniStack health and `docker ps` before and after; neither may change except for the new sandbox containers.

### Add a scenario

Create `scenarios/sNN-<slug>/` with `scenario.yaml` and `README.md`, follow [SCHEMA.md](SCHEMA.md), use only the allowed check kinds and fault names, add at least two script-decidable checks and a judge rubric of three to six pass/fail bullets, add a row to [scenarios/INDEX.md](scenarios/INDEX.md), then run `ai-sre validate sNN-<slug>`. When a scenario tests a new rule of the skill, change the skill in the same pull request.

## Layout

| Path | Responsibility |
|------|----------------|
| `SCHEMA.md`, `scenarios/` | The scenario catalog and its contract |
| `sandbox/` | Fixtures, the fake MCP, pipeline, and secret store, the command simulator, faults, and the agent container |
| `runner/` | The `ai-sre` CLI: list, validate, run, report, remote |
| `checks/` | One evaluator per state-check kind, transcript checks, the secret-leak check, and the LLM judge |
| `tests/`, `sandbox/tests/` | pytest coverage for every evaluator, followups, credentials, the remote commands, the fakes, and the report format |

## Scripts

| Command | Action |
|---------|--------|
| `ai-sre list` | List the scenarios |
| `ai-sre validate --all` | Validate every scenario against `SCHEMA.md` |
| `ai-sre run ID --model P/M` | Run one scenario on the machine that hosts MiniStack |
| `ai-sre report RUN` | Print the Markdown report of a run |
| `ai-sre remote <subcommand>` | Run `list`, `validate`, `run`, `status`, `fetch`, `cleanup`, or `report` on the notebook |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `AI_SRE_NOTEBOOK` | None, required by `remote` | SSH target of the MiniStack notebook, for example `ubuntu@host` |
| `AI_SRE_MINISTACK_ENV` | `~/.gti/infra-expert/scenarios/ministack.env` | File with `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, and `AWS_ENDPOINT_URL` for MiniStack |
| `AI_SRE_VENDOR_DIR` | `~/.gti/infra-expert/scenarios/vendor` | Vendored Python dependencies synced to the notebook's `vendor/` |
| `GTI_HOME` | `~/.gti` | Replaces `~/.gti` for the credentials file, `vendor/`, and `results/` |
| `AI_SRE_RUNS_ROOT` | `runs/` in the package | Folder that holds run directories |
| `OPENCODE_AUTH_FILE` | OpenCode's `auth.json` | Credential store read for the one provider entry |

## Testing

```bash
cd skills/infra-expert/tests/ai-assisted-sre
pip install -r requirements.txt
python -m pytest -q
```

The tests cover every check evaluator, the runner, the remote commands with fake SSH and rsync, the fake MCP, pipeline, and secret store, the faults, and the rendered isolation rules. Some tests need Linux (`bash`, POSIX file modes, `SIGHUP`); run them on Linux or in a container.

See [../../../../README.md](../../../../README.md) for the full repository.
