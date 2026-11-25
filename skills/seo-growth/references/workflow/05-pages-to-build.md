# Step 5: Pages to build

Goal: add the pages buyers search for right before they decide, which most sites do not have.

Apply the content rules (`references/quality/content-rules.md`, linked from step 5 of `SKILL.md`) to every draft. Drafts go into the repository when the user asked for the pages; otherwise to `~/.gti/seo-growth/<project>/drafts/`.

## Pick keywords

- Prefer keywords with buying intent and low difficulty over high-volume informational ones. With Ahrefs, Semrush, or DataForSEO exports, filter for high volume and low keyword difficulty (KD), then sort by traffic value (CPC times volume). A CPC of 3 USD or more with 300+ monthly searches is a strong candidate; a CPC under 0.50 USD rarely pays back.
- Group keywords into one page by SERP overlap: if two keywords share 3 or more of the same top-10 URLs, they belong on one page. With 2 shared URLs, check the page types. With 0 or 1, they need separate pages.
- Check the keyword map first. Never create a page for a keyword another page already targets; improve that page instead.
- Match the format of the top 3 results: a listicle, a tool, a guide, or a comparison. A guide rarely ranks where every top result is a tool.
- Deprioritize keywords whose top 10 is mostly large third-party platforms (Reddit, Quora, LinkedIn, Medium, YouTube, major news sites). A new page rarely displaces them; for those keywords, getting mentioned on the ranking pages is the move (step 7).
- Mine community threads for questions: search `site:reddit.com <the buyer's problem>` to find threads that already rank. Their questions and objections, in the buyer's own words, are input for the page. Write a better, original answer on the site; never copy the thread.

## Page types

### Comparison pages: `/vs/<competitor>`

- Check the competitor's pricing page the same day you write.
- Base criticism on at least 3 independent public complaints from the last 12 months (reviews, forums), and link or cite them.
- Verdict in the first 50 words: who should pick which product.
- Pricing math for realistic sizes (for example 1, 5, and 25 seats).
- A "where <competitor> wins" section with at least 3 honest points. A page that claims the user wins on everything is not credible and does not ship.

### Alternatives pages: `/<competitor>-alternatives`

List several real alternatives including the user's product, with who each one fits. Same proof rules as comparison pages.

### Use-case and feature pages

One page per real feature and per audience or job ("for agencies", "for invoices"), with screenshots of the real product and the specific workflow. These match commercial searches that the homepage cannot.

### FAQ from People Also Ask

Search the main keywords, expand the "People also ask" boxes (each opens more), and collect the questions. Answer each in 40 to 60 words, group them by topic, and either add them to the relevant page or build a short FAQ page with `FAQPage` schema when the answers are visible.

### Listicles

"Best X for Y" pages rank and get cited by AI search. Make the best one in the category: clear criteria, real testing, honest placement of the user's product (not always first unless it truly fits the criteria), and an update date.

### Topic clusters

A pillar page covers the broad topic and links to every cluster page; each cluster page covers one subtopic in depth and links back to the pillar and to siblings. Plan the cluster in `state.md` before writing.

### Programmatic pages

Pages generated from data (cities, integrations, templates, comparisons) work only when each page has unique, useful data.

- Sample 20 URLs per route before shipping. If more than 10% show 0 or 1 results, `noindex` pages with fewer than 3 results.
- Each page needs unique text from its data, not one template with a swapped name.
- One constant or data source feeds the H1, the FAQ, the schema, and `llms.txt`, so they never disagree.
- Ship in batches and watch indexing in Search Console before generating more.

## Refresh before you build

Updating a slipping page is usually faster than building a new one: compare it with the current top 10, rewrite the weak sections, and update `dateModified`. Old page-2 pages (step 4) come first.

Check the positions of the keyword map pages every week (Search Console or the user's rank tracker) and put any page that slips on the refresh list in `state.md`.

## Done when

Each new page has a primary keyword in the keyword map, matches the SERP intent and format, passes the content rules, has schema, and has at least 3 internal links pointing to it, added in the same change that publishes it.
