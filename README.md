<div align="center">

# GTI Skills

> Handcrafted agent skills for OpenCode and Claude Code

**A curated collection of practical, production-ready skills built and used daily by [Gio Technology Investments (GTI)](https://github.com/GioTechnologyInvestments) team members.**

[![Skills](https://img.shields.io/badge/Skills-Custom-blue.svg)](#skills)
[![Format](https://img.shields.io/badge/Format-OpenCode%20%2F%20Claude%20Code-green.svg)](#usage)
[![Language](https://img.shields.io/badge/Language-English-informational.svg)](#)

[Available Skills](#available-skills) • [Usage](#usage) • [Contributing](#contributing) • [Guidelines](#guidelines)

</div>

---

## What Is GTI Skills?

GTI Skills is an open-source repository of handcrafted agent skills designed for [OpenCode](https://github.com/sst/opencode) and [Claude Code](https://docs.anthropic.com/claude/docs/claude-code). 

Each skill is purpose-built to solve real workflows we encounter daily - no generic templates, just battle-tested instructions that help AI agents work more efficiently and consistently.

## Features

- **Handcrafted**: Every skill is written from real use cases, refined through daily usage
- **Production-ready**: Tested in real projects, not just proof of concepts
- **Language-agnostic responses**: All skills enforce responding in the user's language regardless of skill content
- **Format compatible**: Works with OpenCode, Claude Code, and compatible agent harnesses
- **Modular**: Each skill is self-contained with its own instructions, examples, and dependencies
- **Minimal dependencies**: Most skills rely on built-in tools, with optional scripts when needed

## Available Skills

| Skill | Description |
|-------|-------------|
| [`skill-from-video`](./skill-from-video/) | Generate complete, usable `SKILL.md` files from YouTube videos by analyzing both transcripts and visual frames. Requires context beyond just a URL. |

*More skills are added regularly as we solve new challenges.*

## Usage

### With OpenCode

Skills in this repository can be used by OpenCode. Place them in your skills directory or reference them as needed.

### With Claude Code

Copy the skill folder to your Claude Code skills location or use them directly based on your setup.

### Structure

Each skill follows this structure:

```text
skill-name/
├── SKILL.md      # Main skill definition with frontmatter
├── README.md     # Usage instructions and documentation
└── scripts/      # Optional helper scripts
```

## Guidelines

All skills in this repository must follow these rules:

- **Respond in user's language**: Every `SKILL.md` must include instruction to respond in the user's language regardless of the skill's content language
- **English by default**: All skill files must be written in English
- **Actionable instructions**: Focus on what the agent should do, not just theory
- **Clear triggers**: Descriptions must clearly state when to use the skill
- **No bloat**: Keep skills focused on a single purpose
- **Handcrafted quality**: Only add skills that have been tested in real workflows

See [AGENTS.md](./AGENTS.md) for full details.

## Contributing

We welcome contributions from the community. When adding or modifying skills:

1. Follow the guidelines in [AGENTS.md](./AGENTS.md)
2. Ensure your skill is tested in a real workflow
3. Include clear documentation
4. Always include the language rule in your `SKILL.md`
5. Keep it focused and practical

## About GTI

[Gio Technology Investments (GTI)](https://github.com/GioTechnologyInvestments) is a technology investment and development group focused on building practical tools and solutions.

## License

This repository is open source. Check individual skills for specific licensing if needed.
