---
name: seo-growth
description: >-
  Runs the SEO work an agency retainer bills for, inside the codebase: a
  technical audit (indexing, robots.txt, sitemaps, canonicals, soft 404s,
  redirects, Core Web Vitals pointers, schema), on-page fixes (titles, meta
  descriptions, headings, internal links), Google Search Console mining (long
  questions of 8+ words, page-2 queries, high-impression low-CTR pages), new
  pages that win buyers (comparison, alternatives, use-case, FAQ from People
  Also Ask, topic clusters, programmatic pages), and AI search visibility
  (what GPTBot, ClaudeBot, and PerplexityBot actually receive, llms.txt,
  JSON-LD). Fixes land as code changes the user reviews. Use when the user asks
  for SEO, an SEO audit, more organic traffic, ranking a page, Search Console
  analysis, GEO or AI search visibility, comparison or alternatives pages, or
  says a page is not indexed. Do not use for paid ads, social media growth,
  page speed work alone (use web-performance-audit), or posting, link buying,
  and outreach on the user's behalf.
metadata:
  display-name: SEO Growth
---

# SEO Growth

## Core Rule

Always respond in the user's language, regardless of the language used in this skill, its references, or the site being analyzed. Write page copy in the site's own language.

## Autonomous Mode

When the user says to work on your own, for example "do it yourself", "faz você mesmo", "you don't need to ask me", "não precisa me chamar", or "just do it", or when the request runs unattended:

- **Do not stop for input.** Skip questions, confirmations, and pauses that wait for the user. At each decision, take the option this skill recommends, or the safest default, and note the decision and the reason.
- **Do not open anything for the user.** No browser tabs, viewers, editors, or servers started for the user to look at. Still write every file the skill produces and give the paths at the end.
- **Never take a gated irreversible or outward action** unless the request already allows it: deleting the user's data, tests, or files; publishing, posting, pushing, or sending; paying; typing credentials. List each one as pending instead.
- **Finish with one report:** the decisions you took and why, what you did, what is pending, and what you could not verify.

In this skill:

- **Missing site URL (step 1):** take it from the repository (`siteUrl`, `metadataBase`, `NEXT_PUBLIC_SITE_URL`, `astro.config`, `hugo.toml`, `package.json` homepage, `CNAME`). With none, audit the code only and list the live checks as pending.
- **Missing Search Console export (step 4):** skip the GSC step, list it as pending, and say which export to download.
- **Choosing the mode (step 1):** default to Audit, plus Grow when a GSC export exists.
- **Applying fixes (step 7):** apply code fixes when the request asked for changes; when it asked only for an audit, write the report and list the fixes as pending.
- **Drafting new pages (step 5):** write drafts with `[NEEDS PROOF]` markers instead of asking for facts, and never invent numbers, quotes, or reviews.
- **Live searches (`site:`, People Also Ask, SERP checks):** use a fetch or search tool without opening a browser for the user; when none is available, list them as pending.
- **Outward steps:** never submit sitemaps, request indexing, submit to directories, email for links, or post on Reddit or forums. List them as pending with the exact text to use.

## Output Location

Everything this skill generates (reports, crawl results, GSC analyses, keyword maps, drafts the user did not ask to put in the repository, and run state) goes to `~/.gti/seo-growth/<project>/`, where `<project>` is the repository folder name (or the site's domain when there is no repository) and `GTI_HOME` replaces `~/.gti`. Create the folder when needed. Never write generated files into the user's repository: only the changes the user asked for (their code, page content, `robots.txt`, sitemaps, schema, redirects, `llms.txt`) go there, and a generated file goes there only when the user names that place.

| Folder | Contents |
|--------|----------|
| `~/.gti/seo-growth/<project>/audits/` | `site_check.py` results (`.md` and `.json`) |
| `~/.gti/seo-growth/<project>/gsc/` | `gsc_queries.py` results (`.md` and `.json`) |
| `~/.gti/seo-growth/<project>/reports/` | The final SEO report from the template |
| `~/.gti/seo-growth/<project>/drafts/` | Page drafts the user has not placed in the repository yet |
| `~/.gti/seo-growth/<project>/state.md` | Keyword map, page-to-keyword assignments, and what was shipped when |

## When to use

- The user asks for an SEO audit, an SEO review of a pull request, or "why is this page not on Google".
- The user wants more organic traffic, to rank a specific page for a keyword, or to push page-2 pages up.
- The user shares a Google Search Console export, or asks what to do with Search Console.
- The user asks about AI search (ChatGPT, Perplexity, Claude, Google AI Overviews), GEO, `llms.txt`, or whether AI crawlers can read the site.
- The user wants comparison, alternatives, use-case, FAQ, or programmatic pages.

Do not use this skill for paid search, social media, or email marketing. For page speed alone, use `web-performance-audit`; this skill only flags Core Web Vitals and hands off.

## Prerequisites

- The site's code in the current repository, the live URL, or both. The code is where fixes land; the URL is where the live checks run.
- Optional but valuable: a Google Search Console export (Performance, Search results, Export, CSV or Google Sheets saved as CSV). Queries and Pages tables both work.
- Python 3.8 or newer for the scripts. Use `python3` on macOS and Linux, and `python` or `py -3` on Windows. No packages to install.
- Network access for the live checks. Ahrefs, Semrush, or DataForSEO data is optional; never ask the user for an API key, use exports they share.

## Modes

| Mode | Trigger | Steps |
|------|---------|-------|
| Audit | "SEO audit", "not indexed", "check my SEO" | 1, 2, 3, 6, 7, 8 |
| Grow | A GSC export, "more traffic", "page 2", "low CTR" | 1, 4, 3, 7, 8 |
| Build | "comparison page", "alternatives", "FAQ", "programmatic pages", "rank this keyword" | 1, 5, 3, 7, 8 |
| AI search | "ChatGPT", "Perplexity", "GEO", "llms.txt", "AI Overviews" | 1, 6, 2, 7, 8 |

Run every step listed for the mode, in that order. A request can combine modes; run the union of their steps in numeric order.

## Instructions

1. **Scope.** Find the site URL, the framework, how pages and metadata are generated, the money pages (pricing, signup, product, top landing pages), and the target market and language. Read [references/workflow/01-scope.md](references/workflow/01-scope.md). Write or update `state.md` with the keyword map.

2. **Technical audit.** Run the live check, then read the code paths it points to:

   ```bash
   python3 <skill-dir>/scripts/audit/site_check.py https://example.com --pages /pricing /blog/some-post
   ```

   Check crawl blockers, robots.txt, sitemaps, canonicals, soft 404s, redirects, hreflang, noindex, orphan pages, broken links, JavaScript-only content, and Core Web Vitals pointers, with the rules and thresholds in [references/workflow/02-technical-audit.md](references/workflow/02-technical-audit.md).

3. **On-page.** For every page in scope, check the title (50 to 60 characters, target keyword first, not truncated), a unique meta description, one H1 that matches intent, heading order, contextual internal links, image alt text, clean URLs, schema, author and E-E-A-T signals, and keyword cannibalization. Read [references/workflow/03-on-page.md](references/workflow/03-on-page.md).

4. **Search Console mining.** Run the GSC script on the export:

   ```bash
   python3 <skill-dir>/scripts/gsc/gsc_queries.py Queries.csv
   ```

   It lists long questions of 8+ words, page-2 queries (positions 8 to 20), and high-impression low-CTR rows. For each, find the page that already ranks and answer the question near its top, fix its title and description, or plan a new page. Read [references/workflow/04-search-console.md](references/workflow/04-search-console.md), which also covers the regex filter to use inside Search Console itself.

5. **Pages to build.** Plan and draft the pages the site is missing: comparison (`/vs/<competitor>`), alternatives, use-case and feature pages, FAQ pages from People Also Ask, listicles, topic clusters around pillar pages, and programmatic pages with real data. Every claim needs proof. Read [references/workflow/05-pages-to-build.md](references/workflow/05-pages-to-build.md) and apply [references/quality/content-rules.md](references/quality/content-rules.md) to every draft.

6. **AI search visibility.** Check what AI crawlers receive (the site check does this), whether pricing and key facts are in server-rendered HTML, robots.txt rules per AI bot, JSON-LD, `llms.txt`, and which buyer prompts the site should be cited for. Read [references/workflow/06-ai-search.md](references/workflow/06-ai-search.md).

7. **Fix.** Apply the fixes in the codebase, one concern per commit when the user commits: crawl and indexing first, then money pages, then content. Read [references/workflow/07-fix-and-verify.md](references/workflow/07-fix-and-verify.md) for the fix order, verification commands, and the authority work (links, directories) that stays with the user.

8. **Report.** Write the report from [assets/templates/seo-report.md](assets/templates/seo-report.md) to `~/.gti/seo-growth/<project>/reports/`. Order findings by expected revenue impact, not by count. List every outward step as pending with the exact text to use. Summarize the top findings in chat and give the report path.

Before reporting, run the full checklist in [references/quality/checklist.md](references/quality/checklist.md) and mark each item as done, failing, not applicable, or not checked.

## Examples

```text
User: Why is my pricing page not showing up on Google? Site is acme.io.
Agent: Runs site_check.py on https://acme.io --pages /pricing. Finds robots.txt with
"Disallow: /" for every agent except Googlebot, a canonical on /pricing pointing to
the homepage, and pricing rendered only by client JavaScript (AI bots receive an
empty table). Fixes robots.txt to default-allow with private paths blocked, removes
the wrong canonical, server-renders the price table with Product and Offer JSON-LD,
and adds /pricing to the sitemap. Report lists "Request indexing in Search Console"
and "Submit the sitemap in Bing Webmaster Tools" as steps for the user.
```

```text
User: Here's my Search Console export. What should I write next?
Agent: Runs gsc_queries.py. Finds 14 questions of 8+ words with impressions and no
clicks, 9 queries in positions 8 to 20, and 4 pages with high impressions and CTR
under 2%. Adds a direct answer in the first 40 words of the pages that already rank
for the questions, rewrites the 4 titles and descriptions, and drafts one new FAQ
page for a question cluster no page covers. Saves the plan to state.md.
```

```text
User: Make a comparison page against Competitor X.
Agent: Checks the competitor's pricing page the same day, collects three recent
independent complaints, and drafts /vs/competitor-x with the verdict in the first
50 words, pricing at 1, 5, and 25 seats, a "where Competitor X wins" section, and
[NEEDS PROOF] where the user must supply data. Links it from the pricing page and
two related posts.
```

## Resources

| Path | Purpose |
|------|---------|
| `references/workflow/` | One file per step: scope, technical audit, on-page, Search Console, pages to build, AI search, fix and verify |
| `references/quality/checklist.md` | The full SEO checklist, every item mapped to a step |
| `references/quality/content-rules.md` | Proof, intent, and writing rules for every page the agent drafts |
| `scripts/audit/site_check.py` | Live check: robots.txt, sitemap, soft 404, per-page tags, redirects, and what AI crawlers receive |
| `scripts/gsc/gsc_queries.py` | Search Console export analysis: long questions, page-2 queries, low CTR |
| `assets/templates/seo-report.md` | The final report structure |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.

## Notes

- Never promise rankings, traffic numbers, or timelines. Say what each change fixes and which metric to watch.
- Never fabricate statistics, reviews, testimonials, author credentials, or competitor claims. Missing proof becomes a `[NEEDS PROOF]` marker for the user.
- No link schemes, no paid links, no hidden text, no doorway pages, no cloaking (AI bots and Googlebot must receive the same content as users), and no auto-generated pages without unique data.
- No click manipulation (bots, paid clicks, or click farms to fake engagement). Google's click signals, such as NavBoost, are documented, but the fix is a result people choose and a page that answers them.
- Treat third-party SEO tool data as estimates. Search Console is the source of truth for the user's own site.
