# Working with Unslop Interface

This skill calls `unslop-interface` in both modes. The two skills share one enemy, the generic generated look, but aim at different results: Unslop Interface moves an existing UI toward neutral and quiet, while Mode 2 here may choose a bold direction. This file says which rule wins.

## What each mode takes from Unslop Interface

| Mode | Unslop step used | How |
|------|------------------|-----|
| Review | Inventory only (its slop tells list) | Each tell becomes a finding, usually minor, with the Unslop pass that fixes it as the recommendation |
| Review, user asked for fixes | Inventory and the passes that apply | Run its passes in order after the design system fixes |
| Create | Inventory on the finished build, then the passes for unchosen tells | Remove what the direction did not choose; keep and list what it did |

## Resolving conflicts in Mode 2

| Unslop rule | In Mode 2 | Condition |
|-------------|-----------|-----------|
| Neutral base, color only for meaning | May be overridden | The direction names a dominant color and its accents |
| No new gradients, glow, or glass | Gradients, grain, mesh, and dramatic shadows allowed | The effect is named in the direction and used consistently; glow on every card and purple-to-violet gradients stay banned |
| No display font | Display face allowed for headings | Body and UI text stay in a refined, readable face |
| Plain, quiet type and copy | Always applies | Exclamation marks, emoji icons, hype words, "Welcome back!" headers, redundant taglines, and numbers without context are never part of a direction |
| Spacing scale, radius family, icon alignment, tabular figures, affordance, sticky table headers | Always applies | These are craft, not style |

When the product has a design system, the design system wins over both skills.

## Report

In the review or build report, list:

- Each slop tell found, with the Unslop pass that fixed it or will fix it.
- Each effect kept on purpose, with the part of the direction it serves.
