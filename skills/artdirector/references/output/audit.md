# Audit

`artdirector audit --id <id> --json` checks:

- Artboard dimensions vs the variant record
- Unexpected scrollbars / overflow
- Text clipping where measurable
- Text that crosses the artboard edge (`outside`, error) or sits within 40 px of a side (`edge`, warning)
- Story copy inside the top 210 px or bottom 250 px app chrome (`safe-zone`, warning)
- Text under a blur filter (`blur-text`, warning); `fx-motion` and `fx-ghost` are exempt
- Image load failures
- Missing font import
- Mentions of generative image tools

Elements marked `data-bleed` or `aria-hidden="true"` are decorative and skip the layout checks. Use that for giant background words that cross the edge on purpose.

Run it once per variant in the render check ([render-check.md](render-check.md)) and again before the final export. Fix errors. Do not claim subjective quality was verified.

Export: `artdirector export --id <id> --format png|jpeg|svg|pdf|html --json`. PNG/JPEG prefer ClickClick (`@maurogoncalo/clickclick`) when it loads; PDF, SVG, live preview, and audit use Playwright. Callers never pick the engine.
