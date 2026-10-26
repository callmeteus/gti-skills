# Format: tutorial

For how-to and walkthrough videos. The reader wants to repeat the result without watching.

Template: [assets/templates/tutorial.md](../../assets/templates/tutorial.md)

## Structure

1. **Goal:** what the reader will have at the end.
2. **Prerequisites:** tools, versions, accounts, and files.
3. **Steps:** numbered, one action each. Every step has the exact command or setting, then what the reader should see.
4. **Verify:** a final check that proves it worked.
5. **Troubleshooting:** the errors the presenter hits and their fixes.
6. **Resources:** links mentioned in the video.

## Rules

- Commands and paths come from frames, not from speech. If a command is only spoken, say so.
- Put each step's timestamp link at the end of the step so the reader can watch that moment.
- Keep frames for terminal output, settings screens, and file trees; skip frames of the presenter.
- Do not add steps the video does not show. Mark suggestions as "Optional".
- Use `bash` or `powershell` fenced blocks, and show a variant when the video targets one OS.
