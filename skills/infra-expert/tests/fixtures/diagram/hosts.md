# Inventory

| Nickname | Target | Notes |
|---|---|---|
| Example: "the local server" | `edge-01` | The host people mean in maintenance requests |

| Name | Kind | Address or how to reach | Group | Notes |
|---|---|---|---|---|
| `edge-01` | Virtual machine | `project-cli edge-01 ...` | edge | Preferred address |
| `db-01` | Database | `ssh db-01` | data | Private network |
| `worker-01` | Virtual machine | `project-cli worker-01 ...` | edge | Batch jobs |
