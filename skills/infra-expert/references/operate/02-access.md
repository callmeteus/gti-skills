# Operate mode: access

Access is a cost: every new connection costs time, and every script that runs in the wrong place costs trust. Reuse one connection per target, keep scripts in files, and batch across a fleet.

## Reuse one connection

- Prefer the project MCP's read-only tools, because they reuse the existing connection and the first read opens it for later reads. Do not open a session before a read-only tool that already reuses one.
- Use the tool's own filter parameters (`grep`, `tail`, `path`, `limit`) instead of piping its output through a shell command. Do not add a `| grep` just to shorten a response, because the pipe can force the call onto a write-capable path that opens a new connection and a confirmation dialog.
- Use the MCP's session tools when the project documents them for writes. Do not run one `--execute`-style command per line, because each line then opens a fresh connection when the gateway is slow.

Example: pass `grep=error` to the log tool; do not fetch the whole log and pipe it to `grep`.

## Scripts go in files

- Put any script longer than three lines in a local file and send it with `ssh <host> 'bash -s' < script.sh` or the project CLI's stdin mode (`project-cli <host> execute --stdin < script.sh`). Do not nest heredocs or embed one inside a command substitution, because a misplaced quote changes where the script runs.
- Start every remote script with a hostname guard that exits on the wrong host. Do not rely on the target named in the prompt, because a script that reaches the wrong machine may still run to the end.

```bash
[ "$(hostname)" = "app-host-02" ] || { echo "wrong host: $(hostname)"; exit 1; }
set -o pipefail
```

- Fix a script that fails in the local file and send the corrected file again, by stdin or by `scp` followed by a run command. Do not base64-encode the script into a heredoc inside the write command and resend the whole encoded string on each attempt, because the command becomes unreadable and every retry repeats the same quoting risk. Example: `scp fix.sh <host>:/tmp/fix.sh` then `ssh <host> 'bash /tmp/fix.sh'`.
- Generate parameter files with a JSON serializer and pass them by `file://` or stdin. Do not build JSON by string concatenation in a shell variable, because escaping changes between the test and the real call.
- Load secret values from an env file with `set -a; . <file>; set +a`, with unquoted values in the file. Do not pass a value on a command line, because it ends up in shell history and transcripts.

## First access and long-running services

- Install an SSH key on first access, then use only the documented alias. Do not embed a password in a script or open a fresh authenticated connection on every loop iteration, because the password then lives in the transcript and the loop reconnects each time.
- Start a new service as a systemd unit or a container with a restart policy from the first test. Do not use `nohup` inside an SSH session, because the process dies when the session closes.
- Change appliance configuration through its API or YAML files, not through its internal state database, because an in-place edit can put the appliance in a restart loop.

Example: install the key, use `ssh app-host-02` afterwards, and define the unit with `Restart=on-failure` before the first start.

## Batch across a fleet

- Write one script that loops over the hosts from the inventory and emits one JSON object per host; read that file once. Do not make one tool call per host, container, or dashboard, because every call costs a full round trip and any correction repeats all of them.
- Prefer list endpoints that already return the fields you need, with column or query selectors. Do not fetch a whole object to read one field.

Example:

```bash
inventory-hosts | while read -r host; do
  ssh "$host" 'bash -s' < preflight.sh
done > /tmp/inventory.json
```

The file contains one JSON object per host. If one host returns nothing, debug that host alone instead of rerunning the whole loop.
