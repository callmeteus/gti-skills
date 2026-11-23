# Hosts and nicknames

Resolve a nickname before the first acting message.

| Nickname | Target | Notes |
|---|---|---|
| "shop" | `vm.prod.shop.acme.test` | Production, service `shop` |
| "warehouse" | `vm.prod.warehouse.acme.test` | Production, service `warehouse` |
| "local emulator" | `ministack.acme.test` | MiniStack API on port 4566, not a production host |

| Host | Kind | Reach it | Owner |
|---|---|---|---|
| `vm.prod.shop.acme.test` | Production VM | `acme-prod` MCP | shop team |
| `vm.prod.warehouse.acme.test` | Production VM | `acme-prod` MCP | warehouse team |

A name that differs only by `.staging.` is a different tenant. Confirm which one the user meant before acting. The inventory in `infra/Inventory.md` is the source for host names and versions.
