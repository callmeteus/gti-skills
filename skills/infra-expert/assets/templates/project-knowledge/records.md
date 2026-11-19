# Records

This file tells an agent where this project keeps records for humans and which template each kind uses. A record states the current status and what to do; it does not narrate the investigation. Use the field table, grouped tables, one "Checked on" date, and a "Not checked" section from the operate records reference. This file is committed and holds no secret values.

| Record kind | Location | Template or example | Owner |
|---|---|---|---|
| Security advisories | `docs/security/` | Generic record template in the operate records reference | Example team |
| Service inventory | `docs/inventory.md` | One row per service, grouped by environment | Example team |
| Runbooks | `docs/runbooks/` | Steps with the target named in each command | Example team |

When a new record kind appears, add its location and template here in the same change that creates it. Do not put a record in a new folder without adding its row.
