# Render check

Every variant is rendered and looked at once before the user sees it. The check catches construction defects, the kind no designer would hand over. It is not a taste review.

## Run it

For each variant id:

```bash
"<skill-dir>/scripts/artdirector" audit --id <id> --json
"<skill-dir>/scripts/artdirector" export --id <id> --format png --json
```

Open the PNG at the `path` from the export answer and look at the whole board. On Windows use `scripts\artdirector.cmd` with the same arguments. If your agent cannot view images, fix what the audit reports and tell the user the visual check was not done.

## Defects to fix

Fix these, and only these:

| Defect | What it looks like | Fix |
|--------|--------------------|-----|
| Near miss at the edge | A headline 0 to 40 px from the side, almost cut (audit `edge`, `outside`) | Fit the line inside the padding (`data-fit`, smaller size, or a line break), or bleed it clearly and mark it `data-bleed` |
| Story chrome | Copy in the top 210 px or bottom 250 px of a story (audit `safe-zone`) | Move the copy inward; keep image and texture there |
| Empty or dead band | A flat strip of color under or over the composition, as if the art ended early | Extend the field and the hero to the edge, or move the card so it overlaps the hero |
| Floating hero | The object stops above a band or hangs in the middle with nothing under it | Ground it or crop it at the frame edge (see [../style/illustration.md](../style/illustration.md)) |
| Crooked construction | Window rows not straight, uneven gaps, parts rotated by different amounts | Rebuild the repeated parts on one grid |
| Collisions | An ornament touching a letter, text over a busy area without contrast | Move the ornament or add a scrim |
| Blurred type | Text under `filter: blur()` (audit `blur-text`) | Hide it with tape, a sticker, or "?" letters |
| Missing glyphs | Fallback font on accented letters (á, ã, ç) | Use a family that covers the language |
| Failed assets | Broken image, empty box (audit `asset`) | Fix the path |

Mark decorative type that crosses the edge on purpose (giant background words, outlined echoes) with `data-bleed` so the audit skips it.

## Limits

- **One fix pass per variant.** Fix the defects above, export once more if you changed the layout, then hand over. Do not start a second round.
- **No taste edits.** Do not change the direction, palette, type pairing, or copy during the check. Those belong to the user.
- **Report what remains.** If a defect cannot be fixed in one pass, name it in one sentence when you hand over.
