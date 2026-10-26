---
name: deploy-to-vercel
description: >-
  Deploys a Next.js app to Vercel from the CLI, links the project, sets
  environment variables, and promotes a preview to production. Use when the
  user asks to deploy, ship, redeploy, or publish an app to Vercel. Do not use
  for other hosting providers.
compatibility: Requires Node.js 18+ and a Vercel account.
---

# Deploy to Vercel

## Core Rule

Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

## When to use

- The user asks to deploy, ship, or publish a Next.js app to Vercel.
- The user wants a preview URL for the current branch.
- The user wants to promote a preview to production.

Do not use this skill for Netlify, Cloudflare Pages, or self-hosted deploys.

## Prerequisites

- Node.js 18 or newer: `node --version`
- The Vercel CLI: `npm install --global vercel`
- A logged-in session: `vercel whoami` (run `vercel login` if it fails)

## Instructions

1. From the project root, link the project. Accept the detected Next.js settings.

   ```bash
   vercel link
   ```

   Expect a new `.vercel/` folder. Add `.vercel` to `.gitignore` if it is missing.

2. Pull the environment variables for local checks.

   ```bash
   vercel env pull .env.local
   ```

3. Create a preview deployment and report the URL it prints.

   ```bash
   vercel
   ```

4. Only after the user approves the preview, promote to production.

   ```bash
   vercel --prod
   ```

5. If the build fails, read the log with `vercel logs <deployment-url>` and fix the cause before retrying.

## Examples

```text
User: ship this to vercel
Agent: runs vercel whoami, vercel link, vercel; reports the preview URL; asks before running vercel --prod.
```

## Notes

- Never run `vercel --prod` without the user's approval.
- `vercel env pull` overwrites `.env.local`; confirm before running it when the file has local edits.
