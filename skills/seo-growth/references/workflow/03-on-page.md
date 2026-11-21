# Step 3: On-page

Goal: every page in scope matches one search intent, says so in its title, and is linked from the pages that should pass it authority.

## Titles

- 50 to 60 characters, so Google does not cut them. Put the target keyword at the start.
- For commercial and transactional pages, include the transactional noun people search ("pricing", "software", "template", "for small teams").
- Unique per page. A shared template suffix (`| Acme`) is fine; repeated full titles are not.
- Check how Google shows the site: search `site:example.com` (or `site:example.com/blog`) and look for titles that are cut off or rewritten without the target keyword. Rewrite those first.
- Keep the `<title>`, frontmatter title, and H1 aligned in topic, but the H1 may be longer and more natural.

## Meta descriptions

- Unique per page, 140 to 160 characters, states the answer or offer and one concrete detail (price, count, outcome). Google may rewrite it, but a good one raises CTR on pages with many impressions.

## Headings

- One H1 per page. H2 and H3 in order, no skipped levels, each heading describing its section (a reader skimming only headings should understand the page).
- Use the questions people search as H2s where they fit.

## Search intent

Match the page type to what already ranks. Search the keyword and look at the top 10:

| Top results are | Build |
|-----------------|-------|
| Guides and how-tos | An article that answers in the first 40 words |
| Listicles ("best X") | A ranked list with criteria and honest picks |
| Product and pricing pages | A product or landing page, not a blog post |
| Comparison pages | A comparison page with a verdict |
| Tools or calculators | A working tool, not an article about one |

A page that fights the intent will not rank no matter how good it is.

## Cannibalization

Two pages targeting the same primary keyword split their signals. Find them with Search Console (one query, several pages ranking and swapping) or the keyword map. Merge them into the stronger page, keep the best sections, 301 the other, and update internal links.

## Thin and duplicate content

- Merge thin or overlapping pages. Delete or `noindex` pages with nothing unique.
- Boilerplate blocks repeated on more than 30% of pages (the same FAQ, the same intro) either get real per-page variables or get removed.
- Write original content: first-hand data, screenshots of the real product, real examples. Do not rewrite the top result.

## Internal links

- Each page that should rank needs at least 3 contextual links from related pages, in the body text, not only in menus or footers.
- Anchors are 3 to 7 descriptive words. Use at least 5 different anchors for a target page and the same exact anchor no more than 3 times.
- Link from pages that already get traffic (Search Console Pages report) to the pages you want to push.
- Build hub pages (pillars) that link to every page in a cluster, and have every cluster page link back.

## URLs

- Short, lowercase, hyphenated, readable words: `/vs/competitor-x`, not `/compare?id=4821`. Replace numeric slugs with words and 301 the old IDs.
- Do not change working URLs for cosmetics. A URL change needs a 301 and costs time.

## Images

- Descriptive `alt` text on every meaningful image (empty `alt=""` for decorative ones), descriptive filenames, modern formats (WebP, AVIF), explicit `width` and `height`, lazy loading below the fold.

## Schema (JSON-LD)

Add the types that match the page, with real data only:

| Page | Types |
|------|-------|
| Every page | `BreadcrumbList` (and visible breadcrumbs) |
| Home | `Organization` or `LocalBusiness`, `WebSite` |
| Article | `Article` or `BlogPosting` with `author`, `datePublished`, `dateModified` |
| Product or pricing | `Product` with `Offer` (price, currency) or `SoftwareApplication` |
| FAQ | `FAQPage` only when the questions and answers are visible on the page |
| Video | `VideoObject` |

Update `dateModified` when the content really changes, never just to look fresh. Validate with Google's Rich Results Test (`https://search.google.com/test/rich-results`) and the Schema.org validator; list the check as pending if you cannot run it.

## E-E-A-T

- Articles show a real author with a short bio, credentials relevant to the topic, and a link to an author page.
- The site has About and Contact pages, a clear company identity, and policies where relevant.
- Claims cite sources; product claims show proof (screenshots, data, customer names the user approves).

## Local businesses

If the business serves a place, recommend a Google Business Profile with consistent name, address, and phone across the site and listings, plus `LocalBusiness` schema. Creating the profile is the user's step.

## Done when

Every page in scope has a checked title, description, H1, intent match, schema, and at least 3 inbound contextual links, or a listed reason why not.
