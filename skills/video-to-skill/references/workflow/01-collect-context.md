# Step 1: Collect context

A video alone does not define a good skill. The same video can become a deploy skill, a debugging skill, or a teaching skill. Get the intent from the user before extracting anything.

## Required

| Input | Example | If missing |
|-------|---------|------------|
| Video source | YouTube URL, video ID, or local file path | Ask for it |
| Skill name | `deploy-to-vercel` | Propose one and ask for approval |
| Purpose | "Deploy a Next.js app from the CLI" | Ask what problem it solves |
| Triggers | "when the user says deploy, ship, or publish to Vercel" | Ask which requests should activate it |
| Target agent | Claude Code, Cursor, OpenCode, or any | Default to any |

The skill name must be kebab-case: lowercase letters, digits, and single hyphens, at most 64 characters.

## Recommended

- **Sections wanted:** structure the user expects.
- **Tools and commands:** CLIs or APIs that must appear.
- **Outputs:** files the skill should create or edit.
- **Constraints:** what the skill must never do, such as touching production.
- **Reference skills:** existing skills to match in tone and layout.

## How to ask

Ask once, in one message, as a short list. Offer defaults the user can accept with "yes". Do not ask about things the video will answer.

```text
Before I start I need a few things:
1. Skill name: deploy-to-vercel (ok?)
2. What should it do, in one sentence?
3. Which requests should trigger it?
4. Anything it must never do?
```

Stop and wait for the answers. Do not extract or write anything until the required inputs are known.
