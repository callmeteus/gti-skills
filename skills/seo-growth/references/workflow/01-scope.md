# Step 1: Scope

Goal: know what the site sells, where its pages come from, and which pages make money, before checking anything.

## Find the site

1. Site URL: look for `siteUrl`, `metadataBase`, `NEXT_PUBLIC_SITE_URL`, `SITE_URL`, `site` in `astro.config.*`, `baseURL` in `hugo.toml` or `config.toml`, `url` in `_config.yml`, `homepage` in `package.json`, a `CNAME` file, or the deploy config (`vercel.json`, `netlify.toml`). Ask once if none is found.
2. Framework and rendering: Next.js (App Router `app/` or Pages Router `pages/`), Nuxt, Astro, SvelteKit, Remix, Gatsby, Hugo, Jekyll, WordPress theme, Rails, Django, Laravel, plain HTML. Note whether pages are static, server-rendered, or client-rendered, since client-only content is the most common hidden SEO failure.
3. Where metadata lives: `generateMetadata` or `export const metadata`, `<Head>`, `useHead`, `<svelte:head>`, layout templates, frontmatter, or a CMS. Note the single place titles are built, since one template often breaks hundreds of pages.
4. Where these files come from: `robots.txt` (static file or route such as `app/robots.ts`), the sitemap (static, plugin, or route such as `app/sitemap.ts`), redirects (`next.config.*`, `_redirects`, `vercel.json`, server config), and structured data.

## Find the money pages

List the 5 to 15 pages that drive revenue or signups: home, pricing, signup, main product and feature pages, the best-converting landing pages, and the top blog posts by traffic (from Search Console when available). Every later step checks these first.

## Market and language

- Country and language of the buyers. Titles, page copy, and keyword research use that language.
- Locales the site ships, if any (step 2 checks whether each one earns its place).
- Main competitors (3 is enough). Ask once if they are not obvious from the site.
- Optional: a competitor's funnel. Find the `GTM-XXXXXX` ID in their page source, open `https://www.googletagmanager.com/gtm.js?id=GTM-XXXXXX`, and search for `__awct`: the Google Ads conversion names it lists (for example registration, trial, first payment) show which steps they pay to drive, so which pages and keywords matter to them.

## Keyword map

Keep a keyword map in `~/.gti/seo-growth/<project>/state.md`: one row per page with its primary keyword, intent, and status. One page per primary keyword. Two pages targeting the same keyword is cannibalization (step 3).

```markdown
| Page | Primary keyword | Intent | Status | Last change |
|------|-----------------|--------|--------|-------------|
| /pricing | acme pricing | transactional | ok | 2026-11-20 |
| /vs/competitor-x | acme vs competitor x | commercial | draft | 2026-11-20 |
```

Intent is one of: informational (learn), commercial (compare before buying), transactional (buy or sign up), navigational (find a brand). The page type must match it (step 3).

## Done when

- The site URL, framework, rendering mode, and metadata location are known.
- The money pages are listed.
- `state.md` exists with the keyword map.
