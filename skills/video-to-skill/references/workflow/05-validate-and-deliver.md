# Step 5: Validate and deliver

## Validate

```bash
python3 <skill-dir>/scripts/validate/validate_skill.py ./skills/deploy-to-vercel
```

The validator prints JSON and exits `1` on errors. Fix every error and rerun until `"ok": true`. It checks:

- Frontmatter exists, `name` is kebab-case and equals the folder name.
- `description` is 1 to 1024 characters (a warning when it does not say when to use the skill).
- The body is at most 500 lines.
- The "respond in the user's language" Core Rule is present.
- Every relative link points to a file that exists.
- No em dash or en dash characters.

## Review by hand

- [ ] Every command comes from the video or from the user.
- [ ] A fresh agent could follow the Instructions without watching the video.
- [ ] Triggers match what the user asked for in step 1.
- [ ] No transcript text, frames, or downloaded media inside the skill folder.
- [ ] Scripts run: execute each one once with `--help`.

Check the output against [the anti-patterns](../quality/anti-patterns.md).

## Clean up

Delete the `work/` folder with the video, audio, transcript, and frames unless the user wants to keep it.

## Deliver

Reply in the user's language with:

1. The path of the new skill folder.
2. A two-line summary of what it does and when it triggers.
3. How to install it. Point to [the install locations](../harnesses/install-locations.md) for the user's agent, for example copy the folder to `.claude/skills/` for Claude Code.
4. Anything unverified that you flagged in Notes.

Do not install the skill into the user's agent directories unless they asked.
