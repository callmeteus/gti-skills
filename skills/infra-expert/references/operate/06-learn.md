# Operate mode: learn

The project knowledge folder is a living document at the nearest git root of the repository you work in. Write to it when you confirm a fact or when something goes wrong, so the next agent does not repeat it.

## Learnings

- Append a learning with `knowledge.py learn` as soon as a failure is understood. Include the date (the script adds it), the area, what happened, the rule that prevents a repeat, and a source. Do not keep the lesson only in the chat, because context is lost between sessions.

```bash
python3 <skill-dir>/scripts/knowledge/knowledge.py learn \
  --area access --what "A read opened a new connection" \
  --rule "Use the read-only tool with its own grep parameter" --source "incident review"
```

- Merge a near-copy into an existing entry instead of appending a second one. Do not keep five variants of the same lesson, because the file stops being read.

## MCP gaps

- Append a gap with `knowledge.py gap` every time you use a CLI or raw command because the project MCP lacked the capability. Record what you needed, the exact command you ran, and a proposed MCP tool. Do not write "the MCP could not do this" without the command, because the team cannot see what to add.

```bash
python3 <skill-dir>/scripts/knowledge/knowledge.py gap \
  --need "Bulk export of dashboards" \
  --command "vendor-cli dashboards export --all" \
  --proposal "An export_all tool on the project MCP"
```

- The script writes status `open`. Change it to `added` only when the tool exists.

## Correcting the folder

- Update `access.md`, `hosts.md`, `mcp.md`, and `cli.md` when you confirm a fact that is missing or wrong there: a working alias, a tool that reuses its connection, a profile, a flag. Do not leave a known-wrong path in place, because the next agent will follow it.
- Record the correction as a learning too when it caused a failure or a wrong target.

## Conventions

- Update `conventions.md` when a task confirms or corrects a convention: the provisioning path, the closest example, a naming pattern, a tag or label set, network and access defaults, or an inventory to update. Write the source file for each fact beside it, so the next agent can check the fact. Do not leave a corrected convention in place, because the next create or deploy will follow it.

  Example: "After adding a service, record the module and variables files copied and the file that defines the tag set beside each row in `conventions.md`."

## Secrets

- Never write a secret value into any file in the folder. Write only the variable name or the secret-store path. Do not use a value in an example command, because examples get copied.
- If the user pastes a secret, store it where `access.md` says secrets go, then tell the user once that the value now also sits in the chat transcript. Do not echo the value back in a reply or inside a URL.
- Read only key names from env and secret files, for example `grep -oE '^[A-Z0-9_]+=' <file>`, never the whole file, even when a read-only tool allows it. Do not fetch the values after you have listed the names, because the values land in the chat transcript and in stored copies.
- A secret the agent generates goes into the secret store that `access.md` names, and the host gets it from there. Do not append a generated password, signing secret, or pepper only to a host `.env` file, because the store stays incomplete and the value is lost when the host is replaced.
- The script refuses a line that looks like a secret (an assignment such as `password=`, a key prefix, or a long token-like string). Do not work around the refusal by splitting the value, because the point is to keep it out of the file.

Example: write "set `EXAMPLE_PROVIDER_KEY` from `<secret-store-path>/example-provider`" instead of writing the key itself.
