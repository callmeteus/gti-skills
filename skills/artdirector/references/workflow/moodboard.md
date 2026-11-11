# Mood board

The mood board holds references for every art requested in the same chat: images, colors, notes, and pinned variants. The user adds to it in the studio's **Mood board** view (upload, drop, or paste images; add colors and notes) and pins variants from the Gallery. You add to it with the CLI.

It lives beside the chat's requests, so `init --new` keeps it. A permanent repository project keeps it in `.artdirector/moodboard/`.

## Read it before each new art

```powershell
& "<skill-dir>\scripts\artdirector.cmd" moodboard --json
```

`data.items` lists the entries in the order they were added. Each entry has `kind`, `source` (`agent` or `studio`), and an optional `caption`.

| Kind | Fields | How to use it |
| --- | --- | --- |
| `image` | `path` | Open the image and read its palette, type, texture, and composition. Use it as a reference, not as an asset, unless the user says to place it in the art |
| `color` | `color` | Treat the colors as the palette the user wants. Several colors are one palette, not alternatives |
| `note` | `text` | A word, mood, or constraint. Follow it like a line of the brief |
| `variant` | `requestId`, `variantId`, `path` | An earlier piece the user liked. Read the HTML at `path` and carry over what makes it work. `missing: true` means it was deleted; skip it |

Entries with `source: "studio"` came from the user and outrank your own. When the board is empty, go on with the brief.

## Add what the user gives you

When the user sends references in the chat, add them before designing, so they show in the studio and carry over to later arts:

```powershell
& "<skill-dir>\scripts\artdirector.cmd" moodboard add --image "<absolute path>" --caption "<why it matters>" --json
& "<skill-dir>\scripts\artdirector.cmd" moodboard add --color "#c23b22" --caption "Brand red" --json
& "<skill-dir>\scripts\artdirector.cmd" moodboard add --note "Warm hotel lobby at night" --json
& "<skill-dir>\scripts\artdirector.cmd" moodboard add --variant <id> --from-request <request id> --json
```

- Images must be PNG, JPEG, GIF, WebP, SVG, or AVIF, up to 15 MB. The board stores a copy.
- `--variant` pins a variant from the current art; add `--from-request` for an earlier art (`history --json` lists request ids).
- Remove an entry with `moodboard remove --id <entry id>` only when the user asks.

Do not fill the board with your own ideas. It is the user's reference wall; add only what the user sent or asked you to keep.
