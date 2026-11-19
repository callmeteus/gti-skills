# Hosts and nicknames

This file resolves the names people use to the targets an agent should act on. Use it in the first acting message so "the local server" never turns into a guess. Keep one alias per nickname and one row per target with the single documented way to reach it and its owner. This file is committed and contains addresses and owners, never credentials.

## Nicknames

| Nickname | Target | Notes |
|---|---|---|
| Example: "the local server" | `app-host-02` | The host people mean in maintenance requests |
| Example: "my desktop" | `workstation-01` | Use only for desktop-specific tasks |

## Targets

| Name | Kind | Address or how to reach | Owner | Notes |
|---|---|---|---|---|
| `app-host-02` | Virtual machine | `project-cli app-host-02 ...` | Example team | Preferred address; do not use an address from chat history |
| `workstation-01` | Desktop | documented jump host | Example team | Only reachable through the jump host |

When a target was reached through several addresses or keys, keep the one documented here and remove the rest. If a nickname is not in the table, ask the user which target it means before connecting.
