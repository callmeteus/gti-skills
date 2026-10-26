# AGENTS.md - gti-skills

## Core Rule
All skills in this repository MUST instruct the agent to respond in the user's language, regardless of the language used in the skill content, instructions, or examples. 

This rule is non-negotiable and must be included in every `SKILL.md` created or modified in this repository. 

## Self-Sufficiency Rule
Every skill MUST be fully self-sufficient. For any skill that requires external dependencies (Python packages, system binaries, tools, etc.), it MUST include an auto-installation mechanism.

### Requirements:
- **Dependencies script**: Each skill must have either `scripts/dependencies.py` or `scripts/dependencies.js` (or both if needed) that automatically detects and installs missing dependencies
- **Cross-platform**: Must work on Linux, Windows, and macOS
- **Automatic detection**: Should detect OS, package manager, and existing installations
- **Auto-install**: If dependencies are missing, install them automatically without manual intervention where possible
- **Fallback instructions**: If automatic installation isn't possible, provide clear instructions
- **Check on use**: The skill must check dependencies and install if needed before proceeding

### Implementation guidelines:
- Use `pip`/`pipx` for Python packages with virtual environment support
- Use system package managers when appropriate (`apt`, `brew`, `choco`, `winget`) with user permission awareness
- For Node.js dependencies, use `npm`/`pnpm`/`yarn`
- Never assume dependencies are pre-installed
- Make it idempotent - running multiple times should be safe
- Handle permissions gracefully

## Skill Format
All skills must follow the OpenCode/Claude Code skill format with:
- Frontmatter containing `name` and `description`
- Clear instructions
- Proper examples where applicable
- Tools/dependencies listed if needed
- Reference to dependencies script

## Language
All skill files must be written in English. 
The ONLY thing that must be localized is: "respond in the user's language, regardless of..." which is stated in the core rule above.
