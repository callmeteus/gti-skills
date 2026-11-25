<div align="center">

# SEO Growth

> Agency-grade SEO as code changes you review

**Audits a site's technical and on-page SEO, mines Search Console for quick wins, builds the pages buyers search for, and makes the site readable by AI search, with fixes applied in the codebase.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Python](https://img.shields.io/badge/python-3.8%2B-blue.svg)](#requirements)
[![Agents](https://img.shields.io/badge/agents-10%20supported-8A63D2.svg)](#installation)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](#requirements)
[![License](https://img.shields.io/badge/license-not%20declared-lightgrey.svg)](#license)

[Quick Start](#quick-start) • [Usage](#usage) • [Reference](#reference) • [Troubleshooting](#troubleshooting)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Reference](#reference)
- [Output](#output)
- [Security](#security)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Overview

Most of what an SEO retainer delivers each month is a set of checklists run by hand: crawl and indexing checks, title and meta fixes, Search Console reviews, new comparison and FAQ pages, and lately, checking whether AI search can read the site. A coding agent can run all of them and land the fixes as code changes, as long as it knows the rules, the thresholds, and where to stop.

SEO Growth gives the agent that playbook in four modes (Audit, Grow, Build, AI search), two standard-library Python scripts (a live site check and a Search Console export analyzer), a 46-item checklist, and content rules that forbid invented proof. It edits the user's code and content; it never submits, posts, emails, or buys anything.

```text
  site URL + repository (+ Search Console export)
          │
          v
  scope: framework, metadata source, money pages, keyword map
          │
          ├──> site_check.py ──> robots, sitemap, soft 404, tags, AI crawlers
          ├──> gsc_queries.py ──> long questions, page 2, low CTR, declines
          │
          v
  on-page fixes, new buyer pages, AI search facts
          │
          v
  code changes in the repository + report in ~/.gti/seo-growth/<project>/
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Check crawlability, indexing, canonicals, redirects, and soft 404s on the live site | Run a performance audit (it hands off to Web Performance Audit) |
| Compare what Googlebot, Bingbot, GPTBot, OAI-SearchBot, ClaudeBot, and PerplexityBot receive | Submit sitemaps, request indexing, or change dashboard settings |
| Mine Search Console exports for long questions, page-2 queries, low CTR, and declines | Call paid SEO APIs or ask for API keys |
| Fix titles, descriptions, headings, schema, internal links, robots.txt, and sitemaps in code | Post on Reddit, submit to directories, or send outreach |
| Draft comparison, alternatives, use-case, FAQ, and cluster pages with proof markers | Invent statistics, reviews, or credentials |

## Features

- **Four modes:** Audit, Grow, Build, and AI search, each with a fixed list of steps.
- **Live site check:** robots.txt rules per agent, sitemap and sitemap index parsing, a soft-404 probe, redirect hops, title and description lengths, canonical, noindex in meta and headers, H1 count, alt text, JSON-LD types, hreflang, and viewport.
- **AI crawler comparison:** fetches each page as six crawlers and flags 403s, challenge pages, missing text, or a missing phrase such as a price.
- **Search Console mining:** long questions of 8+ words, positions 8 to 20, page-1 rows with low CTR, and pages that lost clicks; reads English and Portuguese exports with comma or semicolon separators.
- **In-console filter:** the regex for 8+ word queries to use directly in Search Console.
- **Buyer pages:** rules for comparison, alternatives, use-case, FAQ from People Also Ask, listicles, clusters, and programmatic pages, with clear thresholds.
- **Proof first:** every claim needs a source; missing proof becomes a `[NEEDS PROOF]` marker.
- **46-item checklist:** every item mapped to the step that covers it, marked in the report.
- **Generated files outside the repository:** reports and analyses go to `~/.gti/seo-growth/<project>/`.

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| Python | 3.8+ | Runs `site_check.py` and `gsc_queries.py` (standard library only) | No |
| Network access | - | Live checks against the target site | - |
| Google Search Console export | - | Optional input for the Grow mode | No |

| Platform | Python command |
|----------|----------------|
| macOS and Linux | `python3` |
| Windows | `python` or `py -3` |

## Installation

From the repository root, install the skill into any supported agent:

```bash
node packages/cli install --harness claude --skill seo-growth
```

The same command works in PowerShell. Use a comma separated list or `all` for several agents, `--scope user` to install for every project, and `--dry-run` to preview.

| Agent | Id | Project folder | User folder |
|-------|----|----------------|-------------|
| Cursor / Cursor CLI | `cursor` | `.cursor/skills` | `~/.cursor/skills` |
| Claude / Claude Code | `claude` | `.claude/skills` | `~/.claude/skills` |
| Antigravity | `antigravity` | `.agents/skills` | `~/.gemini/antigravity/skills` |
| OpenCode | `opencode` | `.opencode/skills` | `~/.config/opencode/skills` |
| Cline | `cline` | `.cline/skills` | `~/.cline/skills` |
| Kilo Code | `kilo` | `.kilocode/skills` | `~/.kilocode/skills` |
| Kiro | `kiro` | `.kiro/skills` | `~/.kiro/skills` |
| Codex | `codex` | `.agents/skills` | `~/.agents/skills` |
| GitHub Copilot | `copilot` | `.github/skills` | `~/.copilot/skills` |
| Muse Code | `muse` | `.agents/skills` | `~/.agents/skills` |

The skill is one self-contained folder, identical for every agent. To copy it by hand, put `skills/seo-growth` in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/seo-growth .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\seo-growth .claude\skills\
```

Each agent has a short guide in `skills/seo-growth/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

## Quick Start

```text
Run an SEO audit of https://example.com and fix what you find in this repo.
```

The agent finds the framework and money pages, runs the live site check, fixes crawl, indexing, and on-page problems in the code, and writes a report with the steps only you can take, such as submitting the sitemap.

## Usage

### Input

| Input | Required | Example |
|-------|:--------:|---------|
| Site | Yes | The live URL, or a repository the agent can read it from (`metadataBase`, `siteUrl`, `CNAME`) |
| Repository | No | Needed to apply fixes; without it the skill reports only |
| Search Console export | No | `Queries.csv` or `Pages.csv` from Performance, Search results, Export |
| Competitors | No | Three names or URLs, for comparison and alternatives pages |
| Third-party exports | No | Ahrefs, Semrush, or DataForSEO CSV files |

### Examples

```text
Why is /pricing not indexed? The site is acme.io.
```

```text
Here is my Search Console export. What should I write or fix next?
```

```text
Create a comparison page against Competitor X and link it from pricing.
```

```text
Can ChatGPT and Perplexity read our pricing? Fix it if not.
```

## How It Works

```text
  1. Scope                site, framework, metadata source, money pages, keyword map
          │
  2. Technical audit      site_check.py, then the code behind each failure
          │
  3. On-page              titles, descriptions, headings, intent, links, schema, E-E-A-T
          │
  4. Search Console       gsc_queries.py: long questions, page 2, low CTR, declines
          │
  5. Pages to build       comparison, alternatives, use-case, FAQ, clusters, programmatic
          │
  6. AI search            crawler parity, server-rendered facts, JSON-LD, llms.txt, buyer prompts
          │
  7. Fix and verify       fixes in priority order, re-check, list the user's steps
          │
  8. Report               findings by revenue impact, checklist, pending steps
```

Each mode runs a subset: Audit runs 1, 2, 3, 6, 7, 8; Grow runs 1, 4, 3, 7, 8; Build runs 1, 5, 3, 7, 8; AI search runs 1, 6, 2, 7, 8.

## Reference

### site_check.py

```bash
python3 scripts/audit/site_check.py https://example.com --pages /pricing /blog/post --expect "Pro"
```

| Argument | Default | Description |
|----------|---------|-------------|
| `site` | Required | Site root, for example `https://example.com`; `https://` is added when missing |
| `--pages` | The home page | Paths or URLs to check |
| `--from-sitemap N` | `0` | Also check the first N URLs from the sitemap |
| `--expect` | None | A phrase every crawler must receive in the HTML, such as a price |
| `--delay` | `0.5` | Seconds between requests |
| `--no-crawlers` | Off | Skip the per-crawler comparison |
| `--project` | Git root folder name | Project folder under `~/.gti/seo-growth/` |
| `--out` | `~/.gti/seo-growth/<project>/audits` | Output folder |

### gsc_queries.py

```bash
python3 scripts/gsc/gsc_queries.py Queries.csv --min-words 8 --min-impressions 10 --ctr-floor 2
```

| Argument | Default | Description |
|----------|---------|-------------|
| `csv` | Required | `Queries.csv` or `Pages.csv` from a Search Console Performance export |
| `--min-words` | `8` | Words for a long question |
| `--min-impressions` | `10` | Impressions for page-2 and low-CTR rows |
| `--ctr-floor` | `2.0` | CTR percent under which a page-1 row is low |
| `--limit` | `50` | Rows per list |
| `--project` | Git root folder name | Project folder under `~/.gti/seo-growth/` |
| `--out` | `~/.gti/seo-growth/<project>/gsc` | Output folder |

### Reference files

| File | Contents |
|------|----------|
| `references/workflow/01-scope.md` | Finding the site, framework, metadata source, money pages, and the keyword map |
| `references/workflow/02-technical-audit.md` | Crawl, indexing, redirects, canonicals, locales, JavaScript content, orphans |
| `references/workflow/03-on-page.md` | Titles, descriptions, headings, intent, cannibalization, links, schema, E-E-A-T |
| `references/workflow/04-search-console.md` | The export, the in-console regex, and what to do with each list |
| `references/workflow/05-pages-to-build.md` | Keyword selection and rules for each buyer page type |
| `references/workflow/06-ai-search.md` | AI crawler access, structured facts, `llms.txt`, and buyer prompts |
| `references/workflow/07-fix-and-verify.md` | Fix order, verification commands, and the user's own steps |
| `references/quality/checklist.md` | The 46-item checklist |
| `references/quality/content-rules.md` | Proof, answer-first, plain writing, and honesty rules |

## Output

```markdown
# SEO report: acme.io

## Findings

### 1. AI crawlers cannot see pricing

- **Where:** https://acme.io/pricing, app/pricing/page.tsx
- **Problem:** GPTBot and PerplexityBot receive 12% of the browser's text; "Pro" is not in server HTML.
- **Fix:** Applied in app/pricing/page.tsx: server-rendered price table and Product JSON-LD.
- **Verify:** site_check.py https://acme.io --pages /pricing --expect "Pro"
- **Watch:** pricing page citations in AI answers, indexed status in Search Console.

## Pending: steps for the user

- Submit https://acme.io/sitemap.xml in Google Search Console and Bing Webmaster Tools.
```

| Section | Contents |
|---------|----------|
| Summary | The biggest problem, what was fixed, and what the user must do next |
| Findings | One block per problem by revenue impact: where, problem, fix, verify, watch |
| Search Console actions | Each query or page with its signal, action, and status |
| Pages to build | Planned pages with keyword, intent, and missing proof |
| Checklist | The 46 items marked done, failing, not applicable, or not checked |
| Pending | Outward steps for the user, with the exact text to use |
| Not verified | What could not be checked and why |

| Path | Contents |
|------|----------|
| `~/.gti/seo-growth/<project>/audits/` | Site check results in Markdown and JSON |
| `~/.gti/seo-growth/<project>/gsc/` | Search Console analyses in Markdown and JSON |
| `~/.gti/seo-growth/<project>/reports/` | Final reports |
| `~/.gti/seo-growth/<project>/drafts/` | Page drafts not yet placed in the repository |
| `~/.gti/seo-growth/<project>/state.md` | Keyword map and change log |

`GTI_HOME` replaces `~/.gti`.

## Security

- **Network:** `site_check.py` only sends GET requests to the site you name, with a delay between requests. It sends crawler user agents to compare responses; it does not bypass bot protection.
- **Tokens:** the skill needs no API keys and never asks for passwords. Search Console data comes from exports you download.
- **File access:** the scripts read the CSV you pass and write only under `~/.gti/seo-growth/` (or `--out`). Code changes happen through the agent in your repository and are yours to review and commit.
- **Outward actions:** submissions, outreach, and posts are listed as pending for the user and never performed by the agent.

## Development

| Command | Action |
|---------|--------|
| `python -m unittest discover -s skills/seo-growth/tests` | Runs the script tests, including a full audit against a local HTTP server |
| `npm test` | Runs every test in the repository, including these |
| `node packages/cli build` | Regenerates the agent guides and validates the skill |

## Troubleshooting

<details>
<summary><strong>Every crawler shows a 403 or "bot challenge page"</strong></summary>

The site's CDN or firewall blocks unknown clients, sometimes including your own machine. Check the same URL in a browser; if real users get through, allow the search crawlers in the CDN bot settings and run the check again.

</details>

<details>
<summary><strong>"not a Search Console export"</strong></summary>

The CSV is missing a query or page column and an impressions column. Export from Performance, Search results, and pass `Queries.csv` or `Pages.csv` from the zip, not `Chart.csv` or `Filters.csv`.

</details>

<details>
<summary><strong>Numbers look 1,000 times too small or too large</strong></summary>

The export mixes decimal and thousands separators in an unusual way. Re-export as CSV from Search Console directly instead of re-saving the file in a spreadsheet, or save it with a comma separator and a dot as the decimal mark.

</details>

<details>
<summary><strong>No sitemap URLs found, but the site has a sitemap</strong></summary>

The sitemap is not at `/sitemap.xml` and not listed in robots.txt. Add a `Sitemap:` line to robots.txt, which also helps search engines find it.

</details>

<details>
<summary><strong>The agent does not see the skill</strong></summary>

Restart the agent session after installing, and confirm the folder is in the path your agent reads (see the table in [Installation](#installation)).

</details>

## Limitations

- The site check fetches pages without running JavaScript, which is how most AI crawlers see them; it does not render pages like Googlebot.
- It does not crawl the whole site or find every broken link; it checks the pages you name or the first N in the sitemap.
- Search Console data is sampled and delayed by Google; the analysis is as good as the export.
- Keyword volume and difficulty need third-party exports; the skill does not estimate them.
- Rich results, Core Web Vitals, and AI citations need external tools the skill lists as pending when it cannot run them.
- Rankings depend on factors outside the codebase; the skill never promises positions or traffic.

## Acknowledgements

| Project | License | Used for |
|---------|---------|----------|
| [Illyism/seo-skills](https://github.com/Illyism/seo-skills) | MIT | Ideas for the audit order, thresholds for locales, programmatic pages, comparison pages, internal links, and AI crawler checks (rewritten, no code copied) |
| [Edward Sturm on X: Search Console long-query filter](https://x.com/edwardeachday/status/2123711810989600882) | Post on X | The 8+ word regex filter and the answer-at-the-top workflow |
| [Okara on X: SEO checklist](https://x.com/askOkara/status/2123702890724552943) | Post on X | The base of the checklist |
| [Oleksii Sidorov on X: 48 SEO and GEO tricks](https://x.com/acecreamu/status/2125234701912985928) | Post on X | Brand search tracking, SERP format matching, profile and cross-post rules, AI answer tracking, the About page, and the community posting rules |

## License

No license has been declared for this skill yet. See the [root README](../../README.md#license).
