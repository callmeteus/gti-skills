# Step 2: Technical audit

Goal: make sure search engines and AI crawlers can reach, render, and index every page that should rank, and nothing that should not.

## Run the live check

```bash
python3 <skill-dir>/scripts/audit/site_check.py https://example.com --pages /pricing /features /blog/top-post
python3 <skill-dir>/scripts/audit/site_check.py https://example.com --from-sitemap 30
```

Use `python` or `py -3` on Windows. The script writes Markdown and JSON to `~/.gti/seo-growth/<project>/audits/` and prints the path. Pass `--expect "Pro plan"` to confirm a phrase reaches every crawler (use a price or plan name for the pricing page). It checks:

- robots.txt: reachable, which agents are blocked, blocked assets, `Sitemap:` lines.
- Sitemap: reachable, URL count, whether each checked page is listed.
- Soft 404: a random URL must return 404 or 410, not 200.
- Per page: status, redirect hops, final URL, title and its length, meta description, canonical, robots meta and `X-Robots-Tag`, H1 count, images without alt, JSON-LD types, `hreflang` links, and visible text size.
- Per crawler (Googlebot, Bingbot, GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot): status and visible text compared with a browser. A crawler that gets a 403, a challenge page, or less than half the text is a failure.

Then read the code paths behind every failure.

## Rules

### Crawl blockers

- robots.txt must default-allow and block only private paths (`/api/`, `/admin/`, `/account/`, search result pages, cart). A default-deny file (`Disallow: /` for `*` with `Allow` only for Googlebot) blocks Bing, which feeds ChatGPT search, and every AI crawler.
- Never block rendering assets: `/_next/`, `/static/`, `/assets/`, `.css`, `.js`. Google renders pages and needs them.
- Ship a sitemap if none exists, list it in robots.txt, and include only canonical, indexable, 200 URLs.
- robots.txt does not remove a page from the index. To deindex, use `noindex` first and keep the page crawlable until it drops out; only then disallow it if needed.

### Indexing

- Every money page: returns 200, is in the sitemap, is indexable (no `noindex`), has a self-referencing canonical (or one that points to the correct page), is linked from the navigation or homepage, has at least 3 contextual internal links pointing to it, and is reached without a redirect chain.
- Unknown URLs must return 404. A catch-all route that renders a page for any slug creates soft 404s. In Next.js App Router, use `export const dynamicParams = false` or call `notFound()` when the record is missing; in Pages Router, `fallback: false` or `notFound: true`.
- Remove accidental `noindex` (staging env flags that leaked to production are the usual cause) and check `X-Robots-Tag` headers too.

### Redirects

- One hop only: A to C, never A to B to C. Use 301 or 308 for permanent moves (Next.js `permanent: true` returns 308, which is fine).
- Never redirect deleted pages to the homepage. Redirect to the closest equivalent page, or return 410 for a dead page with no links and no clicks.
- After any migration, check every old URL returns one hop to a 200 page.

### Duplicates and canonicals

- One URL per piece of content: pick `https`, one host (`www` or not), one trailing-slash style, and redirect the rest.
- Strip tracking parameters through canonicals. Paginated pages canonicalize to themselves, not to page 1.
- Merge thin or overlapping pages (step 3), then 301 the losers to the winner.

### Locales

- Keep a locale only if it is fully translated and earns at least 5% of the default locale's clicks or revenue. More than 3 thin locales usually dilute the site.
- Every locale page needs reciprocal `hreflang` links plus `x-default`. One-way hreflang is ignored.
- For each dropped locale, redirect its URLs to the default-locale equivalent.

### JavaScript content

- Text, links, prices, and FAQ answers must be in the server HTML. Content that appears only after client JavaScript runs may not be indexed, and most AI crawlers do not run JavaScript at all.
- Links must be `<a href>` elements, not click handlers.
- Check by comparing the site check's text size per crawler, or with `curl -s <url>` and searching for the phrase.

### Broken links and orphans

- Fix internal links that return 404 or redirect: point them straight at the final URL.
- An orphan page has no internal links pointing to it. Find them by comparing the sitemap with the pages linked from the site (grep the codebase for each path when the links are static). Link every orphan that should rank, or remove it.

### Core Web Vitals and mobile

- Flag pages with obvious problems (huge hero images, layout shift from late-loading banners, blocking third-party scripts, no `viewport` meta) and hand the measurement to the `web-performance-audit` skill. Do not run a performance audit here.
- The site must work at 390 px wide: readable text, tap targets, no horizontal scroll.

### SafeSearch (adult or sensitive niches only)

If traffic dropped and the niche is near adult content, compare `site:` result counts with SafeSearch on and off. Mark only truly adult pages with `<meta name="rating" content="adult">`.

## Done when

Every failure from the site check is either fixed in code (step 7), explained, or listed as pending with the reason.
