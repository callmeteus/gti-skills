# Anti-patterns

| Anti-pattern | Why it fails | Do this instead |
|--------------|--------------|-----------------|
| Pasting the transcript | The agent gets filler and no structure | Write numbered steps |
| Paraphrasing a command from speech | Small errors break the command | Copy it from a frame |
| Vague steps ("configure the project") | The agent guesses | State the file, the key, and the value |
| One giant `SKILL.md` | Loads everything on every activation | Move detail to `references/` |
| Describing logic in prose | The agent rewrites it differently each time | Put it in `scripts/` |
| A description without triggers | The skill never activates | Add "Use when ..." |
| A description that triggers on everything | The skill activates on the wrong requests | Add "Do not use when ..." |
| Video metadata in the body (channel, views) | Wastes context | Keep only what changes agent behavior |
| Leaving `work/` files in the skill | Bloats the install | Delete frames, audio, and transcripts |
| Example named `SKILL.md` inside the skill | Some agents register it as another skill | Name it `EXAMPLE-SKILL.md` |
| Missing Core Rule | The agent may answer in the skill's language | Add the Core Rule line |
| Absolute paths on the author's machine | Breaks on every other machine | Use paths relative to `<skill-dir>` |
