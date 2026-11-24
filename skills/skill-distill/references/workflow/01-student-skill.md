# Writing the student skill

Read this before the first edit of `<run>/skill/SKILL.md` and again before every fix.

The student is weaker than you, often has a shorter usable context, and follows text literally. Write for that reader. The file starts from the template in `assets/templates/student-skill.md`: Goal, Done means, Before you start, Steps, Decisions, Don't, Verify.

## Rules

- **Order matters.** Number the steps in the order the reference did the work that mattered, and skip its dead ends. Each step says what to do, the exact command or file, and what the student should see if it worked. Add "if you see X instead, do Y" where the reference hit trouble.
- **Pass on the decisions, with reasons.** These are the choices that shaped the result: structure, libraries and versions, file layout, the mechanics or numbers that matter. Give the reason in one clause so the student can adapt when its situation differs a little.
- **List the traps.** Every dead end the reference hit, and every one you see the student hit, becomes a "Don't do X, because Y" line.
- **Verification goes in the skill.** End with the exact checks the student must run before it says it is done, and what passing looks like. Open models often stop early or report success without checking.
- **Harness notes go first.** What this harness and model get wrong: long-running servers that block the tool call (start them in the background, kill them after), tools the model misuses, output it truncates.
- **Scripts beat prose.** If the student keeps fumbling a mechanical step (a build command, a check, a data conversion), write a script into `skill/scripts/` and tell the student to run it.
- **Do not hand over the answer.** The skill must not contain the reference's finished output, or a script that writes it. Short snippets (about 40 lines or fewer) are fine for the few parts the student cannot get right otherwise; say in the verdict note why each one was needed. The goal is a skill that makes the student able to do the task, not an installer.
- **Keep SKILL.md short:** under about 250 lines. Move long material to `skill/references/*.md` and link it from the step that needs it.
- **Give it numbers it can check.** The student often cannot see a screenshot well. For each visual or quality property that matters, give a measurable target and a way to measure it (a script that prints the number).

## Privacy

The skill leaves this machine when the user installs or shares it. Never copy secrets, tokens, private hostnames, internal URLs, personal names, or absolute paths from the reference into it. Use placeholders and tell the student where to find the real value (an environment variable, a config file in the workspace).
