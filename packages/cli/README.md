# @gti-skills/cli

Lists, validates, builds, installs, and updates the gti-skills skills for ten coding agents.

## Overview

This package owns the harness registry, the pack registry, the skill validator, the installer, and the generator that writes each skill's per-agent guides (`harnesses/<agent>/GUIDE.md`) and syncs shared scripts into skills, and the updater that reinstalls skills from the latest commit on GitHub `master`. It has no dependencies beyond Node.js.

It does not run skills and does not contain skill content. Skills live in [../../skills](../../skills) and are documented in [../../README.md](../../README.md).

## Run

From the repository root:

```bash
node packages/cli list
node packages/cli validate
node packages/cli build
node packages/cli check
node packages/cli install --harness claude --skill video-to-markdown
node packages/cli install --harness claude --pack research
node packages/cli update --check
node packages/cli update
```

From this folder, replace `node packages/cli` with `node .`.

## Layout

| Path | Responsibility |
|------|----------------|
| `index.mjs` | Entry point and command dispatch |
| `commands/` | One file per command: `Build`, `Check`, `Install`, `List`, `Update`, `Validate` |
| `core/Registry.mjs` | Loads the agent registry and resolves skill folders |
| `core/Packs.mjs` | Loads the pack registry, validates each skill's packs, and resolves `--skill` and `--pack` selections |
| `core/Skills.mjs` | Discovers skills from `skill.json` and applies shared and generated files |
| `core/Frontmatter.mjs` | Validates `SKILL.md` against the Agent Skills standard and the repository rules |
| `core/Plan.mjs` | Runs validation across all skills |
| `core/Generated.mjs` | Renders the per-agent guides and other documents generated from the registry |
| `core/Tree.mjs` | Reads, writes, and compares file trees with LF line endings |
| `core/Installs.mjs` | Install records and update state in `~/.gti-skills` |
| `core/Source.mjs` | Latest commit lookup, tarball download and extraction, and the commit of a source tree |
| `registry/harnesses.json` | The ten supported agents and their skill folders |
| `registry/packs.json` | The skill packs that `--pack` and `skill.json` refer to |
| `tests/` | Node test runner suites |

## Scripts

| Command | Action |
|---------|--------|
| `list` | Show skills, packs, and agents |
| `validate [--skill <id>]` | Validate skills; exit 1 on errors |
| `build` | Sync shared scripts, regenerate the per-agent guides, and validate |
| `check` | Exit 1 when synced or generated files are stale; writes nothing |
| `install --harness <ids\|all>` | Install skills. Flags: `--skill <ids\|all>`, `--pack <ids\|all>`, `--scope project\|user`, `--dest <dir>`, `--dry-run`. Records each installed folder and its commit |
| `update` | Reinstall outdated installs from the latest `master` commit. Flags: `--check`, `--dry-run`, `--force`, `--skip-build`, and the `install` selection flags |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `GTI_SKILLS_HOME` | `~/.gti-skills` | Install records, update state, and downloaded sources |
| `GTI_SKILLS_REPO` | `callmeteus/gti-skills` | GitHub repository that `update` reads |
| `GTI_SKILLS_BRANCH` | `master` | Branch whose latest commit is the current version |
| `GITHUB_TOKEN`, `GH_TOKEN` | Unset | Token for private forks or a higher API rate limit |
| `GTI_SKILLS_NO_UPDATE_CHECK` | Unset | Turns off the daily notice in `list` and `install`; `CI` also turns it off |

Install locations come from the registry; the user scope uses the operating system home directory.

## Testing

```bash
npm run test:cli
```

The suites cover argument parsing, validation rules, the registry, pack selection, tree comparison, installation into temporary folders, tarball extraction, the updater against a stubbed GitHub, the daily notice, and a check that the committed synced and generated files are up to date.

See [../../README.md](../../README.md) for the full repository.
