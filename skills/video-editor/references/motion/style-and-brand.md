# Style guides and brand kit

## Motion.md guides

`motion styles --json` lists the shipped starter guides. Each is an original Markdown file with frontmatter: `name`, `mood`, `palette_roles`, `type`, `easing`, and `durations`, followed by a Do and Do not section.

| Id | Use it for |
|----|------------|
| `kinetic-type` | bold rhythmic words and hooks |
| `product-reveal` | a calm, premium product name reveal |
| `data-callout` | a counted statistic with a source note |
| `lower-third` | broadcast name plates inside the safe area |
| `logo-sting` | a short approved brand mark gesture |
| `social-hook` | the first second of a short video |
| `quote-card` | a considered quote with attribution |
| `chapter-card` | numbered sections that share one layout |

The guides describe intent and timing, never code. Read one before writing a composition. Keep its motion intent and pacing, replace the content with the user's words and brand. More than eight guides is fine if a future version ships more; `motion styles` is the source of truth.

## Templates

`motion new --template <id>` writes an editable composition from an original parameterized template.

| Id | What it draws |
|----|---------------|
| `title-card` | centered title, accent rule, subtitle |
| `lower-third` | name plate above the bottom safe area |
| `kinetic-caption` | three lines snapping in on beats |
| `stat-callout` | counted number, label, source note, bar |
| `logo-outro` | mark, brand name, tagline |
| `end-screen` | call to action with two pills |
| `vertical-hook` | portrait kicker, promise, first line |

Copy tokens: `TITLE`, `TEXT`, `ACCENT`, `LABEL`, `NUMBER`. Pass them as flags, for example `--text "Ada Lovelace" --accent "Mathematician"`. The command reports the written path and checks for the template, brand, canvas, and seek contract. Copy is escaped before it enters HTML.

## Brand kit

A `brand.json` has this shape:

```json
{
  "name": "Northfold",
  "colors": {
    "primary": "#6C5CE7",
    "secondary": "#00D2A6",
    "accent": "#FFB020",
    "background": "#0E1016",
    "text": "#FFFFFF"
  },
  "fonts": { "display": "Arial, sans-serif", "body": "Arial, sans-serif" },
  "logo": "/absolute/path/to/logo.png",
  "tone": "confident, plain spoken"
}
```

Missing keys fall back to the built-in default kit. The kit is read from the user's path; the engine never writes a brand file into the repository. Compositions read colors and fonts through CSS variables so one kit can dress several templates. Record the user's tone in the composition's copy choices, not as code.

Credits for the Motion.md and brand-kit ideas are in `packages/videoeditor/NOTICE.md`.
