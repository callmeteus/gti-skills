# Guidelines

Guidelines are the user's dos and don'ts. You learn them from what the user says and does, save them with the CLI, and follow them in every later piece. The user sees and edits them in the studio's **Guidelines** view.

The mood board belongs to one chat. Guidelines outlive chats:

| Scope | Applies to | Stored in |
| --- | --- | --- |
| `workspace` (default) | Every piece made in this workspace: one brand, client, or project | `~/.artdirector/workspaces/<key>/guidelines.json` |
| `user` | Everything the user makes, in any workspace | `~/.artdirector/guidelines.json` |

`ARTDIRECTOR_GUIDELINES_HOME` moves the folder. Nothing is written into the user's repository.

## Read them before each new art

```powershell
& "<skill-dir>\scripts\artdirector.cmd" guidelines --json
```

`data.brief` is one line per rule, such as `DON'T [workspace] Purple gradients behind text (why: reads as generic)`, and `data.rules` has the full records.

- **A don't is a hard constraint.** No variant may break it, not even a "bold" option. Before the hand over, check each variant against every don't, in the same render check pass.
- **A do is the default.** Follow it unless the brief asks for the opposite. If it does, follow the brief and say which rule you set aside.
- **Workspace rules beat user rules** when they conflict. Rules beat your own taste and the visual bar in this skill.
- If two rules contradict each other, follow the newer one (`updatedAt`) and mention the conflict in the hand over.

## Learn from feedback

Every time the user reacts to your work, ask yourself whether the reaction says something that will still hold for the next piece. Learn from:

- chat messages ("too busy", "never put the logo there", "I love the serif");
- Preview comments in a pasted change prompt;
- which variants they accept, and which they reject, when they say why;
- references they send for the mood board, when they say what they like in them.

Save each lasting preference as one rule:

```powershell
& "<skill-dir>\scripts\artdirector.cmd" guidelines add --dont "Purple gradients behind text" --why "Reads as generic AI art" --quote "tira esse roxo, parece IA" --variant <id> --json
& "<skill-dir>\scripts\artdirector.cmd" guidelines add --do "Serif display headlines" --scope user --json
```

| Flag | Use |
| --- | --- |
| `--do <text>` or `--dont <text>` | Exactly one. A short instruction a designer could follow, under 300 characters |
| `--why <text>` | The user's reason, in their terms. Leave it out rather than guess |
| `--scope user\|workspace` | `workspace` by default. Use `user` only when the user speaks about their taste in general ("I never like...", "in all my work...") |
| `--quote <text>` | The user's own words, short. Kept as evidence |
| `--variant <id>`, `--from-request <id>` | The piece the feedback was about |

What makes a good rule:

- **Lasting, not local.** "Move the title 20px up" is an edit, not a rule. "Titles sit in the top third" is a rule, but only when the user says it as a preference or repeats it.
- **One idea per rule**, specific enough to check: "No drop shadows on type", not "Cleaner look".
- **In the user's sense.** Write what they meant, not your theory of it. When unsure, save the narrow version.
- **No duplicates.** Saving the same rule again confirms it (`Confirmed`, `hits` goes up). Saving it with the other kind flips it (`Flipped`), for when the user changed their mind.

After saving, tell the user in one line what you learned, for example: "Learned: avoid purple gradients behind text." Do not ask permission first; the user removes or edits rules in the studio, or asks you to.

## Change or remove rules

```powershell
& "<skill-dir>\scripts\artdirector.cmd" guidelines edit --id <rule id> --text "<new text>" --why "<reason>" --kind do|dont --scope user|workspace --json
& "<skill-dir>\scripts\artdirector.cmd" guidelines remove --id <rule id> --json
```

Edit a rule when new feedback narrows or widens it. Remove a rule only when the user says it no longer applies. Rules with `source: "studio"` were written by the user: never edit or remove them on your own.
