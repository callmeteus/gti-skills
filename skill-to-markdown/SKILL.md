---
name: skill-to-markdown
description: >-
  Convert a SKILL.md file into clean, readable Markdown documentation. Extracts
  frontmatter, instructions, and structure into a formatted doc suitable for
  sharing, README files, or documentation. Use when you need to document a skill
  or present it outside of an agent context.
---

# skill-to-markdown

## Core Rule
Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

## When to use
Use this skill when the user wants to convert a `SKILL.md` skill file into a more human-readable Markdown document, present it as documentation, or extract its content for sharing outside of agent contexts.

## What this skill needs
You MUST gather the following information before generating anything:

### Required
- **Skill file**: Path to the `SKILL.md` file to convert, or the skill name from gti-skills repo
- **Output format**: How should it be presented (standalone doc, README section, etc.)?
- **Target audience**: Who is reading this (developers, users, team members)?

### Recommended
- **Include frontmatter**: Keep or remove YAML frontmatter from output?
- **Add examples**: Should usage examples be expanded?
- **Add TOC**: Include table of contents?
- **Style**: Match existing docs style or custom formatting?

## How it works

### Step 1: Read and Parse
Read the `SKILL.md` file and parse:
- Frontmatter (name, description)
- All sections and subsections
- Code blocks, lists, and formatting
- Any references to scripts/tools

### Step 2: Transform
Convert to clean documentation:
- Make it more readable for humans (not just agents)
- Expand terse agent instructions into clear documentation
- Add context where helpful
- Preserve all functionality and important details
- Remove agent-specific internal notes if not relevant to documentation

### Step 3: Format
Generate clean Markdown with:
- Clear title and description
- Table of contents (if requested)
- Well-structured sections
- Code examples preserved
- Proper formatting
- Links and references

### Step 4: Output
Save as requested (usually `.md` file) or display to user.

## Output Structure
```markdown
# <Skill Name>

> <Description from frontmatter>

## Overview
<Expanded description>

## Installation/Usage
<How to use this skill>

## Features
<Key capabilities>

## Examples
<Usage examples>

## Reference
<Detailed instructions/documentation>
```

## Usage Examples

**Convert a local skill:**
"Convert ./my-skill/SKILL.md to markdown documentation"

**Convert from gti-skills:**
"Convert skill-from-video to markdown"

**With options:**
"Convert artdirector/SKILL.md to a README-style doc with TOC"

## Notes
- Always preserve the "respond in user's language" rule if it's present
- Keep the core functionality intact
- Make it accessible to both technical and non-technical readers when appropriate
- Don't invent information not present in the original skill
- Focus on clarity and readability
- Output in English unless explicitly requested otherwise
