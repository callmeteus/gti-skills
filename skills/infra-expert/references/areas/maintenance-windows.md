# Maintenance windows and change notices

A window is a public record, not a chat message. Open it, keep it current, and close it on the same subject with the measured duration. Read this file at Operate step 4 before announcing a change: an announcement goes out only after the command on the target succeeded, and the safety rules and `../operate/04-change.md` still apply.

## Announce

- State scope, impact, estimated duration, a named responsible role, and what is explicitly not affected. Without the boundary a reader cannot decide which failures are expected during the window.
- Mark non-production scope explicitly when a shared name is used, so approval and alerting rules are applied to the right target.
- Name the alerts expected to fire and why, so they are not triaged as new incidents.
- Schedule outside business hours only when a window is unavoidable, and prefer a rolling key flip with no downtime over a fixed outage slot.

## During the window

- Silence an alert only for the exact resource during the exact window, then re-enable it and confirm it is armed again. A blanket silence hides real failures; a silence left on after the window leaves the service unmonitored.
- Back up state the source cannot rebuild before the change and name the backup in the notice.
- Name the rolling or zero-downtime pattern in the notice and keep enough healthy units to serve traffic; see `../operate/04-change.md` for the drain, health check and return order.

## Close and correct

- Pair every start notice with an end notice on the same subject and record the real duration in the close. A duration left as an estimate is not a record.
- Correct a wrong duration or a wrong impact statement in the original thread, marked as a correction, as soon as it is found. An incorrect notice stays as the record of the window and gets copied into later summaries.
- Cancel or reschedule with an explicit reason, a new date, and a "nothing changed" statement, so operators are not left waiting on a window that will not happen.
