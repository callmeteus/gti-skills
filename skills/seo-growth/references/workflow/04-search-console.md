# Step 4: Search Console mining

Goal: grow from what Google already shows the site for. Search Console data is the most reliable source the user owns, and the cheapest wins are queries where the site already has impressions.

## Get the export

Ask the user for an export of the last 3 months (16 months when traffic is low):

1. Search Console, Performance, Search results.
2. Date range: last 3 months. Enable Total clicks, Total impressions, Average CTR, and Average position.
3. Export, Download CSV (a zip with `Queries.csv`, `Pages.csv`, and more) or Google Sheets saved as CSV.

The script reads English and Portuguese headers and both the zip's `Queries.csv` and `Pages.csv`.

## Run the analysis

```bash
python3 <skill-dir>/scripts/gsc/gsc_queries.py Queries.csv
python3 <skill-dir>/scripts/gsc/gsc_queries.py Queries.csv --min-words 6 --min-impressions 20 --ctr-floor 1.5
```

It writes Markdown and JSON to `~/.gti/seo-growth/<project>/gsc/` with three lists.

### 1. Long questions (8+ words)

Queries of 8 or more words are the specific questions buyers type before they find the site, the same kind of questions they ask ChatGPT. Pick the ones with high impressions and few clicks.

For each one:

1. Find the page that already ranks for it. In Search Console, click the query, then the Pages tab. With a Pages export only, match by topic.
2. Answer the question directly near the top of that page (first 40 words of a section), using the query's wording in a heading or the first sentence.
3. When several questions share a topic and no page fits, plan one new page (step 5) or an FAQ section with `FAQPage` schema.

The same filter works inside Search Console without exporting: Performance, Search results, Add filter, Query, switch the dropdown to Custom (regex), and enter:

```text
^(?:\S+\s+){7,}\S+$
```

It matches queries of 8 or more words. Change `7` to `5` for 6+ words. Questions only:

```text
^(how|what|why|when|where|which|who|can|does|is|are|should|como|qual|quais|o que|por que|quando|onde|quanto)\b
```

### 2. Page-2 queries (positions 8 to 20)

Pages that rank just below the top results move fastest. Start with positions 8 to 15, which are one push from page one. For each query with real impressions:

1. Compare the ranking page with the current top 5 results: what do they cover that this page does not? Add those sections with original detail.
2. Answer the query in the first 40 words.
3. Add 3 or more internal links to the page from related pages that get traffic.
4. Refresh the facts and update `dateModified`.
5. Re-check in 2 to 4 weeks (record the date in `state.md`).

### 3. High impressions, low CTR

Rows ranking on page 1 (position 10 or better) with CTR under the floor (default 2%) are a title and description problem. Rewrite the title (keyword first, specific benefit, 50 to 60 characters) and the meta description (step 3). Do not change the page's topic.

Before rewriting, compare mobile and desktop CTR at similar positions (Search Console, Devices tab, with the query or page filter on). When only one device is low, the cause is usually how the result shows there (a cut title, a rich result, ads or AI answers above it), not the wording itself.

### Ranking URL changes

When the page that ranks for a query keeps changing, filter by the query, open the Pages tab, and compare date ranges. Two of the user's pages swapping is cannibalization (step 3); one page replaced by a weaker one usually means internal links or the title point at the wrong page.

## Brand searches

Branded queries show whether launches, posts, and mentions reach people. In Search Console, add a Query filter with Custom (regex) set to the brand and its common misspellings, for example `acme|acmme|acme\.io`. Record branded impressions and clicks in `state.md` before and 2 to 4 weeks after each launch. Switch the filter to "Doesn't match regex" to see only non-brand queries, which is where SEO growth shows.

## Pages report

Run the script on `Pages.csv` too. Pages with falling clicks between two periods are the refresh list: compare the page with the current top 10 and rewrite weak sections. To compare periods, export with Compare, Last 3 months vs Previous period; the script reports the change when both columns exist.

## Bing

Bing Webmaster Tools has its own data and feeds ChatGPT search, Copilot, and much of DuckDuckGo's results. Recommend the user verifies the site there (it can import from Search Console) and submits the sitemap. Both are user steps.

Research Bing keywords separately: its Search Performance report and Keyword Research tool show queries and rankings that differ from Google's, often with older or more desktop-heavy audiences. Bing traffic is a hedge against a single Google update, so fix pages that rank well on Google but poorly on Bing.

## Money per landing page

Rankings that do not make money are not wins. Join the Pages export with the user's analytics or CRM (conversions, leads, or revenue per organic landing page) and rank the work by money per page, not by clicks. For high-traffic landing pages that convert poorly, recommend a behavior tool such as Microsoft Clarity (session recordings and heatmaps) to find the friction. Adding it is the user's decision, since it adds a script and may need cookie consent.

## Done when

Each listed query has an action in `state.md`: answer added to a page, title rewritten, new page planned, or skipped with a reason.
