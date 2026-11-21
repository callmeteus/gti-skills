# SEO checklist

Mark every item in the report as done, failing, not applicable, or not checked. The step column says where the rule lives.

## Technical

| # | Item | Step |
|---|------|------|
| 1 | No indexing errors on pages that should rank (Search Console Pages report, noindex leaks) | 2 |
| 2 | robots.txt default-allows, blocks only private paths, never blocks CSS or JS | 2 |
| 3 | Sitemap exists, lists only canonical 200 URLs, is in robots.txt, and is submitted to Google and Bing | 2, 7 |
| 4 | Canonical tag on every page, pointing to the right URL | 2 |
| 5 | Unknown URLs return 404 (no soft 404s) | 2 |
| 6 | No broken internal links and no redirect chains; redirects are one hop | 2 |
| 7 | No orphan pages among pages that should rank | 2 |
| 8 | Content, links, and prices are in server HTML, crawlable without JavaScript | 2, 6 |
| 9 | Mobile friendly at 390 px wide | 2 |
| 10 | Core Web Vitals checked (hand off to web-performance-audit) | 2 |
| 11 | Locales: reciprocal hreflang plus x-default, each locale earns its place | 2 |
| 12 | Clean, descriptive URLs | 3 |

## On-page

| # | Item | Step |
|---|------|------|
| 13 | Titles 50 to 60 characters, keyword first, not cut off in `site:` results | 3 |
| 14 | Unique meta descriptions | 3 |
| 15 | One H1 and an ordered heading structure | 3 |
| 16 | Every page matches its search intent | 3 |
| 17 | No keyword cannibalization; thin or overlapping pages merged | 3 |
| 18 | No duplicate content; original content with first-hand detail | 3 |
| 19 | Images optimized with alt text | 3 |
| 20 | Breadcrumbs, visible and in schema | 3 |
| 21 | Schema markup that matches the page, validated in the Rich Results Test | 3 |
| 22 | Author bios and E-E-A-T signals | 3 |
| 23 | Important pages have 3+ contextual internal links | 3 |
| 24 | `dateModified` updated when content is refreshed | 3 |

## Growth

| # | Item | Step |
|---|------|------|
| 25 | Long questions (8+ words) answered at the top of pages that already rank | 4 |
| 26 | Page-2 pages (positions 8 to 20) updated | 4 |
| 27 | High-impression, low-CTR pages have new titles and descriptions | 4 |
| 28 | Pages losing traffic and rankings are on a refresh list | 4 |
| 29 | Keywords chosen for high volume, low difficulty, and buying intent | 5 |
| 30 | Comparison and alternatives pages exist for main competitors | 5 |
| 31 | Feature and use-case pages exist | 5 |
| 32 | FAQ content built from People Also Ask | 5 |
| 33 | Best listicles in the category | 5 |
| 34 | Topic clusters around pillar pages | 5 |
| 35 | Programmatic pages have unique data and noindex thin results | 5 |

## AI search and authority

| # | Item | Step |
|---|------|------|
| 36 | AI search bots receive the same content as browsers | 6 |
| 37 | Pricing and key facts in server HTML, schema, and llms.txt | 6 |
| 38 | Buyer prompts mapped, with a page for each | 6 |
| 39 | High-quality backlinks earned, no paid or schemed links | 7 |
| 40 | Google Business Profile for local businesses | 3, 7 |
