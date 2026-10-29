# X Search Operators

`twitter_search` types the query into the X web search and reads the Latest tab, so it takes the operators of the X web search. They differ from the paid X API: the web search uses `filter:` where the API uses `is:` and `has:`, and it supports engagement and date filters that the API lacks.

## Operators

| Operator | Example | Notes |
|----------|---------|-------|
| keywords | `bun 2.0` | All words must match (implicit AND) |
| `"..."` | `"zero-day"` | Exact phrase |
| `OR` | `bun OR deno` | Uppercase only |
| `-` | `-filter:replies` | Excludes a word or filter |
| `( )` | `(fast OR perf) bun` | Grouping |
| `from:` | `from:TheHackerWire` | Posts by an account |
| `to:` | `to:vercel` | Replies to an account |
| `@` | `@vercel` | Posts that mention an account |
| `#`, `$` | `#buildinpublic`, `$AAPL` | Hashtag, cashtag |
| `lang:` | `lang:en` | Language code |
| `url:` | `url:github.com` | Posts that link to a domain |
| `filter:links` | `CVE filter:links` | Posts with a link |
| `filter:media`, `filter:images`, `filter:videos` | `demo filter:videos` | Posts with media |
| `filter:replies` | `-filter:replies` | Replies; negate to keep only original posts |
| `filter:nativeretweets` | `-filter:nativeretweets` | Retweets; negate to drop them |
| `min_faves:`, `min_retweets:`, `min_replies:` | `min_faves:50` | Engagement floor; useful to cut noise on busy topics |
| `since:`, `until:` | `since:2026-10-01 until:2026-10-15` | Date range, `YYYY-MM-DD` |
| `conversation_id:` | `conversation_id:1850000000000000000` | All replies in a thread, by the root tweet ID |

## Building good queries

- **Start specific.** One query with operators replaces several plain ones, and every call counts against the rate limit. For example, `(CVE OR exploit) from:TheHackerWire -filter:replies` instead of three separate searches.
- **Cut noise on busy topics** with `-filter:replies -filter:nativeretweets` and, when needed, `min_faves:10`.
- **Long or rare queries can return nothing.** `No tweets found for query` is a valid answer, not an error. Remove the rarest term or widen the date range once; do not keep shortening the query, which only spends the budget.
- **Tweet URLs** have the form `https://x.com/<username>/status/<tweet_id>`. The ID after `/status/` is the value for `conversation_id:`.
