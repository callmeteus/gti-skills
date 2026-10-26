# Step 3: Analyze and synthesize

Turn two noisy sources into one clean procedure.

## What to extract

- **Ordered steps:** the sequence the presenter follows, without the detours.
- **Exact commands:** copied from frames, not paraphrased from speech.
- **Files:** which are created, edited, or opened, with their paths.
- **Prerequisites:** installs, accounts, environment variables, versions.
- **Decision points:** "if X then Y" moments.
- **Gotchas:** warnings, mistakes the presenter hits, and their fixes.
- **Expected results:** what success looks like after each step.

## Resolve conflicts

| Situation | Decision |
|-----------|----------|
| Audio says one command, screen shows another | Use the screen |
| Spoken step has no visible proof | Keep it only if the user's purpose needs it; mark it as unverified in Notes |
| Presenter makes a typo then corrects it | Use the corrected form |
| Presenter uses a deprecated flag | Use the current flag if you are certain, otherwise keep the video's and note it |
| Version-specific behavior | Record the version in Prerequisites |

## Cut the noise

Drop intros, sponsor reads, jokes, repeated explanations, and unrelated tangents. Keep only what changes what the agent will do.

## Decide the shape

| Content | Where it goes |
|---------|---------------|
| The core procedure, up to about 100 lines | `SKILL.md` Instructions |
| Long command lists, option tables, API details | `references/` |
| Anything the agent would retype often | `scripts/` |
| Templates and sample files | `assets/` |

Keep the target agent in mind. Skills that run scripts need the script path resolved from the skill folder, so write `<skill-dir>/scripts/...` and explain `<skill-dir>` once.
