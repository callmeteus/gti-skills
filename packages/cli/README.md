# @gti-skills/cli

Lists, validates, builds, and installs the gti-skills skills for ten coding agents.

## Overview

This package owns the harness registry, the skill validator, the installer, and the generator that writes each skill's per-agent guides (`harnesses/<agent>/GUIDE.md`) and syncs shared scripts into skills. It has no dependencies beyond Node.js.

It does not run skills and does not contain skill content. Skills live in [../../skills](../../skills) and are documented in [../../README.md](../../README.md).

## Run

From the repository root:

```bash
node packages/cli list
node packages/cli validate
node packages/cli build
node packages/cli check
node packages/cli install --harness claude --skill video-to-markdown
```

From this folder, replace `node packages/cli` with `node .`.

## Layout

| Path | Responsibility |
|------|----------------|
| `index.mjs` | Entry point and command dispatch |
| `commands/` | One file per command: `Build`, `Check`, `Install`, `List`, `Validate` |
| `core/Registry.mjs` | Loads the agent registry and resolves skill folders |
| `core/Skills.mjs` | Discovers skills from `skill.json` and applies shared and generated files |
| `core/Frontmatter.mjs` | Validates `SKILL.md` against the Agent Skills standard and the repository rules |
| `core/Plan.mjs` | Runs validation across all skills |
| `core/Generated.mjs` | Renders the per-agent guides and other documents generated from the registry |
| `core/Tree.mjs` | Reads, writes, and compares file trees with LF line endings |
| `registry/harnesses.json` | The ten supported agents and their skill folders |
| `tests/` | Node test runner suites |

## Scripts

| Command | Action |
|---------|--------|
| `list` | Show skills and agents |
| `validate [--skill <id>]` | Validate skills; exit 1 on errors |
| `build` | Sync shared scripts, regenerate the per-agent guides, and validate |
| `check` | Exit 1 when synced or generated files are stale; writes nothing |
| `install --harness <ids\|all>` | Install skills. Flags: `--skill <ids\|all>`, `--scope project\|user`, `--dest <dir>`, `--dry-run` |

## Environment

None. Install locations come from the registry; the user scope uses the operating system home directory.

## Testing

```bash
npm run test:cli
```

The suites cover argument parsing, validation rules, the registry, tree comparison, installation into temporary folders, and a check that the committed synced and generated files are up to date.

See [../../README.md](../../README.md) for the full repository.
