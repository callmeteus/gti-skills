# Templates and original work

**Template production** - `artdirector generate --template <id> --json` fills `library/templates` with brand tokens and `{{placeholders}}`. Layers use `data-layer` so ClickClick-style modifications remain possible.

Ids: `social-post`, `promo-banner`, `coupon`, `carousel-slide`, `cover`, `infographic`, `announcement`, `editorial`, `data-viz`, `story`.

`story` is a 1080×1920 full-bleed phone layout with monumental type. Do not treat it as a tall social post.

**Art direction** - write a new HTML artboard when templates are wrong for the brief. Still lock dimensions, fonts, and selectable regions.

Assets: Lucide subset in the package, Bunny Fonts, user files, public-domain or CC0 with a row in `.artdirector/assets.json` (`origin`, `license`, `attribution`).
