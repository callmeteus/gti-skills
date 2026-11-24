# Student harnesses

Read this when you choose the student, when the smoke test fails, or when you install the final skill.

## How students are started

Trials and the smoke test start the student through the shared agent runner, `scripts/agent/agent_run.py`. Its registry, `scripts/agent/harnesses.json`, holds each harness's headless command, model flag, permission and isolation flags, and how it writes its session log. The runner checks the optional flags against the installed CLI's `--help` and drops, with a note, any the version does not list. Trials always pass `--yolo` and `--isolate`.

```bash
python3 scripts/agent/agent_run.py list
python3 scripts/agent/agent_run.py spawn --harness <id> --model <model> --prompt "hi" --yolo --isolate --dry-run
```

`list` shows which harnesses are on PATH. `--dry-run` prints the exact command a trial would run, without running it.

## Harnesses

| Id | Harness | Model syntax | Status | Notes |
|----|---------|--------------|--------|-------|
| `omp` | oh-my-pi | `provider/id` from `~/.omp/agent/models.yml` | Tested upstream | Turns off context files, rules, and skills |
| `codex` | Codex CLI | `-m` model id | Tested upstream | Local server: see below. Ignores user config and rules |
| `claude` | Claude Code | `--model` id or alias | Smoke-tested on 2.1 | `--safe-mode` turns off CLAUDE.md, skills, plugins, hooks, and MCP servers. An open model needs `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` through `--env` |
| `opencode` | OpenCode | `provider/model` | Flags verified on 2.2 | No isolation flag; `extract_session.py` has no parser for its JSON log, so trials have no `trace.md` |
| `cursor` | Cursor CLI | `--model` id | Flags verified on 2026.11 | No isolation flag |
| `pi` | Pi | `provider/id` | Documented | Turns off skills |
| `kilo`, `cline`, `command-code` | Kilo, Cline, Command Code | Per CLI | Documented | No isolation flag |

Every `--student` takes `<id>:<model>`. Write extra flags with an equals sign, so a value that starts with `-` is not read as a flag. Codex against a local OpenAI-compatible server:

```bash
python3 scripts/run/distill.py init <task> ... --student codex:<model> \
  --student-args="-c model_provider=local -c model_providers.local.name=local -c model_providers.local.base_url=http://<host>:8000/v1"
```

`--yolo` runs the student with every permission inside its trial workspace (`--dangerously-skip-permissions`, `--dangerously-bypass-approvals-and-sandbox`, `--auto-approve`, `--auto`, `--force`). The workspace is a throwaway clone under `~/.gti/skill-distill/`, but the student process can still reach anything the user's account can. Tell the user this before the first trial, and prefer a container or VM when the task touches shared machines. Where a harness has no isolation flag, the user's own context files and skills may reach the student; say so in the report.

## Your own adapter script

For a harness the registry does not know, write a bash script outside the user's repository (for example `~/.gti/skill-distill/adapters/<name>.sh`) and pass it as `--student script:<path>:<model>`. The runner sets these variables:

| Variable | Meaning |
|----------|---------|
| `WORKSPACE` | Fresh copy of the starting state; the script must `cd` there |
| `PROMPT_FILE` | The original task prompt plus the line that points at the skill |
| `MODEL` | Model id in the harness's own syntax |
| `TRACE_DIR` | Where the script must leave `session.jsonl` |
| `EXTRA_ARGS` | The `--student-args` value |
| Any `--env K=V` | Passed through, for example a base URL |

The script writes the session log to `$TRACE_DIR/session.jsonl` in a format `scripts/agent/extract_session.py` reads (Claude Code, Codex rollout, `codex exec --json`, omp, or pi), streams readable output to stdout, exits with the harness's exit code, and turns off the user's global context where the harness allows it. Run `distill.py smoke` with it first.

## Teacher session logs

`extract_session.py --current <kind> --cwd <dir>` finds the newest session for a folder:

| Kind | Where it looks |
|------|----------------|
| `claude` | `~/.claude/projects/<cwd with every non-alphanumeric character replaced by ->/*.jsonl` |
| `codex` | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`, matched by the recorded working folder |
| `omp` | `~/.omp/agent/sessions/*/*.jsonl`, matched by the recorded working folder |

Other teachers (Cursor, Antigravity, Cline, Kilo, Kiro, Copilot, Muse Code, OpenCode) have no parser. Write `reference/reference.md` by hand from the conversation instead: the task, the steps that mattered in order, the files written, the dead ends, and the final answer. Run `init` without `--reference`.

## Installing the final skill

Install only when the user asks. The skill goes where the student harness looks for skills:

| Harness | User skills folder |
|---------|--------------------|
| omp | `~/.omp/agent/skills/<name>/` |
| pi | `~/.pi/agent/skills/<name>/`, or pass `--skill <dir>` |
| Claude Code | `~/.claude/skills/<name>/` |
| Codex | `~/.agents/skills/<name>/` |
| OpenCode | `~/.config/opencode/skills/<name>/` |
| Cursor | `~/.cursor/skills/<name>/` |
