# Operate mode: secrets

Application secrets have one canonical home per project. The agent finds it, puts every value there, lets each host read only its own values with its own identity, and never lets a value pass through the conversation. These rules apply before any secret is generated, written, read, or moved, and they override a guess copied from a nearby stack. A value that reaches the chat transcript stays there, so treat it as exposed. The rules for writing the project knowledge folder stay in `06-learn.md`.

## 1. Find the canonical manager

- Read the project rules and `.gti/infra-expert/` first. In the knowledge folder read `conventions.md`, especially its Secrets section, plus `access.md` and `mcp.md`. A project rule that names the manager is ground truth.
- Then read the code. Look for providers and data sources for the managers (for example Infisical, HashiCorp Vault, AWS Secrets Manager, SSM Parameter Store, Doppler, 1Password, SOPS, and similar), CLI calls in scripts and pipelines, and env files that point to a manager.
- When the code uses more than one manager, find the role of each. Usually one holds application secrets and another only holds the bootstrap credential a host uses to reach the first. A manager used only for bootstrap is not a home for application secrets.
- Project rules beat the closest example. A nearby stack that uses a different manager is not a reason to copy it.
- Write the answer in `conventions.md` under Secrets with a source file for each fact. If the canonical manager and its path convention are still unclear after reading the rules, the knowledge folder, and the code, ask once.

Example: "The project rule names one manager per product. The code also has a second manager whose only secret is the credential a host uses to log in to the first. I recorded the first as canonical for application secrets and the second as bootstrap only, with the file that declares each as its source."

## 2. Where a secret goes

- Application secrets, generated passwords, API keys, and tokens the user provides go to the canonical manager at the project's path convention: a project or vault per product and a folder per service or tenant, or whatever the project records in `conventions.md`.
- Never put a value only in a host file, in a variables file tracked by git, or in a chat message.
- Terraform state holds a value only when the project already accepts that practice. When it does, say so in the reply and in `conventions.md`. Do not introduce it as a new default.
- A bootstrap credential goes only where the project keeps bootstrap credentials, and nothing else lives there.

Example: "The generated database password goes to `/<product>/<service>/database` in the canonical manager. It is not added to the host `.env`, not written to a variables file in git, and not shown in the reply."

## 3. Values never pass through the agent

- Generate random values where they are stored: the manager's own generator, a provider resource that writes straight into the manager, or a command that runs on the host and writes to the manager.
- Read only names and metadata: key names, paths, versions, and timestamps. Never fetch a value just to inspect it.
- To compare two values, compute a hash on the side that holds the value and compare the hashes. Never ask the agent to hold both values.
- Never pass a value as a tool argument, a shell argument, or the agent's own environment when a dialog, a manager-side generator, or a host-side command can set it.
- If a value is printed or pasted anyway, tell the user once that it is in the transcript; see rule 4 and `06-learn.md`.

Example: "To rotate a signing key I ran the manager's generator on the host and had it write the new version, then compared the hash of the stored value with the hash the service printed. The key itself was never a tool argument or a line in the chat."

## 4. When the user must provide a value

- For a value only the user has, such as a personal API token, tell them the exact manager, project, environment, path, and key name, and the UI screen or CLI command that sets it.
- Never ask them to paste the value into the chat.
- If they paste it anyway, store it as `06-learn.md` says: the value goes into the canonical manager, and the knowledge folder gets only the variable name or path. Tell the user once that the value now also sits in the transcript. Do not echo the value back and do not put it in a URL.

Example: "Please set `PAYMENTS_API_TOKEN` at `/<product>/<service>/payments` in the canonical manager, environment `<environment>`, through the project's secret UI or the manager's CLI on your machine. Do not paste the token here; enter it in that screen or command."

## 5. How a host gets its secrets

- Each host or service has its own least-privilege identity created in code, with read-only access to its own folder or path prefix.
- The host reads its secrets at boot or deploy through the manager's agent, CLI, or SDK using that identity. No human copies values onto the host by hand.
- Only the bootstrap credential of that identity lives where the project keeps bootstrap credentials, and it is created and stored through the same code path.
- A secret change reaches the host through the same path: a new version in the manager and a reload, restart, or deploy through the project's documented method. Do not edit host files to make a change stick.

- After any change to a secret or a connection value, by you or by the user, read the store back (names, versions, and non-secret values) and compare with what the running process uses. When the user says they "pasted" or "set" a value, confirm where: a value written only to a host file disappears at the next deploy, and the next deploy then points the service back at the old target. Report a drift as a blocker for the next deploy and fix the store.
- A write script for the manager has a dry run by default, a backup at mode 600, a read-back after the write, and a rollback that restores only its own writes.

Example: "The service has a read-only identity scoped to `/<product>/<service>`. At boot its unit calls the manager's agent and exports the values into the process environment. When the key changed, I created a new version in the manager and redeployed through the pipeline; I did not touch the host `.env`."

## 6. Moving secrets that already sit in a host file

- Run the copy on the host by sending a script as a file, as `02-access.md` says, so values never enter the agent. The script reads the host file and writes to the manager.
- Take and check a backup of the host file first under the backup rules in `04-change.md`. Keep its permissions and never print its content.
- Compare hashes on the host side: hash the values in the host file and the values read back from the manager, then compare the hashes only.
- Switch the service to read from the manager with zero downtime as `04-change.md` describes: add the new source, verify health, then remove the old source.
- Only after the switch is verified, remove the values from the host file and delete the non-database backup. Keep database backups until the user confirms.

Example: "I sent `migrate-secrets.sh` to `<host>`, backed up `.env` with mode 600, and the script wrote each key to the manager and compared hashes on the host. After the service was reading from the manager and health stayed green, I cleared the values from `.env` and removed the backup."

## 7. Rotation

- For each secret, name what breaks when it changes: active sessions, already issued API keys, database clients or connection pools, cached tokens, or signed URLs.
- Plan the rotation with the zero-downtime and backup rules of `04-change.md`: create the new version, roll it out while the old value still works, then retire the old value once the new one is confirmed.
- Ask before a rotation that invalidates something users hold, such as sessions or issued keys. In Autonomous Mode list it as pending instead of doing it.

Example: "Rotating the session signing key would log out every current session. I named that impact, kept the old key accepted until the new one rolled out, and asked before retiring the old key rather than doing it unattended."

- Classify a rotation list before acting: session and token secrets are often safe to rotate live, while encryption keys need stored data re-encrypted or external consumers notified, so those rotations go into a planned window.
- A managed credential that rotates on a schedule breaks clients holding a static copy with an open pool. Give the client read access to the current value or refresh its copy before rotation, and check that it still works after a restart; extending the rotation interval is a mitigation, not a fix.
- Put short-lived credentials, for example a mirror token, on a renewal timer and verify one sync immediately after the rotation. A manual replacement without a timer fails again when the token expires.

## 8. Discovery tools

- Prefer the project's MCP for the manager, through the access ladder in `01-orient.md`, to list projects, folders, and key names.
- List real slugs and environment names before writing them. A label shown as "Production" in a UI may be `prod` in the API. Copy the exact string from a list call, never a guess.
- Record the slugs, environments, and paths you confirm in `conventions.md` with their source, and log any CLI fallback as an MCP gap in `06-learn.md`.
- When a vendor CLI fails against a self-hosted manager (for example a 404 on a newer API route), check the server's status or version endpoint and reuse the API routes the project's MCP or client already uses, with the CLI's own session. Record the version mismatch in `cli.md` and as an MCP gap.

Example: "The UI showed 'Production' but the list call returned environment `prod` and project slug `<product>-core`. I used those exact strings in the path and recorded them in `conventions.md` with the list command as the source."
