# Step 6: AI search visibility

Goal: make the site readable by, and worth citing for, AI search (ChatGPT search, Perplexity, Claude, Google AI Overviews, Copilot).

## Can AI crawlers read the site?

The site check fetches each page as GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Googlebot, and Bingbot and compares what they receive with a browser. Check the pricing page with `--expect` and a real price or plan name:

```bash
python3 <skill-dir>/scripts/audit/site_check.py https://example.com --pages /pricing --expect "Pro"
```

Failures and fixes:

| Failure | Fix |
|---------|-----|
| 403 or a challenge page for AI bots | Allow the bots in the firewall or CDN bot settings (user step when it is a dashboard setting) |
| Pricing or key facts rendered only by client JavaScript | Server-render them; most AI crawlers do not run JavaScript |
| Docs or pricing behind login | Publish a public version of what buyers need to compare |
| robots.txt blocks the bot | Allow the search bots (`OAI-SearchBot`, `PerplexityBot`, `Claude-SearchBot`, `Bingbot`) at least |

Search bots and training bots are separate. Blocking training bots (`GPTBot`, `ClaudeBot`, `CCBot`, `Google-Extended`) is a business choice and does not remove the site from AI search; blocking the search bots does. Ask the user before blocking or allowing training bots, and never block `Googlebot` or `Bingbot`.

To protect expensive data routes from scrapers, rate-limit or block by path, and verify real Googlebot and Bingbot by reverse DNS instead of trusting the user agent.

## Structured facts

- `Organization` schema with `name`, `url`, `logo`, and `sameAs` links to official profiles.
- `Product` with `Offer`, or `SoftwareApplication` with `offers`, on the pricing page, matching the visible prices.
- An `llms.txt` at the site root: a short Markdown summary of what the product is, who it is for, pricing, and links to the key pages. Generate it from the same data source as the pages (a route handler in frameworks that have them) so it never goes stale. It is a convention, not a ranking factor; keep it short and true.

## Be the page AI cites

AI answers cite pages that answer a buyer's prompt directly and with proof.

1. Map the buyer journey in 5 stages (problem aware, solution aware, comparing, deciding, using) and write 3 to 5 prompts a buyer would type at each stage. Save them in `state.md`.
2. For each prompt, check which pages get cited when possible (run the prompt in an AI search tool the agent can reach, or ask the user to). Where competitors are cited and the user's site is not, plan a page or section that answers that prompt (step 5).
3. Put the direct answer in the first 40 words of the section, with a specific number, name, or example.
4. Keep facts consistent everywhere (pricing page, docs, schema, `llms.txt`, third-party profiles). Conflicting facts lower the chance of being cited.
5. Earn mentions on pages AI tools already cite for the topic (listicles, review sites, community threads). That is authority work for the user (step 7).

## Done when

AI crawlers receive the same content as browsers on every money page, pricing and key facts are in server HTML and schema, and the buyer prompts are mapped with a page for each.
