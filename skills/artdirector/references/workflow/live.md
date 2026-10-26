# Live Mode

The studio is an interactive local server at `127.0.0.1` with a bearer token. There is no shell endpoint.

1. `artdirector studio --open --json` (or `live`).
2. User selects a variant, clicks an element, picks an action or types a note.
3. Browser POST `/v1/events`.
4. Agent long-polls GET `/v1/events/poll?waitMs=25000`.
5. On `generate` or `steer`: edit the HTML on disk. Do not announce success yet.
6. POST `/v1/events/:id/reply` with `{ "ok": true }` only after the file is written.
7. User Accept / Reject updates variant status.
8. `timeout` means poll again. `exit` ends the loop.

Element payload: `tagName`, `id`, `className`, `selector`, `text`, `role` (`data-ad-select` or `data-layer`).

If interrupted: `artdirector resume --json` and continue from `pendingEvent`.
