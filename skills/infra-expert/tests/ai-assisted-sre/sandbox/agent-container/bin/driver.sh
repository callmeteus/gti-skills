#!/usr/bin/env bash
# Runner-driven mode for the agent container.
#
# The runner writes turn-N.prompt plus an empty turn-N.go marker into the
# mounted run directory. This loop runs each prompt as one non-interactive
# OpenCode turn in a single session, exports the full transcript on request,
# grades the rubric in a second session, and exits when the runner writes
# `stop`. Nothing here holds a credential: the runner mounts one file read-only
# and we import it before the first turn.
set -uo pipefail

DDIR="${ACME_SANDBOX_DRIVER_DIR:?ACME_SANDBOX_DRIVER_DIR is required}"
MODEL="${ACME_SANDBOX_MODEL:-}"
JUDGE_MODEL="${ACME_SANDBOX_JUDGE_MODEL:-$MODEL}"
RUN_ID="${ACME_SANDBOX_RUN_ID:-run}"
SID=""

if [[ -f /auth/provider-auth.json ]]; then
    opencode auth import /auth/provider-auth.json >/dev/null 2>&1 || true
fi

session_from() {
    python3 - "$1" <<'PY'
import json, sys
try:
    with open(sys.argv[1], encoding="utf-8", errors="replace") as handle:
        for line in handle:
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if event.get("sessionID"):
                print(event["sessionID"])
                break
except OSError:
    pass
PY
}

run_opencode() {
    # $1 output file, $2 prompt file, $3 optional session id, $4 model, $5 cwd
    local out="$1" prompt_file="$2" session="$3" model="$4" cwd="$5"
    local args=(run --format json --auto)
    [[ -n "$session" ]] && args+=(--session "$session")
    [[ -n "$model" ]] && args+=(--model "$model")
    args+=("$(cat "$prompt_file")")
    (cd "$cwd" && opencode "${args[@]}") >"$out" 2>"${out%.jsonl}.err"
    return $?
}

next_turn=1
while true; do
    if [[ -f "$DDIR/stop" ]]; then
        break
    fi

    prompt="$DDIR/turn-${next_turn}.prompt"
    go="$DDIR/turn-${next_turn}.go"
    done="$DDIR/turn-${next_turn}.done"
    if [[ -f "$go" && ! -f "$done" ]]; then
        out="$DDIR/turn-${next_turn}.events.jsonl"
        run_opencode "$out" "$prompt" "$SID" "$MODEL" /work/acme-infra
        code=$?
        if [[ -z "$SID" ]]; then
            SID="$(session_from "$out")"
            [[ -n "$SID" ]] && printf '%s\n' "$SID" > "$DDIR/session"
        fi
        printf '%s\n' "$code" > "$DDIR/turn-${next_turn}.exit"
        : > "$done"
    fi

    if [[ -f "$DDIR/export.go" && ! -f "$DDIR/export.done" && -n "$SID" ]]; then
        (cd /work/acme-infra && opencode session export "$SID") \
            > "$DDIR/transcript.json" 2> "$DDIR/export.err"
        : > "$DDIR/export.done"
    fi

    if [[ -f "$DDIR/judge.go" && ! -f "$DDIR/judge.done" ]]; then
        mkdir -p /tmp/ai-sre-judge
        run_opencode "$DDIR/judge.events.jsonl" "$DDIR/judge.prompt" "" \
            "$JUDGE_MODEL" /tmp/ai-sre-judge
        printf '%s\n' "$?" > "$DDIR/judge.exit"
        : > "$DDIR/judge.done"
    fi

    sleep 0.25
done

printf 'driver stopped for %s\n' "$RUN_ID"
