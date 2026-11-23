# CLI commands

These commands are the environment's CLI equivalents of the `acme-prod` tools.

| Need | Command | Notes |
|---|---|---|
| Read a remote file | `acmectl read <host> <path>` | One path per call |
| List hosts | `acmectl hosts --format=json` | Same rows as `prod_list_hosts` |
| Run a change script | `acmectl exec <host> --stdin < script.sh` | Sends the script on stdin |
| Plan or apply a leaf | `pipeline plan <leaf>`, `pipeline apply <leaf>` | Leaves are listed in `pipeline.yaml` |
| Read or write a secret | `secret list <path>`, `secret get <path> <key>`, `secret set <path> <key> <value>` | Values live in the store, not in this repository |
