# Studio and comments

The studio is a local server at `127.0.0.1` with a bearer token. There is no shell endpoint. It has two views.

| View | What the user does |
|------|--------------------|
| Gallery | Sees every registered variant at its real ratio, accepts or rejects it (rejected variants move to a restorable Rejected area), and opens one |
| Preview | Sees the variant full size, clicks elements to comment, copies the prompt, and exports PNG, JPEG, or PDF |

## Comments become a prompt

Every harness can read a pasted message, but not every harness can poll a server. So the studio does not queue edits, and it does not show audit findings: construction defects are the agent's job in the render check. The user clicks elements, writes comments, and copies a prompt like this into the chat:

```text
Art Director: edit variant "story-dark" (1080x1920).
File: <absolute path>/story-dark/artwork.html

1. [h1 "JA TEMOS", selector `div > h1`]
   Move it inside the margin, it touches the right edge

Change only what these comments ask and keep the rest of the piece. Save the file, run the render check once for this variant, then stop.
```

When the prompt arrives:

1. Open the file at `File:`. Do not search for it.
2. Find each element by its selector, or by the quoted text when the selector no longer matches.
3. Apply each numbered comment to that element only. "whole board" comments apply to the composition.
4. Save, run the render check once ([../output/render-check.md](../output/render-check.md)), and stop. The user clicks Reload in Preview to see the change.

## Event API (optional)

Agents that can long-poll may still use the event API: GET `/v1/events/poll?waitMs=25000`, edit the HTML, then POST `/v1/events/:id/reply` with `{ "ok": true }` only after the file is written. `timeout` means poll again. If interrupted, run `artdirector resume --json` and continue from `pendingEvent`. The studio itself no longer posts events.
