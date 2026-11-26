# Operate mode: records

A record tells a reader the status and what to do. It is not a log of how you found the answer.

## Rules for records

- Put a field table at the top with one "Checked on" date. Do not repeat the date in every sentence or add a date to a field that is not about a date.
- Write short sections: the advisory, why this status, the affected machines, reopen triggers, and not checked. Do not narrate the investigation ("this pass read", "was not read in this reading"), because the reader needs the result, not the reading history.
- Group lists longer than five items into a table by version or condition. Do not put a comma-separated list of machines in one cell, because it cannot be scanned or filtered.
- Put every gap in "Not checked", one line per item with the reason. Do not quietly omit unread items, because a reader will assume they were checked.
- Make each index one table row per item: ID, component, status, short reason, link. Do not write one paragraph per item, because an index is a lookup table.

Example: "Affected machines: 0" in the field table and a table of machine groups below, instead of a paragraph explaining how each group was read.

- For an audit trail of changes, record the actor, the timestamp and the changed value in a store outside the database. Logs held in the database alone are data an administrator can alter, not evidence, and a generic "configuration changed" entry does not say who flipped a setting.
- When a change request is cancelled or reopened, state the reason in the request and in the record. A cancelled request dropped from an elapsed-time report loses its context otherwise, and a reason makes the "nothing changed" boundary unambiguous.

Vulnerability records use `assets/templates/cve-record.md` as is, including its status vocabulary (`affected`, `possible`, `not-applicable`, `fixed`, `no-fix`, `not-checked`). Do not use the template below for them and do not introduce a second vulnerability vocabulary. The generic template below is for other records: incidents, inventory entries, and runbook notes.

## Generic record template

```markdown
# <ID>: <component>, <effect in a few words>

| Field | Value |
|---|---|
| Status | Open / Resolved / Not applicable (non-vulnerability records only) |
| Component | <package or binary, and the module when there is one> |
| Affected range | <versions, one line> |
| Fixed in | <versions, or "no published fix"> |
| Affected machines | <number, or "none"> |
| Checked on | <a single date> |
| References | <links: advisory, distro, KEV> |

## The advisory
Two to four sentences: what breaks, under which condition, and what the attacker needs.

## Why this status
- One line per reason.

## Machines
| Machine | Version | Advisory condition | Result |
|---|---|---|---|

## Reopen when
- One line per trigger.

## Not checked
- One line per machine or item left unread, with the reason.
```

Keep a fixed set of fields across records of the same kind. Do not add a field to one file and drop it from the next, because indexes and readers rely on the same columns.
