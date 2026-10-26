---
name: skill-from-video
description: >-
  Generate a complete, usable SKILL.md from a YouTube video by analyzing both the
  transcript and visual frames. Requires more than just a video URL - needs
  context about the skill's purpose, target use cases, tools, and expected
  structure. Use when transforming a tutorial video into an agent skill.
---

# skill-from-video

## Core Rule
Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

## When to use
Use this skill when the user wants to create a new skill file (`SKILL.md`) based on a YouTube tutorial/video. Do NOT use it if they only provide a URL with no additional context.

## What this skill needs
You MUST gather the following information before generating anything:

### Required
- **Video source**: YouTube URL, video ID, or local video file
- **Skill name**: The kebab-case name for the new skill (e.g., `deploy-to-vercel`)
- **Skill purpose**: What should this skill do? What problem does it solve?
- **When to use**: Clear description of when an agent should trigger this skill
- **Target audience/agent**: Is this for OpenCode, Claude Code, or general use?

### Recommended
- **Desired structure**: Any specific sections the user wants in the skill
- **Tools/commands**: Specific tools, CLI commands, or APIs to include
- **File outputs**: Should it create/modify certain files?
- **Examples**: Any example usage to include
- **Constraints**: What should NOT be done?
- **Reference skills**: Point to existing SKILL.md files in this repo for style reference

## How it works

### Step 1: Collect Context
If any required information is missing, ask the user for it. Do NOT proceed with just the URL.

Use a structured approach to gather:
1. Video link/path
2. Skill identity (name + purpose)
3. Trigger conditions (when to use)
4. Required capabilities and tools
5. Desired output format/style

### Step 2: Extract Content
Gather both modalities:

**Transcription:**
- Use `youtube-transcript-api` for YouTube videos with captions
- If no captions, use `fetch_media.py` approach with Whisper (download + transcribe)
- Always get timestamps when possible

**Visual frames:**
- Extract keyframes at regular intervals (every 10-30 seconds)
- Prioritize frames where code, commands, file trees, UI, or configurations are shown
- For short videos (< 3 min), extract more frames
- Use `ffmpeg` to extract: `ffmpeg -ss <time> -i <video> -frames:v 1 <frame>.jpg`

### Step 3: Analyze and Synthesize
Analyze both transcript and frames together to understand:
- Step by step workflow
- Commands to run
- Files to create/edit
- Tools/dependencies needed
- Gotchas and tips mentioned
- Decision points
- Common patterns

### Step 4: Generate SKILL.md
Create a skill file that follows this structure:

```markdown
---
name: <kebab-case-name>
description: >-
  <Clear description of when to use this skill. Be specific about triggers.>
---

# <Title>

## Core Rule
Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

## When to use
<List specific triggers>

## Prerequisites
<Dependencies, tools, or setup needed>

## Instructions
<Step by step, actionable instructions for the agent>

## Tools
<Tools that might be needed>

## Examples
<Concrete usage examples>

## Notes
<Tips, gotchas, or additional context>
```

**Critical requirements:**
- Must be in English
- Must include "Always respond in the user's language, regardless of the language used in this skill or any content you analyze." in the Core Rule section
- Description must clearly state when to use
- Instructions must be actionable, not just descriptive
- Focus on what the agent needs to DO, not just understand
- Include concrete commands/code snippets when shown in video
- Don't just copy transcript - synthesize into agent instructions

### Step 5: Review and Refine
Before saving, verify:
- [ ] Has proper frontmatter with name and description
- [ ] Includes Core Rule about responding in user's language
- [ ] All required context from user is incorporated
- [ ] Instructions are clear and actionable
- [ ] File is saved in correct location
- [ ] Name matches kebab-case

## Usage

```bash
# Example usage pattern
skill-from-video
  --video "https://youtube.com/watch?v=..."
  --name "my-new-skill"
  --purpose "Deploy applications to production"
  --when-to-use "When user wants to deploy to prod"
```

But in practice, this skill will interactively gather this information if not provided.

## Implementation Notes
- Prioritize visual information - UI clicks, file structures, and terminal commands shown visually are often more accurate than spoken
- Cross-reference: if something is only mentioned verbally, verify it's shown or explicitly needed
- Avoid generic fluff - be specific
- Make it immediately usable by an agent without additional context
- Don't include video metadata unless relevant to the skill
- Keep it focused - one skill, one purpose
