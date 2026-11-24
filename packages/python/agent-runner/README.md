# Agent runner

One command to start, resume, and record headless coding-agent sessions in any harness.

## Overview

This package owns how gti-skills calls an external coding agent: the headless command of each harness, its model, session, permission, and isolation flags, how its chat id is captured, and how its session log is read. [Skill Distill](../../../skills/skill-distill/README.md) uses it to run student models, and [Maestro](../../../skills/maestro/README.md) uses it to spawn and resume CLI workers. `node packages/cli build` copies `scripts/agent/` into both skills, because an installed skill must be self-contained.

It does not choose models, write briefs or prompts, judge results, or talk to MCP orchestrators; the skills do that. It uses only the Python standard library.

```text
  skill ──> agent_run.py spawn --harness <id> --model <m> --cwd <dir> --prompt-file <f>
                │
                ├── harnesses.json ─> argv: bin + spawn + session + model + yolo + isolate + extra + prompt
                ├── --help check ───> optional flags the installed version lacks are dropped and reported
                ├── run in <dir> ───> readable lines on stdout, raw JSON log to --trace, timeout -> 124
                └── result JSON ────> session (chat id), resumable, exit code, command, dropped flags
```

| Harness | Id | Resume | Chat id | Status |
|---------|----|:------:|---------|--------|
| Claude Code | `claude` | Yes | Assigned UUID (`--session-id`) | Tested on 2.1 (smoke test) |
| Codex CLI | `codex` | Yes | `thread_id` in the JSON events | Tested upstream |
| OpenCode | `opencode` | Yes | `sessionID` in the JSON events, or `--session` | Flags verified on 2.2 |
| Cursor CLI | `cursor` | Yes | `agent create-chat` before the first prompt | Flags verified on 2026.11 |
| Paseo CLI | `paseo` | Yes | `id` in `paseo run --json` | Flags verified on 0.13 |
| oh-my-pi | `omp` | No | None | Tested upstream |
| Pi | `pi` | Yes | Assigned name (`--session-id`) | Documented |
| Kilo Code | `kilo` | Yes | Assigned name (`--session`) | Documented |
| Cline CLI | `cline` | Yes | From the JSON output | Documented |
| Command Code | `command-code` | Yes | Assigned name (`-n`) | Documented |
| OpenAgents Coder | `openagents` | Yes | From the JSON output | Documented |
| Your own script | `script:<path>` | No | None | Adapter contract |

"Verified" means the flags were checked against the installed CLI's `--help`; no model was called. "Tested" means a real run end to end: the smoke test here, or the skill-distill project upstream. Claude Code's `stream-json` log does not repeat the prompt, so its summary has no task line.

## Run

From the repository root:

```bash
python3 packages/python/agent-runner/scripts/agent/agent_run.py list
python3 packages/python/agent-runner/scripts/agent/agent_run.py spawn --harness claude --model haiku \
  --cwd ./scratch --prompt "Create hello.txt" --dry-run
python3 packages/python/agent-runner/scripts/agent/agent_run.py smoke --harness opencode --model <provider/model>
```

From an installed skill, the same script is at `<skill-dir>/scripts/agent/agent_run.py`. Use `python` or `py -3` on Windows; the runner itself has no POSIX-only dependency, but the skills that use it may.

## Layout

| Path | Responsibility |
|------|----------------|
| `scripts/agent/agent_run.py` | The CLI: `list`, `spawn`, `resume`, `models`, `smoke` |
| `scripts/agent/harnesses.json` | The registry: per harness, the binary, headless spawn and resume arguments, session id strategy, model, provider, title, permission (`yolo`), and isolation flags, prompt passing, log location, and model listing command |
| `scripts/agent/extract_session.py` | Turns Claude Code, Codex, `codex exec --json`, omp, and pi logs into a readable Markdown or JSON summary, without system or instruction-file text |
| `scripts/agent/LICENSE.txt` | MIT license for the code adapted from skill-distill, shipped with every synced copy |
| `tests/` | Tests with fake harness CLIs on PATH |
| `LICENSE` | MIT |

## Scripts

| Command | Action |
|---------|--------|
| `agent_run.py list [--json]` | Show every registry harness, its path and version when installed, whether it resumes, and its status |
| `agent_run.py spawn --harness <id> [--model] [--provider] [--title] [--agent] [--session] --cwd <dir> (--prompt \| --prompt-file) [--trace] [--result] [--timeout] [--yolo] [--isolate] [--extra-args="..."] [--env K=V] [--background] [--dry-run] [--quiet]` | Start a session; exit code is the harness's, 124 on timeout |
| `agent_run.py resume --harness <id> --session <id> ...` | Send a new prompt to a recorded session |
| `agent_run.py models --harness <id> [--provider]` | Run the harness's own model listing command |
| `agent_run.py smoke --harness <id> [--model] [--out <dir>] [--isolate] [--timeout 300]` | Ask the agent to create `hello.txt` in a scratch git folder; exit code 1 when it does not |
| `extract_session.py LOG [-o md] [--json file]` or `--current claude\|codex\|omp --cwd <dir>` | Summarize a session log |

Flags:

- **`--yolo`:** skips the harness's permission prompts. Use it only in a throwaway folder or worktree.
- **`--isolate`:** turns off the user's global context files, rules, and skills where the harness has a flag for it.
- **`--extra-args`:** appended verbatim; write it with `=` when the value starts with `-`.
- **`--background`:** needs `--result`; returns at once with the pid, and the result JSON and a `.log` appear when the session ends.
- **`--dry-run`:** prints the command and the result skeleton. It runs only the harness's `--help`, to check optional flags, and not even Cursor's `create-chat`.

A `script:<path>` adapter gets `WORKSPACE`, `PROMPT_FILE`, `MODEL`, `TRACE_DIR`, and `EXTRA_ARGS`, runs the agent in `$WORKSPACE`, and leaves `$TRACE_DIR/session.jsonl`.

To add a harness, add an entry to `harnesses.json` from the CLI's `--help`, add a fake for it in the tests, run `node packages/cli build`, and set `status` to `documented` until it has run end to end.

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `GTI_HOME` | `~/.gti` | Root of the default `smoke` folder, `~/.gti/<skill>/<project>/smoke/` |

## Testing

```bash
python -m unittest discover -s packages/python/agent-runner/tests -v
```

The tests put fake `claude`, `codex`, `agent`, `pi`, and `opencode` CLIs on PATH and check the built commands, flag dropping from `--help`, chat id capture from arguments, JSON events, and `create-chat`, session-folder logs, timeouts, exit codes, adapter scripts, background runs, dry runs, `smoke`, and `list`. They call no model.

See [../../../README.md](../../../README.md) for the full repository.
