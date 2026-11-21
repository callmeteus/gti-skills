# Step 7: Fix and verify

Goal: land the fixes as reviewable code changes, check each one, and hand the user the steps only they can take.

## Fix order

Fix in this order, because each level makes the next one count:

1. **Crawl and indexing:** robots.txt, noindex leaks, soft 404s, sitemap, canonicals, redirect chains, JavaScript-only content.
2. **Money pages:** pricing, signup, product pages: indexable, in the sitemap, linked from navigation, titles, schema, server-rendered facts.
3. **Quick wins from Search Console:** low-CTR titles and descriptions, answers for long questions, page-2 pushes.
4. **Structure:** internal links, merged duplicates, orphan pages, breadcrumbs.
5. **New pages:** comparison, alternatives, use-case, FAQ, clusters.

Keep each change to one concern so the user can review and commit it separately. Do not commit or push unless the user asks.

## Verify

Run the site check again after deploying, or check locally against the dev server or a production build:

```bash
python3 <skill-dir>/scripts/audit/site_check.py http://localhost:3000 --pages /pricing
```

Spot checks without the script:

```bash
curl -sI https://example.com/old-page          # one 301 or 308, Location is the final URL
curl -s -o /dev/null -w "%{http_code}\n" https://example.com/does-not-exist   # 404
curl -s -A "GPTBot" https://example.com/pricing | grep -c "Pro"                # > 0
```

PowerShell:

```powershell
(Invoke-WebRequest -Uri https://example.com/does-not-exist -SkipHttpErrorCheck).StatusCode
(Invoke-WebRequest -Uri https://example.com/pricing -UserAgent "GPTBot").Content -match "Pro"
```

`-SkipHttpErrorCheck` needs PowerShell 7. Also run the project's own build and tests, since metadata and sitemap routes break builds.

## Steps that stay with the user

These are outward actions or need the user's accounts. List each in the report with the exact text or settings to use, and never do them on the user's behalf:

- Submit the sitemap and request indexing in Google Search Console; verify the site in Bing Webmaster Tools and submit the sitemap there.
- Change firewall or CDN bot settings in a dashboard.
- Create or update a Google Business Profile.
- Authority work: directory submissions, link outreach emails, guest posts, PR, and replies on Reddit or forums. Draft the text when asked (honest, with disclosure, no links in forum replies unless the community allows them); the user sends it.

### Authority guidance for the report

- Earn links, never buy them. Count clean editorial referring domains against 3 competitors to size the gap. Treat a high Domain Rating with very little organic traffic as an inflated, low-value site.
- Product loops earn links over time: a "Powered by" badge on free plans, indexable share URLs, and embeds with attribution.
- Directories: only relevant, real directories with an audience, submitted in small batches with a log. Skip link farms.
- Outreach: one email per real reason (a broken link to replace, a resource that fits), never a mass template.

## Done when

Every fix is applied and checked, or listed with why it is not, and every user step is in the report with the text to use.
