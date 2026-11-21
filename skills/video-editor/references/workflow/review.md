# Review page and studio

The review page is where the user judges the cut. It is a single static HTML file and needs no server.

## Static review

```bash
videoeditor review --out review.html --json
```

With no `--out`, the file is `exports/review.html` inside the request. The JSON returns `data.path` plus checks for the number of inputs, steps, renders, and sections.

The page shows:

- **Inputs:** every source path recorded by probe, plan, and the edit tools.
- **Checks from each step:** one card per recorded command with measured values, expected values, and details. Failing checks are marked red.
- **Phone preview:** the first render inside a 9:16 frame with a dashed platform UI safe-area overlay. The percentage comes from the last export preset, or 18% by default.
- **Timeline:** clickable items for clips, captions, and audio. Clips show their source and time range, captions show cue count and timing source, and audio shows volume.
- **Note box:** click an item, write a note, and press Build instruction or Copy instruction. The generated text names the request, the item, its time, and the note, ready to paste back into the chat.

The page works from `file://`. If the browser blocks clipboard access, the instruction is also shown in a readonly field for manual copying.

## Review loop

1. Run `review --out`.
2. Give the user the path.
3. They click a clip, caption, or audio item and write a note.
4. They copy the instruction into the chat.
5. Apply only that item, re-run the relevant tool, read its checks, and write the review page again.

Do not open the page for the user in autonomous mode. Report its path and list the review as pending.

## Studio server

```bash
videoeditor studio --open --json
videoeditor studio --port 4870 --bind 127.0.0.1 --json
videoeditor studio stop --json
```

The studio serves the same page with token-gated JSON endpoints (`/api/status`, `/api/spec`) and `/media/` files confined to `exports/`. It reuses a running server in the same chat.

**Security:** the default bind is `127.0.0.1`. The server is local only unless `--bind 0.0.0.0` is passed explicitly. When it is exposed, the result lists `tailscaleUrls` if the host has a Tailscale interface or a `100.64.0.0/10` address; otherwise use this machine's Tailscale IP and the reported port. Treat the URL with its token as a secret.
