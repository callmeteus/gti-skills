# Audit

`artdirector audit --id <id> --json` checks:

- Artboard dimensions vs the variant record
- Unexpected scrollbars / overflow
- Text clipping where measurable
- Image load failures
- Missing font import
- Mentions of generative image tools

Fix errors. Do not claim subjective quality was verified.

Export: `artdirector export --id <id> --format png|jpeg|svg|pdf|html --json`. PNG/JPEG prefer ClickClick (`@maurogoncalo/clickclick`) when it loads; PDF, SVG, live preview, and audit use Playwright. Callers never pick the engine.
