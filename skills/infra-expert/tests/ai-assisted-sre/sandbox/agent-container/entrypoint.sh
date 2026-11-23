#!/usr/bin/env bash
# Prepare one run and hand control to the OpenCode CLI.
#
# Required environment:
#   ACME_SANDBOX_RUN_ID  run id, used by the fake MCP and the pipeline
#   ACME_SANDBOX_PROMPT  path to the file with the first user message
# Optional:
#   ACME_SANDBOX_MODEL   model id passed to opencode
set -euo pipefail

: "${ACME_SANDBOX_RUN_ID:?ACME_SANDBOX_RUN_ID is required}"
: "${ACME_SANDBOX_PROMPT:?ACME_SANDBOX_PROMPT is required}"

if [[ ! -f /work/acme-infra/AGENTS.md ]]; then
    git clone -q /opt/acme-infra-template /work/acme-infra
fi

if [[ ! -d "${HOME:-/root}/.cursor/skills/infra-expert" ]]; then
    mkdir -p "${HOME:-/root}/.cursor/skills"
    cp -a /opt/skills/infra-expert "${HOME:-/root}/.cursor/skills/infra-expert"
fi

python3 - <<'PY'
import os
from pathlib import Path

source = Path("/opt/ai-sre-sandbox/opencode.json.tmpl").read_text(encoding="utf-8")
rendered = source.replace("${ACME_SANDBOX_RUN_ID}", os.environ["ACME_SANDBOX_RUN_ID"])
Path("/work/acme-infra/opencode.json").write_text(rendered, encoding="utf-8")
PY

mkdir -p "${ACME_SANDBOX_ROOT:-/opt/ai-sre-sandbox}/runs/${ACME_SANDBOX_RUN_ID}"

# Runner-driven mode: keep the container alive and exchange turn prompts and
# results through the mounted run directory. The one-shot path below stays the
# default for manual use.
if [[ "${ACME_SANDBOX_DRIVER:-0}" == "1" ]]; then
    exec /usr/local/bin/ai-sre-driver
fi

args=(run)
if [[ -n "${ACME_SANDBOX_MODEL:-}" ]]; then
    args+=(--model "$ACME_SANDBOX_MODEL")
fi
args+=("$(cat "$ACME_SANDBOX_PROMPT")")

cd /work/acme-infra
exec opencode "${args[@]}"
