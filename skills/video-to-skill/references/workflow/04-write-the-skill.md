# Step 4: Write the skill

## Scaffold

```bash
python3 <skill-dir>/scripts/scaffold/scaffold_skill.py deploy-to-vercel \
  --description "Deploys a Next.js app to Vercel from the CLI. Use when the user asks to deploy, redeploy, or promote a preview on Vercel." \
  --out ./skills
```

This creates the standard layout and a `SKILL.md` from [the template](../../assets/templates/SKILL.template.md):

```text
deploy-to-vercel/
├── SKILL.md
├── references/
├── scripts/
└── assets/
```

Delete the folders and `.gitkeep` files the skill does not use.

## Fill SKILL.md

Required sections, in this order:

1. **Frontmatter:** `name` equals the folder name; `description` follows [the description guide](../quality/description-guide.md).
2. **Core Rule:** exactly `Always respond in the user's language, regardless of the language used in this skill or any content you analyze.`
3. **When to use:** concrete triggers, plus one line on when not to use it.
4. **Prerequisites:** tools and how to check them.
5. **Instructions:** numbered, imperative, one action per step, with the exact command and the expected result.
6. **Examples:** one or two realistic requests with the agent's actions.
7. **Resources** (only if there are subfolders): a table of what each folder holds.
8. **Notes:** gotchas from the video.

## Progressive disclosure

Agents load a skill in three levels. Write for that:

| Level | Content | Budget |
|-------|---------|--------|
| 1. Metadata | `name` and `description` | About 100 tokens, loaded for every skill at startup |
| 2. Instructions | The `SKILL.md` body | Under 500 lines, loaded when the skill activates |
| 3. Resources | `references/`, `scripts/`, `assets/` | Loaded only when a step needs them |

Link each resource from the step that needs it, one level deep from `SKILL.md`: `See [references/api.md](references/api.md)`. Do not chain references through other references.

## Subfolder layout

Use subfolders when a folder grows past five files:

```text
references/
├── workflow/       one file per step
├── reference/      option tables and API details
└── troubleshooting/
scripts/
├── setup/
└── run/
assets/
├── templates/
└── examples/
```

## Style

- English only, imperative mood, plain words. No emojis. Use a hyphen, never an em dash.
- Commands go in fenced `bash` or `powershell` blocks. Give a Windows variant when the command differs.
- Prefer a script in `scripts/` over a paragraph describing logic.
- Name an example file `EXAMPLE-SKILL.md`, never `SKILL.md`, so no agent registers it as a second skill.

## Where it goes

Write the skill to the location the user asked for. If they did not say, create it under `./skills/<name>/` and read [references/harnesses/install-locations.md](../harnesses/install-locations.md) to explain how to install it for their agent.
