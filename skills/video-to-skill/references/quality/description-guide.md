# Writing the description

The `description` is the only part of a skill that every agent reads on every request. It decides whether the skill activates. Maximum 1024 characters.

## Formula

1. **What it does:** one specific sentence with a verb.
2. **Use when:** the requests, keywords, and situations that should trigger it.
3. **Do not use when:** the near miss that would otherwise trigger it by mistake.

## Examples

| Quality | Description |
|---------|-------------|
| Poor | `Helps with deployment.` |
| Poor | `A skill for Vercel.` |
| Good | `Deploys a Next.js app to Vercel from the CLI and promotes previews to production. Use when the user asks to deploy, ship, redeploy, or publish to Vercel. Do not use for other hosting providers.` |

## Rules

- Third person or imperative; never "I" or "you".
- Include the words users actually type: product names, file types, commands.
- Put the most important trigger first, because long descriptions can be truncated.
- Mention required inputs when the skill cannot start without them.
- No marketing words ("powerful", "seamless").
- Use the folded YAML form so lines stay short:

```yaml
description: >-
  Deploys a Next.js app to Vercel from the CLI. Use when the user asks to
  deploy, ship, or redeploy to Vercel.
```
