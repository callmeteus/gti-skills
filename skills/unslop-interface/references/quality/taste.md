# Taste files

A taste file records what the user never wants and what they always want to keep. The skill reads it in the inventory step and follows it in every pass.

## Where it lives

| Scope | File | Holds |
|-------|------|-------|
| User | `~/.gti/unslop-interface/taste.md` | Preferences for every project |
| Project | `~/.gti/unslop-interface/<project>/taste.md` | Preferences for one project; they win over the user file |

`<project>` is the repository folder name, and `GTI_HOME` replaces `~/.gti`. Both files live outside the repository. Start from [assets/templates/taste.md](../../assets/templates/taste.md).

## Format

Two lists, one item per line, each item short and specific enough to check on a screen:

```markdown
## Ban
- Exclamation marks in UI copy
- Gradient buttons
- Filter chips; use one row of selects

## Keep
- The display serif in page titles
- The orange accent on the primary button
- The dark header band on auction cards
```

## How the skill uses it

- **Ban:** each item becomes an extra tell. Add it to the inventory, look for it in every pass, and fix it like any other tell.
- **Keep:** each item is never changed, even when it matches a tell. List it in the report under "Kept on purpose" with the file it came from.
- **Conflicts:** a project item wins over a user item. A Keep wins over a tell from this skill.

## Updating it

When the user rejects a change ("keep that", "that was not slop") or names something they hate, add one line to the project file: a Keep for the rejected change, a Ban for the named thing. Tell the user which line you added. In autonomous mode, add the line and list it in the report.

## Mistakes to avoid

These were reported as false tells by another unslop skill; do not repeat them:

- A button labeled "New" is an action, not a "New" badge.
- A timestamp such as "Jan 3 · 14:02" is metadata, not a status pill.
- `!` in code (`!=`, `!important`, `!value`) is not an exclamation mark in copy. Only visible UI text counts.
