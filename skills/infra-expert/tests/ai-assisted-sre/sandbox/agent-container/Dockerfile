# Build from the gti-skills repository root, where skills/ and this package live:
#   docker build -f skills/infra-expert/tests/ai-assisted-sre/sandbox/agent-container/Dockerfile \
#     -t ai-sre-sandbox-agent .
# The skill is copied at build time; it is not installed over the network.
FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/opt/ai-sre-sandbox \
    ACME_SANDBOX_ROOT=/opt/ai-sre-sandbox

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 python3-pip git curl ca-certificates jq iptables procps \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g opencode-ai@latest

RUN install -d /opt/skills /opt/ai-sre-sandbox /work/acme-infra
COPY skills/infra-expert /opt/skills/infra-expert
# Keep the agent's copy equal to an install: the CLI never installs tests/, and
# the scenarios under tests/ would hand the agent the answers.
RUN rm -rf /opt/skills/infra-expert/tests /opt/skills/infra-expert/README.md /opt/skills/infra-expert/skill.json
COPY skills/infra-expert/tests/ai-assisted-sre/sandbox /opt/ai-sre-sandbox
COPY skills/infra-expert/tests/ai-assisted-sre/sandbox/repo-templates/base /opt/acme-infra-template
COPY skills/infra-expert/tests/ai-assisted-sre/sandbox/agent-container/bin/pipeline /usr/local/bin/pipeline
COPY skills/infra-expert/tests/ai-assisted-sre/sandbox/agent-container/bin/secret /usr/local/bin/secret
COPY skills/infra-expert/tests/ai-assisted-sre/sandbox/agent-container/bin/notify /usr/local/bin/notify
COPY skills/infra-expert/tests/ai-assisted-sre/sandbox/agent-container/bin/driver.sh /usr/local/bin/ai-sre-driver
COPY skills/infra-expert/tests/ai-assisted-sre/sandbox/agent-container/entrypoint.sh /usr/local/bin/ai-sre-entrypoint
COPY skills/infra-expert/tests/ai-assisted-sre/sandbox/agent-container/opencode.json.tmpl /opt/ai-sre-sandbox/opencode.json.tmpl

# The template is a real git repo so the entrypoint can clone it per run.
RUN git -C /opt/acme-infra-template init -q \
 && git -C /opt/acme-infra-template add -A \
 && git -C /opt/acme-infra-template -c user.name='ACME Sandbox' \
      -c user.email='sandbox@acme.test' commit -qm 'initial ACME infrastructure' \
 && chmod +x /usr/local/bin/pipeline /usr/local/bin/secret /usr/local/bin/notify /usr/local/bin/ai-sre-driver /usr/local/bin/ai-sre-entrypoint \
 && chmod +x /opt/ai-sre-sandbox/agent-container/network/isolate.sh

WORKDIR /work/acme-infra
ENTRYPOINT ["/usr/local/bin/ai-sre-entrypoint"]
